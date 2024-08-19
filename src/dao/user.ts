let db: db

const user = {
  init: (db1: db) => {
    db = db1
  },

  exist: (email: string) => {
    const sql = `SELECT id, email, password, roles, old FROM user WHERE email = ?`
    return db.query(sql, [email], 0)
  },

  add: (email: string, password: string, firstname: string, lastname: string) => {
    const sql = `INSERT INTO user (email, password, firstname, lastname, roles, last_active_at) VALUES (?, ?, ?, ?, "[]", NOW())`
    return db.query(sql, [email, password, firstname, lastname])
  },

  updatePassword: (id: number, password: string, old: number = 0) => {
    const sql = `UPDATE user SET password = ?, old = ? WHERE id = ?`
    return db.query(sql, [password, old, id])
  },
}

export default user
