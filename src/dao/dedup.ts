import type { Point, JobState } from 'service/dedup'

let db: db

const BATCH_SIZE = 10_000

const dedup = {
  init: (db1: db) => {
    db = db1
  },

  countActivePoints: async (): Promise<number> => {
    const row = await db.query(
      `SELECT COUNT(*) AS total FROM location
       WHERE dedup_removed_at IS NULL
         AND lat IS NOT NULL AND lon IS NOT NULL`,
      [],
      0
    )
    return Number(row?.total ?? 0)
  },

  // Streams all active points ordered by id ascending.
  // Keyset pagination → constant memory, no OFFSET cost on 300k+ rows.
  async *streamPoints(): AsyncIterable<Point[]> {
    let lastId = 0
    while (true) {
      const rows: any[] = await db.query(
        `SELECT id, lat, lon FROM location
         WHERE dedup_removed_at IS NULL
           AND lat IS NOT NULL AND lon IS NOT NULL
           AND id > ?
         ORDER BY id ASC
         LIMIT ?`,
        [lastId, BATCH_SIZE]
      )
      if (!rows || rows.length === 0) return
      const out: Point[] = new Array(rows.length)
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        out[i] = { id: Number(r.id), lat: Number(r.lat), lon: Number(r.lon) }
      }
      yield out
      lastId = out[out.length - 1].id
    }
  },

  createJob: async (id: string, total: number, radiusM: number, userId: number) => {
    return db.query(
      `INSERT INTO dedup_job (id, state, total, radius_m, started_at, user_id)
       VALUES (?, 'running', ?, ?, NOW(), ?)`,
      [id, total, radiusM, userId]
    )
  },

  updateJob: async (
    id: string,
    state: JobState,
    processed: number,
    duplicates: number,
    kept: number,
    error: string | null
  ) => {
    return db.query(
      `UPDATE dedup_job
       SET state = ?, processed = ?, duplicates = ?, kept = ?,
           finished_at = NOW(), error = ?
       WHERE id = ?`,
      [state, processed, duplicates, kept, error, id]
    )
  },

  markRemoved: async (jobId: string, ids: number[]) => {
    if (!ids.length) return
    const placeholders = ids.map(() => '?').join(',')
    return db.query(
      `UPDATE location
       SET dedup_removed_at = NOW(), dedup_job_id = ?
       WHERE id IN (${placeholders})`,
      [jobId, ...ids]
    )
  },

  listJobs: async (limit = 20) => {
    return db.query(
      `SELECT id, state, total, processed, duplicates, kept, radius_m,
              started_at, finished_at, error, user_id
       FROM dedup_job
       ORDER BY started_at DESC
       LIMIT ?`,
      [limit]
    )
  },
}

export default dedup
