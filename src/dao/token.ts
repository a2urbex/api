let db: db

const token = {
  init: (db1: db) => {
    db = db1
  },

  add: (type: string, value: string, validity: Date, userId: number | null = null) => {
    const sql = `INSERT INTO token (type, value, validity, user_id) VALUES (?, ?, ?, ?)`
    return db.query(sql, [type, value, validity, userId])
  },

  get: (type: string, value: string) => {
    const sql = `SELECT id, user_id FROM token WHERE type = ? AND value = ? AND validity > NOW()`
    return db.query(sql, [type, value], 0)
  },

  delete: (id: number) => {
    const sql = `DELETE FROM token WHERE id = ?`
    return db.query(sql, [id])
  },
}

export default token
