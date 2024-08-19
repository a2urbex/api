let db: db

const category = {
  init: (db1: db) => {
    db = db1
  },

  getList: () => {
    const sql = `SELECT id, name FROM category`
    return db.query(sql)
  },
}

export default category
