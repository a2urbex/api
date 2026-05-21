/**
 * Geospatial deduplication service.
 *
 * Algorithm: uniform spatial hashing grid (cell size = radius_m).
 * Each new point only checks the 3x3 cells around it (extended on the
 * longitude axis near the poles to compensate cos(lat) distortion).
 * Distance is then refined with the Haversine formula.
 *
 * Complexity: O(n) average, O(n * k) worst case where k is the average
 * number of points per cell — bounded by local density, not by n.
 * Memory: O(n).
 */

const EARTH_RADIUS_M = 6_371_000
const DEG_PER_M_LAT = 1 / 111_320

export interface Point {
  id: number
  lat: number
  lon: number
}

export type JobState = 'running' | 'stopped' | 'finished' | 'error'

export interface JobStats {
  id: string
  state: JobState
  total: number
  processed: number
  duplicates: number
  kept: number
  progress: number
  speed: number
  error?: string
}

export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export class SpatialGrid {
  private readonly cellDeg: number
  private readonly radiusM: number
  private readonly cells = new Map<number, Point[]>()

  constructor(radiusM: number) {
    this.radiusM = radiusM
    this.cellDeg = radiusM * DEG_PER_M_LAT
  }

  // Pack (cx, cy) into a single number key — avoids per-point string allocation.
  private cellKey(cx: number, cy: number): number {
    return (cx + 1_048_576) * 4_194_304 + (cy + 1_048_576)
  }

  hasNeighborWithin(p: Point): boolean {
    const cx = Math.floor(p.lat / this.cellDeg)
    const cy = Math.floor(p.lon / this.cellDeg)
    const cosLat = Math.cos((p.lat * Math.PI) / 180) || 1e-9
    const lonSpan = Math.max(1, Math.ceil(1 / cosLat))

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -lonSpan; dy <= lonSpan; dy++) {
        const bucket = this.cells.get(this.cellKey(cx + dx, cy + dy))
        if (!bucket) continue
        for (let i = 0; i < bucket.length; i++) {
          const o = bucket[i]
          if (haversine(p.lat, p.lon, o.lat, o.lon) <= this.radiusM) return true
        }
      }
    }
    return false
  }

  add(p: Point): void {
    const cx = Math.floor(p.lat / this.cellDeg)
    const cy = Math.floor(p.lon / this.cellDeg)
    const k = this.cellKey(cx, cy)
    const arr = this.cells.get(k)
    if (arr) arr.push(p)
    else this.cells.set(k, [p])
  }

  clear(): void {
    this.cells.clear()
  }
}

export type Listener = (s: JobStats) => void

export class DedupJob {
  state: JobState = 'running'
  processed = 0
  duplicates = 0
  kept = 0
  startedAt = 0
  error?: string

  private aborted = false
  private grid: SpatialGrid
  private listeners = new Set<Listener>()

  constructor(
    public readonly id: string,
    private readonly source: AsyncIterable<Point[]>,
    public readonly total: number,
    public readonly radiusM = 25
  ) {
    this.grid = new SpatialGrid(radiusM)
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => this.listeners.delete(fn)
  }

  stop(): void {
    if (this.state === 'running') this.aborted = true
  }

  snapshot(): JobStats {
    const elapsed = (Date.now() - this.startedAt) / 1000
    return {
      id: this.id,
      state: this.state,
      total: this.total,
      processed: this.processed,
      duplicates: this.duplicates,
      kept: this.kept,
      progress: this.total ? this.processed / this.total : 0,
      speed: elapsed > 0 ? this.processed / elapsed : 0,
      error: this.error,
    }
  }

  private emit(): void {
    const s = this.snapshot()
    for (const fn of this.listeners) fn(s)
  }

  async run(opts: {
    chunkSize?: number
    onRemoved?: (id: number) => void | Promise<void>
  } = {}): Promise<void> {
    const { chunkSize = 5_000, onRemoved } = opts
    this.startedAt = Date.now()
    this.emit()

    try {
      let sinceYield = 0
      for await (const batch of this.source) {
        for (let i = 0; i < batch.length; i++) {
          if (this.aborted) {
            this.state = 'stopped'
            this.emit()
            return
          }
          const p = batch[i]
          if (this.grid.hasNeighborWithin(p)) {
            this.duplicates++
            await onRemoved?.(p.id)
          } else {
            this.grid.add(p)
            this.kept++
          }
          this.processed++

          if (++sinceYield >= chunkSize) {
            sinceYield = 0
            this.emit()
            // Yield the event loop — Bun supports setImmediate.
            await new Promise<void>((r) => setImmediate(r))
          }
        }
      }

      this.state = 'finished'
      this.emit()
    } catch (e) {
      this.state = 'error'
      this.error = e instanceof Error ? e.message : String(e)
      this.emit()
    } finally {
      this.grid.clear()
    }
  }
}

class JobRegistry {
  private jobs = new Map<string, DedupJob>()
  add(job: DedupJob) { this.jobs.set(job.id, job) }
  get(id: string) { return this.jobs.get(id) }
  remove(id: string) { this.jobs.delete(id) }
}

export const registry = new JobRegistry()
