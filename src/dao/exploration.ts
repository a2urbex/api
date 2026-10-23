let db: db

const exploration = {
  init: (db1: db) => {
    db = db1
  },

  getActive: (userId: number) => {
    const sql = `
      SELECT e.id, e.favorite_id favoriteId, e.started_at startedAt, e.expires_at expiresAt, f.name
      FROM exploration_session e
      LEFT JOIN favorite f ON f.id = e.favorite_id
      WHERE e.user_id = ? AND e.ended_at IS NULL AND e.expires_at > NOW()
      ORDER BY e.id DESC LIMIT 1
    `
    return db.query(sql, [userId], 0)
  },

  // Sessions past their 12 h window that were never ended
  getExpiredOpen: (userId: number) => {
    const sql = `SELECT id, favorite_id favoriteId FROM exploration_session WHERE user_id = ? AND ended_at IS NULL AND expires_at <= NOW()`
    return db.query(sql, [userId])
  },

  getOpen: (userId: number) => {
    const sql = `SELECT id, favorite_id favoriteId FROM exploration_session WHERE user_id = ? AND ended_at IS NULL`
    return db.query(sql, [userId])
  },

  start: (userId: number, favoriteId: number) => {
    const sql = `INSERT INTO exploration_session (user_id, favorite_id, started_at, expires_at) VALUES (?, ?, NOW(), NOW() + INTERVAL 12 HOUR)`
    return db.query(sql, [userId, favoriteId])
  },

  end: (ids: number[]) => {
    if (!ids.length) return
    const sql = `UPDATE exploration_session SET ended_at = NOW() WHERE id IN (?)`
    return db.query(sql, [ids])
  },
}

export default exploration
