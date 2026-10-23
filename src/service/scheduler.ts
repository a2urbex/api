// Daily automatic runs at random times:
// - day (07:00-15:00): Pinterest, Wikidata, Wikimedia Commons, Flickr — each at its own random minute
// - late afternoon (16:30-18:30): dedup, always after the imports (waits if one is still running)
// Times are drawn again every day. Reports go to admins only (admin_system channel).
import { randomUUID } from 'crypto'

import dao from 'dao'
import pinterestService, { PinterestJob, registry as pinterestRegistry } from 'service/pinterest'
import { startImport, listImporters } from 'service/importers'
import { startDedup, isDedupRunning } from 'service/dedup'

type Task = { key: string; label: string; window: [number, number]; run: () => Promise<void> }

const DAY_WINDOW: [number, number] = [7, 15]
const EVENING_WINDOW: [number, number] = [16.5, 18.5]
const DEDUP_RADIUS_M = 25

const plan = new Map<string, { label: string; at: number; last?: { at: number; result: string } }>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Random time inside the window, today if still ahead, otherwise tomorrow
const nextSlot = ([from, to]: [number, number], after = Date.now()) => {
  for (let day = 0; day < 3; day++) {
    const base = new Date(after)
    base.setHours(0, 0, 0, 0)
    base.setDate(base.getDate() + day)
    const start = base.getTime() + from * 3600_000
    const end = base.getTime() + to * 3600_000
    const lo = Math.max(start, after + 60_000)
    if (lo < end) return lo + Math.floor(Math.random() * (end - lo))
  }
  return after + 86400_000
}

const importsRunning = () => pinterestService.isRunning() || listImporters().some((i) => i.running)

const runPinterest = async () => {
  const settings = await dao.pinterest.getSettings()
  if (!settings?.cron_enabled) throw new Error('skipped (Pinterest cron disabled in admin)')
  if (pinterestService.isRunning()) throw new Error('skipped (a run is already in progress)')
  const source = await pinterestService.resolveSource()
  const id = randomUUID()
  const job = new PinterestJob(id, source.name)
  pinterestRegistry.add(job)
  await dao.pinterest.createJob(id, 'cron', source.id, null)
  try {
    await pinterestService.fetch(job)
  } finally {
    await dao.pinterest.updateJob(id, job.state, job.processed, job.inserted, job.skipped, job.failed, job.error ?? null)
  }
}

const runImporter = (key: string) => async () => {
  const imp = listImporters().find((i) => i.key === key)
  if (imp?.unavailable) throw new Error(`skipped (${imp.unavailable})`)
  const job = startImport(key, false, null, {})
  // wait for the end so the dedup can rely on "nothing running"
  while (job.state === 'running') await sleep(10_000)
  if (job.state === 'error') throw new Error(job.error || 'error')
}

const runDedup = async () => {
  // after all imports of the day: wait up to 3 h for a still-running import
  const until = Date.now() + 3 * 3600_000
  while (importsRunning() && Date.now() < until) await sleep(5 * 60_000)
  if (isDedupRunning()) throw new Error('skipped (a dedup is already running)')
  await startDedup(DEDUP_RADIUS_M, null)
}

const TASKS: Task[] = [
  { key: 'pinterest', label: 'Pinterest', window: DAY_WINDOW, run: runPinterest },
  { key: 'wikidata', label: 'Wikidata', window: DAY_WINDOW, run: runImporter('wikidata') },
  { key: 'commons', label: 'Wikimedia Commons', window: DAY_WINDOW, run: runImporter('commons') },
  { key: 'flickr', label: 'Flickr', window: DAY_WINDOW, run: runImporter('flickr') },
  { key: 'dedup', label: 'Dedup', window: EVENING_WINDOW, run: runDedup },
]

const schedule = (task: Task, after = Date.now()) => {
  // the dedup slot is always later than every import slot of the same day
  const at = nextSlot(task.window, after)
  const prev = plan.get(task.key)
  plan.set(task.key, { label: task.label, at, last: prev?.last })
  clearTimeout(timers.get(task.key))
  timers.set(
    task.key,
    setTimeout(async () => {
      let result = 'done'
      try {
        console.log(`[scheduler] ${task.label}: start`)
        await task.run()
      } catch (e: any) {
        result = e?.message ?? String(e)
      }
      console.log(`[scheduler] ${task.label}: ${result}`)
      plan.get(task.key)!.last = { at: Date.now(), result }
      schedule(task, at + 3600_000) // next day's random slot
    }, at - Date.now()),
  )
}

export const startScheduler = () => {
  // SCHEDULER=off in .env.local: no automatic runs on a dev machine
  if ((process.env.SCHEDULER || '').toLowerCase() === 'off') {
    console.log('[scheduler] disabled (SCHEDULER=off)')
    return
  }
  for (const t of TASKS) schedule(t)
  console.log(
    '[scheduler] next runs: ' +
      [...plan.values()].map((p) => `${p.label} ${new Date(p.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`).join(' · '),
  )
}

export const getSchedule = () => [...plan.entries()].map(([key, p]) => ({ key, label: p.label, nextRun: p.at, last: p.last ?? null }))
