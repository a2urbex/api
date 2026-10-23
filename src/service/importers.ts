// Admin-triggered runs of the standalone importers (Wikimedia Commons, Wikidata, Flickr).
// Same pipeline as the CLI (importers/common.ts), executed inside the API with live stats and logs (SSE).
import { randomUUID } from 'crypto'

import config from 'config'
import { importRecords, ImportRecord, ImportStats } from '../importers/common'
import * as commons from '../importers/commons'
import * as wikidata from '../importers/wikidata'
import * as flickr from '../importers/flickr'

type JobState = 'running' | 'finished' | 'stopped' | 'error'

interface ImporterDef {
  key: string
  source: string
  description: string
  options: { key: string; label: string; placeholder: string }[]
  records: (args: Record<string, string>) => AsyncIterable<ImportRecord>
  unavailable?: () => string | null
}

export const IMPORTERS: ImporterDef[] = [
  {
    key: 'wikidata',
    source: wikidata.SOURCE,
    description: 'Ruins and abandoned buildings with coordinates and a Commons image (SPARQL).',
    options: [{ key: 'country', label: 'Country (Wikidata id)', placeholder: 'Q142 = France, empty = world' }],
    records: wikidata.records,
  },
  {
    key: 'commons',
    source: commons.SOURCE,
    description: 'Geotagged photos in abandoned-places categories, with author and licence.',
    options: [{ key: 'category', label: 'Categories', placeholder: 'Abandoned hospitals|Abandoned factories (empty = all)' }],
    records: commons.records,
  },
  {
    key: 'flickr',
    source: flickr.SOURCE,
    description: 'Creative Commons photos tagged urbex / abandoned, street-level geotags.',
    options: [
      { key: 'tags', label: 'Tags', placeholder: 'urbex,abandoned,lostplace,abandonedplaces' },
      { key: 'since', label: 'Uploaded since', placeholder: '2012-01-01' },
    ],
    records: flickr.records,
    unavailable: () => (config.flickrApiKey ? null : 'FLICKR_API_KEY is missing in the API .env'),
  },
]

const MAX_LOGS = 400

export class ImportJob {
  id = randomUUID()
  state: JobState = 'running'
  stats: ImportStats | null = null
  error: string | null = null
  errors: string[] = []
  startedAt = Date.now()
  finishedAt: number | null = null
  aborted = false
  logs: string[] = []
  private statListeners = new Set<(s: any) => void>()
  private logListeners = new Set<(l: string) => void>()

  constructor(
    public key: string,
    public source: string,
    public dryRun: boolean,
    public limit: number | null,
    public args: Record<string, string>,
  ) {}

  log(line: string) {
    this.logs.push(line)
    if (this.logs.length > MAX_LOGS) this.logs.shift()
    for (const fn of this.logListeners) fn(line)
  }

  snapshot() {
    return {
      id: this.id,
      key: this.key,
      source: this.source,
      state: this.state,
      dryRun: this.dryRun,
      limit: this.limit,
      args: this.args,
      stats: this.stats,
      error: this.error,
      errors: this.errors,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
    }
  }

  emit() {
    const s = this.snapshot()
    for (const fn of this.statListeners) fn(s)
  }

  subscribe(fn: (s: any) => void) {
    this.statListeners.add(fn)
    fn(this.snapshot())
    return () => this.statListeners.delete(fn)
  }

  subscribeLogs(fn: (l: string) => void) {
    for (const l of this.logs) fn(l)
    this.logListeners.add(fn)
    return () => this.logListeners.delete(fn)
  }
}

const jobs = new Map<string, ImportJob>()
const lastBySource = new Map<string, ImportJob>()

export const getJob = (id: string) => jobs.get(id)

export const listImporters = () =>
  IMPORTERS.map((d) => {
    const last = lastBySource.get(d.key)
    return {
      key: d.key,
      source: d.source,
      description: d.description,
      options: d.options,
      unavailable: d.unavailable?.() ?? null,
      running: last?.state === 'running' ? last.snapshot() : null,
      last: last ? last.snapshot() : null,
    }
  })

export const startImport = (key: string, dryRun: boolean, limit: number | null, rawArgs: Record<string, string> = {}) => {
  const def = IMPORTERS.find((d) => d.key === key)
  if (!def) throw new Error('Unknown importer')
  const reason = def.unavailable?.()
  if (reason) throw new Error(reason)
  if (lastBySource.get(key)?.state === 'running') throw new Error(`${def.source} is already running`)

  // only declared options, trimmed
  const args: Record<string, string> = {}
  for (const o of def.options) if (typeof rawArgs[o.key] === 'string' && rawArgs[o.key].trim()) args[o.key] = rawArgs[o.key].trim()

  const job = new ImportJob(key, def.source, dryRun, limit, args)
  jobs.set(job.id, job)
  lastBySource.set(key, job)
  job.log(`${dryRun ? 'Dry run' : 'Import'} ${def.source}${limit ? `, limit ${limit}` : ''}${Object.keys(args).length ? `, ${JSON.stringify(args)}` : ''}`)

  // fire and forget: progress goes through the SSE stream
  ;(async () => {
    try {
      const res = await importRecords(def.source, def.records(args), { dryRun, limit: limit ?? Infinity, args }, {
        log: (l) => job.log(l),
        onStats: (s) => {
          job.stats = s
          job.emit()
        },
        aborted: () => job.aborted,
      })
      job.stats = res.stats
      job.errors = res.errors
      if (res.fatal) {
        job.error = res.fatal
        job.state = 'error'
        job.log(`ERROR: ${res.fatal}`)
      } else {
        job.state = job.aborted ? 'stopped' : 'finished'
        job.log(job.aborted ? 'Run stopped.' : `Done: ${dryRun ? `${res.stats.wouldInsert} would be imported` : `${res.stats.inserted} imported`}.`)
      }
      for (const e of res.errors) job.log(`! ${e}`)
    } catch (e: any) {
      job.state = 'error'
      job.error = e?.message ?? String(e)
      job.log(`ERROR: ${job.error}`)
    } finally {
      job.finishedAt = Date.now()
      job.emit()
    }
  })()

  return job
}
