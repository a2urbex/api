let db: db

const importDao = {
  init: (db1: db) => {
    db = db1
  },

  create: (
    id: string,
    filename: string,
    size: number,
    categoryId: number | null,
    assigneeId: number | null,
    uploaderId: number | null,
    options: any,
    sourceId: number | null = null
  ) => {
    const sql = `INSERT INTO import_job (id, filename, size, category_id, assignee_id, source_id, uploader_id, options)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    return db.query(sql, [id, filename, size, categoryId, assigneeId, sourceId, uploaderId, JSON.stringify(options || {})])
  },

  finish: (
    id: string,
    state: 'finished' | 'error',
    total: number,
    inserted: number,
    skipped: number,
    updated: number,
    favoriteId: number | null,
    error: string | null
  ) => {
    const sql = `UPDATE import_job
                 SET state = ?, total = ?, inserted = ?, skipped = ?, updated = ?,
                     favorite_id = ?, error = ?, finished_at = NOW()
                 WHERE id = ?`
    return db.query(sql, [state, total, inserted, skipped, updated, favoriteId, error, id])
  },

  list: (limit = 30) => {
    const sql = `
      SELECT j.id, j.filename, j.size, j.state, j.total, j.inserted, j.skipped, j.updated,
             j.error, j.started_at, j.finished_at, j.options,
             COALESCE(u.username, 'a2urbex') assignee_username,
             up.username uploader_username,
             s.name source_name
      FROM import_job j
      LEFT JOIN user u ON u.id = j.assignee_id
      LEFT JOIN user up ON up.id = j.uploader_id
      LEFT JOIN source s ON s.id = j.source_id
      ORDER BY j.started_at DESC
      LIMIT ?
    `
    return db.query(sql, [limit])
  },

  delete: (id: string) => {
    const sql = `DELETE FROM import_job WHERE id = ?`
    return db.query(sql, [id])
  },
}

export default importDao
