// Shared pipeline for the standalone importers (Wikimedia Commons, Wikidata, Flickr).
// Each importer yields candidate records; this module filters, dedups, downloads and stores them.
//
// Rules (same for every source):
// - keep only records with BOTH coordinates and an image URL
// - idempotent: (source, pid) already imported => skip
// - never recreate an invalid point (status invalid within ~30 m) => skip
// - one point per place: any existing point within ~40 m => skip
// - --dry-run prints counts and writes nothing (no DB insert, no image download)
import config from 'config'
import Db from '@core/Db'
import dao from 'dao'
import categoryService from 'service/category'
import geocoderService from 'service/geocoder'
import { reportImport } from 'service/notify'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

export const USER_AGENT = 'a2urbex-importer/1.0 (https://a2urbex.com; admin@a2urbex.com)'

export interface ImportRecord {
  pid: number // numeric source id (Commons pageid, Wikidata Q-number, Flickr photo id)
  url: string // source page
  lat: number | null
  lon: number | null
  name: string
  description?: string | null
  imageUrl: string | null
  credit?: string | null
  license?: string | null
  hint?: string // extra text used to guess the urbex category (type, tags…)
}

export interface Options {
  dryRun: boolean
  limit: number
  args: Record<string, string>
}

export const parseArgs = (): Options => {
  const args: Record<string, string> = {}
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) args[m[1]] = m[2] ?? 'true'
  }
  return { dryRun: args['dry-run'] === 'true', limit: args.limit ? parseInt(args.limit) : Infinity, args }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Minimum delay between two calls to the same host
export const rateLimiter = (minIntervalMs: number) => {
  let last = 0
  return async () => {
    const wait = last + minIntervalMs - Date.now()
    if (wait > 0) await sleep(wait)
    last = Date.now()
  }
}

