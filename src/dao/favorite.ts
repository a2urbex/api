let db: db

const favorite = {
  init: (db1: db) => {
    db = db1
  },

  getList: (userId: number) => {
    const sql = `
      SELECT f.id, f.name, COUNT(fl.favorite_id) count FROM favorite f
      LEFT JOIN favorite_user fu ON fu.favorite_id = f.id
      LEFT JOIN favorite_location fl ON fl.favorite_id = f.id
      WHERE fu.user_id = ?
      GROUP BY f.id
    `
    return db.query(sql, [userId])
  },

  get: (id: number, userId: number) => {
    const sql = `
      SELECT f.id, f.name, f.master, f.share, f.disabled, (CASE WHEN fu.user_id = ? THEN 1 ELSE 0 END) hasAccess
      FROM favorite f
      LEFT JOIN favorite_user fu ON fu.favorite_id = f.id
      WHERE f.id = ?
      GROUP BY f.id
    `
    return db.query(sql, [userId, id], 0)
  },
}

export default favorite
