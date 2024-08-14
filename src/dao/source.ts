let db: db

const source = {
  init: (db1: db) => {
    db = db1
  },

  getList: () => {
    const sql = `SELECT id, name FROM source`
    return db.query(sql)
  },
}

export default source
