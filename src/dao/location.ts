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
      params.push(filters.countries)
    }

    if (filters.sources?.length) {
      WHERE += ' AND l.source IN (?)'
      params.push(filters.sources)
    }

    if (filters.favoriteId) {
      WHERE += ' AND fl.favorite_id = ?'
      params.push(filters.favoriteId)
    }

    if (filters.page) {
      LIMIT += `LIMIT ${config.pageSize * (filters.page - 1)}, ${config.pageSize}`
    }

    return [WHERE, params, LIMIT]
  },

  get: (id: number, userId: number) => {
    const sql = `
      SELECT l.id, l.disabled, l.image, l.lat, l.lon, l.name, c.name categoryName, c.icon categoryIcon, c.color categoryColor, 
        GROUP_CONCAT(CASE WHEN fu.user_id = ? THEN fl.favorite_id ELSE NULL END) fids
      FROM location l
      LEFT JOIN category c ON c.id = l.category_id
      LEFT JOIN favorite_location fl ON fl.location_id = l.id
      LEFT JOIN favorite_user fu ON fu.favorite_id = fl.favorite_id
      WHERE l.id = ?
      GROUP BY l.id
    `

    return db.query(sql, [userId, id], 0)
  },

  getList: (filters: SearchFilters, userId: number) => {
    const [WHERE, params, LIMIT] = location.getFilters(filters)

    const sql = `
      SELECT l.id, l.disabled, l.image, l.lat, l.lon, l.name, c.name categoryName, c.icon categoryIcon, c.color categoryColor,
        GROUP_CONCAT(CASE WHEN fu.user_id = ? THEN fl.favorite_id ELSE NULL END) fids
      FROM location l
      LEFT JOIN category c ON c.id = l.category_id
      LEFT JOIN favorite_location fl ON fl.location_id = l.id
      LEFT JOIN favorite_user fu ON fu.favorite_id = fl.favorite_id
      WHERE 1 ${WHERE}
      GROUP BY l.id
      ${LIMIT}
    `

    return db.query(sql, [userId, ...params])
  },

  getCount: (filters: SearchFilters) => {
    const [WHERE, params] = location.getFilters(filters)

    const sql = `SELECT COUNT(id) total FROM location l LEFT JOIN favorite_location fl ON fl.location_id = l.id WHERE 1 ${WHERE}`

    return db.query(sql, params, 0)
  },

  getUserList: (userId: number) => {
    return location.getList({ users: [userId] }, userId)
  },
  getUserCount: (userId: number) => {
    return location.getCount({ users: [userId] })
  },
}

export default location
