let db: db

const category = {
  init: (db1: db) => {
    db = db1
  },

  getList: () => {
    return db.query(`SELECT id, name FROM category`)
  },

  getAll: async () => {
    return db
      .query(
        `
        SELECT co.id, co.name, c.id AS category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
          FROM category_option co
          JOIN category c ON c.id = co.category_id
        `,
      )
      .then((rows: any[]) =>
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          category: {
            id: row.category_id,
            name: row.category_name,
            icon: row.category_icon,
            color: row.category_color,
          },
        })),
      )
  },
}

export default category
