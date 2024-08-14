let db: db

const country = {
  init: (db1: db) => {
    db = db1
  },

  getList: () => {
    const sql = `SELECT id, name FROM country`
    return db.query(sql)
  },
}

export default country
