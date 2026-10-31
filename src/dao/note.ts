let db: db

// Notes privées sur les points (superusers → admins)
const note = {
  init: (db1: db) => {
    db = db1
  },

  /** Notes d'un point : toutes (null, admin) ou celles des personnes listées */
  getForLocation: (locationId: number, userIds: number[] | null) => {
    const sql = `
      SELECT n.id, n.body, n.created_at createdAt, n.updated_at updatedAt, u.id userId, u.username, u.image
      FROM location_note n
      JOIN user u ON u.id = n.user_id
      WHERE n.location_id = ? ${userIds ? 'AND n.user_id IN (?)' : ''}
      ORDER BY n.updated_at DESC
    `
    return db.query(sql, userIds ? [locationId, userIds.length ? userIds : [0]] : [locationId])
  },

  /** Crée ou remplace la note de userId sur ce point */
  upsert: (locationId: number, userId: number, body: string) => {
    const sql = `INSERT INTO location_note (location_id, user_id, body) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE body = VALUES(body)`
    return db.query(sql, [locationId, userId, body])
  },

  getById: (id: number) => {
    return db.query(`SELECT id, location_id locationId, user_id userId FROM location_note WHERE id = ?`, [id], 0)
  },

  delete: (id: number) => {
    return db.query(`DELETE FROM location_note WHERE id = ?`, [id])
  },
}

export default note
