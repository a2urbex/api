let db: db

const country = {
  init: (db1: db) => {
    db = db1
  },

  getList: () => {
    const sql = `SELECT id, name FROM country`
    return db.query(sql)
  },
  getFromCode: (code: string) => {
    const sql = `SELECT * FROM country WHERE code = ?`
    return db.query(sql, [code], 0)
  },

  add: (name: string, code: string) => {
    const sql = `INSERT INTO country (name, code) VALUES (?, ?)`
    return db.query(sql, [name, code])
  },
}

export default country
