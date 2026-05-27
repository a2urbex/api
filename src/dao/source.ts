let db: db

const source = {
  init: (db1: db) => {
    db = db1
  },

  getList: () => {
    const sql = `SELECT id, name FROM source ORDER BY name ASC`
    return db.query(sql)
  },

  getListWithCounts: () => {
    const sql = `
      SELECT s.id, s.name, COUNT(l.id) AS location_count
      FROM source s
      LEFT JOIN location l ON l.source = s.name AND l.dedup_removed_at IS NULL
      GROUP BY s.id, s.name
      ORDER BY s.name ASC
    `
    return db.query(sql)
  },

  getById: (id: number) => {
    const sql = `SELECT id, name FROM source WHERE id = ? LIMIT 1`
    return db.query(sql, [id], 0)
  },

  getByName: (name: string) => {
    const sql = `SELECT id, name FROM source WHERE LOWER(name) = LOWER(?) LIMIT 1`
    return db.query(sql, [name], 0)
  },

  create: (name: string) => {
    const sql = `INSERT INTO source (name) VALUES (?)`
    return db.query(sql, [name])
  },

  rename: (id: number, newName: string) => {
    const sql = `UPDATE source SET name = ? WHERE id = ?`
    return db.query(sql, [newName, id])
  },

  delete: (id: number) => {
    const sql = `DELETE FROM source WHERE id = ?`
    return db.query(sql, [id])
  },

  countLocations: (name: string) => {
    const sql = `SELECT COUNT(*) AS c FROM location WHERE source = ? AND dedup_removed_at IS NULL`
    return db.query(sql, [name], 0)
  },

  renameLocations: (oldName: string, newName: string) => {
    const sql = `UPDATE location SET source = ? WHERE source = ?`
    return db.query(sql, [newName, oldName])
  },
}

export default source