export const fetchJson = async (url: string, init: RequestInit = {}, retries = 3): Promise<any> => {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers || {}) } })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 120))}`)
      return await res.json()
    } catch (e) {
      if (i >= retries) throw e
      await sleep(2000 * (i + 1))
    }
  }
}

export const stripHtml = (s?: string | null) =>
  (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

// Wikimedia refuse les téléchargements sans User-Agent identifiable : on n'utilise pas utils.downloadImage
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const downloadImage = async (url: string): Promise<string | null> => {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' })
  if (!res.ok) throw new Error(`image HTTP ${res.status}`)
  const ext = EXT[(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()]
  if (!ext) return null
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.byteLength < 1024) return null
  await fs.mkdir(config.path.location, { recursive: true })
  const file = `${config.path.location}/${randomUUID()}.${ext}`
  await fs.writeFile(file, buf)
  return '/' + file.replace(/^\/+/, '')
}

const initDb = async () => {
  const db = new Db(config.mysql)
  for (const name in dao) (dao as any)[name].init(db)
  await categoryService.init()
}

const ensureSource = async (name: string) => {
  if (!(await dao.source.getByName(name))) await dao.source.create(name)
}

export type ImportStats = {
  seen: number
  missingGeoOrImage: number
  alreadyImported: number
  invalidNearby: number
  nearbyExisting: number
  imageFailed: number
  inserted: number
  wouldInsert: number
  failed: number
}

export interface ImportHooks {
  log?: (line: string) => void
  onStats?: (stats: ImportStats) => void
  aborted?: () => boolean
}

// Core pipeline, usable from the CLI and from the API (admin page). Never exits the process.
export const importRecords = async (
  sourceName: string,
  records: AsyncIterable<ImportRecord>,
  opts: Options,
  hooks: ImportHooks = {},
): Promise<{ stats: ImportStats; errors: string[]; fatal?: string }> => {
  const log = hooks.log ?? ((l: string) => console.log(l))
  const stats: ImportStats = { seen: 0, missingGeoOrImage: 0, alreadyImported: 0, invalidNearby: 0, nearbyExisting: 0, imageFailed: 0, inserted: 0, wouldInsert: 0, failed: 0 }
  const errors: string[] = []
  const emit = () => hooks.onStats?.({ ...stats })

  if (!opts.dryRun && !config.path.location) return { stats, errors, fatal: 'LOCATION_IMAGE_PATH is missing in .env (folder where images are stored)' }
  if (!opts.dryRun) await ensureSource(sourceName)

  const seenThisRun: [number, number][] = [] // dedup between records of this run too
  const download = rateLimiter(400)
  const d = 0.00036
  let fatal: string | undefined
  let shown = 0

  try {
    for await (const r of records) {
      if (hooks.aborted?.()) {
        log('Stopped by user.')
        break
      }
      if (stats.inserted + stats.wouldInsert >= opts.limit) break
      stats.seen++
      try {
        if (r.lat == null || r.lon == null || !Number.isFinite(r.lat) || !Number.isFinite(r.lon) || !r.imageUrl) {
          stats.missingGeoOrImage++
          continue
        }
        if (await dao.location.getByPid(r.pid, sourceName)) {
          stats.alreadyImported++
          continue
        }
        if (await dao.location.findInvalidNear(r.lat, r.lon)) {
          stats.invalidNearby++
          continue
        }
        if ((await dao.location.findNear(r.lat, r.lon)) || seenThisRun.some(([a, b]) => Math.abs(a - r.lat!) < d && Math.abs(b - r.lon!) < d)) {
          stats.nearbyExisting++
          continue
        }

        if (opts.dryRun) {
          stats.wouldInsert++
          seenThisRun.push([r.lat, r.lon])
          if (shown++ < 15) log(`+ ${r.name}  (${r.lat.toFixed(4)}, ${r.lon.toFixed(4)})  ${r.license ?? ''}  ${r.url}`)
          continue
        }

        await download()
        const image = await downloadImage(r.imageUrl).catch((e) => {
          if (errors.length < 10) errors.push(`${r.url}: ${e.message}`)
          return null
        })
        if (!image) {
          stats.imageFailed++
          continue
        }
        const country = await geocoderService.getCountry(r.lat, r.lon).catch(() => null)
        const category: any = categoryService.getCategory(`${r.name} ${r.hint ?? ''}`)
        const credit = r.credit ? `${r.credit}${r.license ? ` (${r.license})` : ''} via ${sourceName}` : null
        await dao.location.addImported({
          pid: r.pid,
          source: sourceName,
          url: r.url,
          lat: r.lat,
          lon: r.lon,
          name: r.name || 'Untitled',
          description: [r.description, credit && `Photo: ${credit}`].filter(Boolean).join('\n\n') || null,
          image,
          imageUrl: r.imageUrl,
          credit: r.credit ?? null,
          license: r.license ?? null,
          countryId: country?.id ?? null,
          categoryId: category?.id ?? null,
        })
        seenThisRun.push([r.lat, r.lon])
        stats.inserted++
        if (stats.inserted <= 15 || stats.inserted % 25 === 0) log(`+ ${r.name}${stats.inserted > 15 ? `  (${stats.inserted} inserted)` : ''}`)
      } catch (e: any) {
        stats.failed++
        if (errors.length < 10) errors.push(`${r.url}: ${e?.message ?? e}`)
      } finally {
        if (stats.seen % 10 === 0) emit()
      }
    }
  } catch (e: any) {
    // source-level error (missing key, API down): clear message, no stack
    fatal = e?.message ?? String(e)
  }

  emit()
  if (!opts.dryRun && !fatal) {
    await reportImport(sourceName, { inserted: stats.inserted, skipped: stats.seen - stats.inserted - stats.failed, failed: stats.failed })
  }
  return { stats, errors, fatal }
}

// CLI wrapper: own DB pool, console output, exit code
export const runImport = async (sourceName: string, records: AsyncIterable<ImportRecord>, opts: Options) => {
  const started = Date.now()
  await initDb()
  const { stats, errors, fatal } = await importRecords(sourceName, records, opts)
  if (fatal) {
    console.error(`\n${sourceName}: ${fatal}`)
    process.exit(1)
  }
  console.log(`\n${sourceName} ${opts.dryRun ? '(DRY RUN, nothing written)' : ''} in ${Math.round((Date.now() - started) / 1000)}s`)
  console.table(stats)
  if (errors.length) console.log('errors:\n  ' + errors.join('\n  '))
  process.exit(0)
}
