let db: db

const user = {
  init: (db1: db) => {
    db = db1
  },

  get: (id: number) => {
    const sql = `SELECT id, email, username, about, youtube, tiktok, instagram, is_private, image, banner FROM user WHERE id = ?`
    return db.query(sql, [id], 0)
  },

  exist: (email: string) => {
    const sql = `SELECT id, email, password, roles, old, username FROM user WHERE email = ?`
    return db.query(sql, [email], 0)
  },

  add: (email: string, password: string, username: string, roles: string[]) => {
    const sql = `INSERT INTO user (email, password, username, roles, last_active_at) VALUES (?, ?, ?, ?, NOW())`
    return db.query(sql, [email, password, username, JSON.stringify(roles)])
  },

  updatePassword: (id: number, password: string, old: boolean = false) => {
    const sql = `UPDATE user SET password = ?, old = ? WHERE id = ?`
    return db.query(sql, [password, old, id])
  },

  getFavoriteSearch: (ids: number[], str: string) => {
    if (!ids.length) ids.push(0)
    const sql = `SELECT id, username, image FROM user WHERE id IN (?) AND username LIKE ? LIMIT 10`
    return db.query(sql, [ids, `%${str}%`])
  },
  getFriendSearch: (ids: number[], str: string) => {
    if (!ids.length) ids.push(0)
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

  update: (
    id: number,
    about: string,
    youtube: string,
    tiktok: string,
    instagram: string,
    isPrivate: boolean,
    image: string | null = null,
    banner: string | null = null
  ) => {
    let extraSql: string = ''
    const extraParams: string[] = []

    if (image) {
      extraSql += ', image = ?'
      extraParams.push(image)
    }
    if (banner) {
      extraSql += ', banner = ?'
      extraParams.push(banner)
    }

    const sql = `UPDATE user SET about = ?, youtube = ?, tiktok = ?, instagram = ?, is_private${extraSql} WHERE id = ?`
    return db.query(sql, [about, youtube, tiktok, instagram, isPrivate, ...extraParams, id])
  },

  getPassword: (id: number) => {
    const sql = `SELECT password FROM user WHERE id = ?`
    return db.query(sql, [id], 0)
  },
}

export default user
