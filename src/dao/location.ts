import config from 'config'

let db: db

const location = {
  init: (db1: db) => {
    db = db1
  },

  getFilters: (filters: SearchFilters) => {
    let WHERE = ''
    let LIMIT = ''
    const params: any = []

    if (filters.string?.length) {
      WHERE += ' AND l.name LIKE ?'
      params.push(`%${filters.string}%`)
    }

    if (filters.users?.length) {
      WHERE += ' AND l.user_id IN (?)'
      params.push(filters.users)
    }

    if (filters.categories?.length) {
      WHERE += ' AND l.category_id IN (?)'
      params.push(filters.categories)
    }

    if (filters.countries?.length) {
      WHERE += ' AND l.country_id IN (?)'
    }

    if (filters.sources?.length) {
      WHERE += ' AND l.source IN (?)'
      params.push(filters.sources)
    }

    if (filters.page) {
      LIMIT += `LIMIT ${config.pageSize * (filters.page - 1)}, ${config.pageSize}`
    }

    return [WHERE, params, LIMIT]
  },

  getList: (filters: SearchFilters) => {
    const [WHERE, params, LIMIT] = location.getFilters(filters)

    const sql = `
      SELECT l.id, l.disabled, l.image, l.lat, l.lon, l.name, c.name categoryName, c.icon categoryIcon, c.color categoryColor, GROUP_CONCAT(fl.favorite_id) fids
      FROM location l
      LEFT JOIN category c ON c.id = l.category_id
      LEFT JOIN favorite_location fl ON fl.location_id = l.id
      WHERE 1 ${WHERE}
      GROUP BY l.id
      ${LIMIT}
    `

    return db.query(sql, params)
  },

  getCount: (filters: SearchFilters) => {
    const [WHERE, params] = location.getFilters(filters)

    const sql = `SELECT COUNT(id) total FROM location l WHERE 1 ${WHERE}`

    return db.query(sql, params, 0)
  },
}

export default location
