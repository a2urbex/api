let db: db

const favorite = {
  init: (db1: db) => {
    db = db1
  },

  getList: (userId: number) => {
    const sql = `
      SELECT f.id, f.name, f.share, f.disabled, COUNT(fl.favorite_id) count FROM favorite f
      LEFT JOIN favorite_user fu ON fu.favorite_id = f.id
      LEFT JOIN favorite_location fl ON fl.favorite_id = f.id
      WHERE fu.user_id = ?
      GROUP BY f.id
    `
    return db.query(sql, [userId])
  },

  get: (id: number) => {
    const sql = `SELECT f.id, f.name, f.master, f.share, f.disabled FROM favorite f WHERE f.id = ?`
    return db.query(sql, [id], 0)
  },

  add: (name: string, master: boolean = false) => {
    const sql = `INSERT INTO favorite (name, master) VALUES(?, ?)`
    return db.query(sql, [name, master])
  },
  addUser: (id: number, userId: number) => {
    const sql = `INSERT INTO favorite_user (favorite_id, user_id) VALUES (?, ?)`
    return db.query(sql, [id, userId])
  },
  addLocation: (id: number, locationId: number) => {
    const sql = `INSERT INTO favorite_location (favorite_id, location_id) VALUES (?, ?)`
    return db.query(sql, [id, locationId])
  },

  hasLocation: (id: number, locationId: number) => {
    const sql = `SELECT 1 exist FROM favorite_location WHERE favorite_id = ? AND location_id = ?`
    return db.query(sql, [id, locationId], 0)
  },

  deleteLocation: (id: number, locationId: number) => {
    const sql = `DELETE FROM favorite_location WHERE favorite_id = ? AND location_id = ?`
    return db.query(sql, [id, locationId])
  },

  getUsers: async (id: number) => {
    const sql = 'SELECT user_id FROM favorite_user WHERE favorite_id = ?'
    const result = await db.query(sql, [id])

    if (!result) return []
    return result.map((item: any) => item.user_id)
  },
  getUsersInfo: async (id: number) => {
    const sql = `
      SELECT u.id, u.firstname, u.image FROM favorite_user fu
      INNER JOIN user u ON u.id = fu.user_id
      WHERE fu.favorite_id = ?
    `
    return db.query(sql, [id])
  },

  deleteUser: (id: number, userId: number) => {
    const sql = `DELETE FROM favorite_user WHERE favorite_id = ? AND user_id = ?`
    return db.query(sql, [id, userId])
  },

  deleteLocations: (id: number) => {
    const sql = `DELETE FROM favorite_location WHERE favorite_id = ?`
    return db.query(sql, [id])
  },

  delete: (id: number) => {
    const sql = `DELETE FROM favorite WHERE id = ?`
    return db.query(sql, [id])
  },

  disable: (id: number, disabled: boolean) => {
    const sql = `UPDATE favorite SET disabled = ? WHERE id = ?`
    return db.query(sql, [disabled, id])
  },
}

export default favorite
