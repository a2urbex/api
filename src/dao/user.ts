let db: db

const user = {
  init: (db1: db) => {
    db = db1
  },

  get: (id: number) => {
    const sql = `SELECT id, email, username, about, youtube, tiktok, instagram, image, banner FROM user WHERE id = ?`
    return db.query(sql, [id], 0)
  },

  exist: (email: string) => {
    const sql = `SELECT id, email, password, roles, old, username FROM user WHERE email = ?`
    return db.query(sql, [email], 0)
  },

  add: (email: string, password: string, username: string) => {
    const sql = `INSERT INTO user (email, password, username, roles, last_active_at) VALUES (?, ?, ?, "[]", NOW())`
    return db.query(sql, [email, password, username])
  },

  updatePassword: (id: number, password: string, old: boolean = false) => {
    const sql = `UPDATE user SET password = ?, old = ? WHERE id = ?`
    return db.query(sql, [password, old, id])
  },

  getFavoriteSearch: (ids: number[], str: string) => {
    const sql = `SELECT id, username, image FROM user WHERE id IN (?) AND username LIKE ? LIMIT 10`
    return db.query(sql, [ids, `%${str}%`])
  },
  getFriendSearch: (ids: number[], str: string) => {
    const sql = `SELECT id, username, image FROM user WHERE id NOT IN (?) AND username LIKE ? LIMIT 10`
    return db.query(sql, [ids, `%${str}%`])
  },

  getAll: () => {
    const sql = `SELECT id, image, username, email, roles FROM user`
    return db.query(sql)
  },

  updateRoles: (id: number, roles: string[]) => {
    const sql = `UPDATE user SET roles = ? WHERE id = ?`
    return db.query(sql, [JSON.stringify(roles), id])
  },

  delete: (id: number) => {
    const sql = `DELETE FROM user WHERE id = ?`
    return db.query(sql, [id])
  },
}

export default user
