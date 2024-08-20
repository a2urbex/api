let db: db

const user = {
  init: (db1: db) => {
    db = db1
  },

  get: (id: number) => {
    const sql = `SELECT id, email, firstname, lastname, about, youtube, tiktok, instagram, image, banner FROM user WHERE id = ?`
    return db.query(sql, [id], 0)
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

  getFavoriteSearch: (ids: number[], str: string) => {
    const sql = `SELECT id, firstname, image FROM user WHERE id IN (?) AND firstname LIKE ? LIMIT 10`
    return db.query(sql, [ids, `%${str}%`])
  },
  getFriendSearch: (ids: number[], str: string) => {
    const sql = `SELECT id, firstname, image FROM user WHERE id NOT IN (?) AND firstname LIKE ? LIMIT 10`
    return db.query(sql, [ids, `%${str}%`])
  },
}

export default user
