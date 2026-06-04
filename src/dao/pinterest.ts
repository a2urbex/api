import type { PinterestState } from 'service/pinterest'

let db: db

const pinterest = {
  init: (db1: db) => {
    db = db1
  },

  /**
   * Returns the single settings row (id=1), joined with the source name for display.
   */
  getSettings: async () => {
    return db.query(
      `SELECT s.id, s.cron_enabled, s.cron_expression, s.source_id, src.name AS source_name
       FROM pinterest_settings s
       LEFT JOIN source src ON src.id = s.source_id
       WHERE s.id = 1`,
      [],
      0
    )
  },

  /**
   * Partial update of the settings row. Only provided fields are written.
   */
  updateSettings: async (patch: {
    cronEnabled?: boolean
    cronExpression?: string
    sourceId?: number | null
  }) => {
    const sets: string[] = []
    const params: any[] = []

    if (patch.cronEnabled !== undefined) {
      sets.push('cron_enabled = ?')
      params.push(patch.cronEnabled ? 1 : 0)
    }
    if (patch.cronExpression !== undefined) {
      sets.push('cron_expression = ?')
      params.push(patch.cronExpression)
    }
    if (patch.sourceId !== undefined) {
      sets.push('source_id = ?')
      params.push(patch.sourceId)
    }

    if (!sets.length) return
    return db.query(`UPDATE pinterest_settings SET ${sets.join(', ')} WHERE id = 1`, params)
  },

  createJob: async (
    id: string,
    triggerType: 'manual' | 'cron',
    sourceId: number | null,
    userId: number | null
  ) => {
    return db.query(
      `INSERT INTO pinterest_job (id, state, trigger_type, source_id, user_id, started_at)
       VALUES (?, 'running', ?, ?, ?, NOW())`,
      [id, triggerType, sourceId, userId]
    )
  },

  updateJob: async (
    id: string,
    state: PinterestState,
    total: number,
    inserted: number,
    skipped: number,
    failed: number,
    error: string | null
  ) => {
    return db.query(
      `UPDATE pinterest_job
       SET state = ?, total = ?, inserted = ?, skipped = ?, failed = ?,
           error = ?, finished_at = NOW()
       WHERE id = ?`,
      [state, total, inserted, skipped, failed, error, id]
    )
  },

  getJob: async (id: string) => {
    return db.query(
      `SELECT id, state, trigger_type, source_id, total, inserted, skipped, failed,
              error, user_id, started_at, finished_at
       FROM pinterest_job WHERE id = ?`,
      [id],
      0
    )
  },

  listJobs: async (limit = 20) => {
    return db.query(
      `SELECT j.id, j.state, j.trigger_type, j.source_id, j.total, j.inserted,
              j.skipped, j.failed, j.error, j.started_at, j.finished_at,
              s.name AS source_name
       FROM pinterest_job j
       LEFT JOIN source s ON s.id = j.source_id
       ORDER BY j.started_at DESC
       LIMIT ?`,
      [limit]
    )
  },

  deleteJob: async (id: string) => {
    return db.query(`DELETE FROM pinterest_job WHERE id = ?`, [id])
  },
}

export default pinterest
