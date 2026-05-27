let db: db

const source = {
  init: (db1: db) => {
    db = db1
  },

  getList: () => {
    const sql = `SELECT id, name FROM source ORDER BY name ASC`
    return db.query(sql)
  },

  getListWithCounts: async () => {
    const sources: any[] = await db.query(`SELECT id, name FROM source ORDER BY name ASC`)
    if (!sources.length) return []
    const counts: any[] = await db.query(
      `SELECT source AS name, COUNT(*) AS c
       FROM location
       WHERE source IS NOT NULL AND dedup_removed_at IS NULL
       GROUP BY source`
    )
    const byName: Record<string, number> = {}
    for (const row of counts) byName[row.name] = Number(row.c)
    return sources.map((s) => ({ ...s, location_count: byName[s.name] || 0 }))
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
