import config from 'config'

let db: db

/**
 * Statut vu par une personne : le plus récent parmi le statut global (admins, colonnes de location)
 * et les statuts personnels qu'elle a le droit de voir (statusScope : 'all' pour un admin,
 * sinon [elle, ses amis] ; vide = global seulement).
 */
const statusJoin = (scope: number[] | 'all' | undefined): [string, any[]] => {
  const who = scope === 'all' ? '' : 'WHERE s.user_id IN (?)'
  const ids = scope === 'all' ? [] : [scope?.length ? scope : [0]]
  const sql = `
    LEFT JOIN (
      SELECT s.location_id, s.status, s.rating, s.invalid_reason, s.danger, s.visited_at
      FROM location_status s
      JOIN (SELECT s.location_id, MAX(s.visited_at) m FROM location_status s ${who} GROUP BY s.location_id) x
        ON x.location_id = s.location_id AND x.m = s.visited_at
      ${who}
    ) ps ON ps.location_id = l.id`
  return [sql, [...ids, ...ids]]
}
const PS_NEWER = '(ps.visited_at IS NOT NULL AND (l.visited_at IS NULL OR ps.visited_at >= l.visited_at))'
const eff = (col: string) => `(CASE WHEN ${PS_NEWER} THEN ps.${col} ELSE l.${col} END)`
// MAX() : requêtes groupées par point (only_full_group_by) ; un seul statut retenu par point, l'agrégat ne change rien
const EFF_FIELDS = `MAX(${eff('status')}) status, MAX(${eff('rating')}) rating, MAX(${eff('invalid_reason')}) invalidReason, MAX(${eff('danger')}) danger, MAX(${eff('visited_at')}) visitedAt`

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

    if (filters.excludedSources?.length) {
      WHERE += ' AND (l.source IS NULL OR l.source NOT IN (?))'
      params.push(filters.excludedSources)
    }

    if (filters.favoriteId) {
      WHERE += ' AND fl.favorite_id = ?'
      params.push(filters.favoriteId)
    }

    if (filters.bbox) {
      WHERE += ' AND l.lat BETWEEN ? AND ? AND l.lon BETWEEN ? AND ?'
      params.push(filters.bbox[0], filters.bbox[2], filters.bbox[1], filters.bbox[3])
    }

    if (filters.statuses?.length) {
      WHERE += ` AND ${eff('status')} IN (?)`
      params.push(filters.statuses)
    }

    if (filters.ratings?.length) {
      WHERE += ` AND ${eff('rating')} IN (?)`
      params.push(filters.ratings)
    }

    if (filters.dateFrom) {
      WHERE += ' AND l.date_add >= ?'
      params.push(new Date(filters.dateFrom))
    }

    if (filters.dateTo) {
      WHERE += ' AND l.date_add <= ?'
      params.push(new Date(filters.dateTo))
    }

    if (!filters.showInvalid) WHERE += ` AND ${eff('status')} <> 'invalid'`

    if (filters.page) {
      LIMIT += `LIMIT ${config.pageSize * (filters.page - 1)}, ${config.pageSize}`
    }

    return [WHERE, params, LIMIT]
  },

  get: (id: number, userId: number, scope?: number[] | 'all') => {
    const [JOIN, joinParams] = statusJoin(scope)
    const sql = `
      SELECT l.id, l.user_id userId, l.disabled, l.image, l.image_maps, l.lat, l.lon, l.name, ${EFF_FIELDS}, l.date_add dateAdd, c.name categoryName, c.icon categoryIcon, c.color categoryColor,
        u.username userUsername, u.image userImage, u.roles userRoles,
        GROUP_CONCAT(CASE WHEN fu.user_id = ? THEN fl.favorite_id ELSE NULL END) fids
      FROM location l
      LEFT JOIN category c ON c.id = l.category_id
      LEFT JOIN user u ON u.id = l.user_id
      LEFT JOIN favorite_location fl ON fl.location_id = l.id
      LEFT JOIN favorite_user fu ON fu.favorite_id = fl.favorite_id
      ${JOIN}
      WHERE l.id = ? AND l.dedup_removed_at IS NULL
      GROUP BY l.id
    `

    return db.query(sql, [userId, ...joinParams, id], 0)
  },

  getRaw: (id: number) => {
    const sql = `SELECT * FROM location WHERE id = ?`
    return db.query(sql, [id], 0)
  },

  getList: (filters: SearchFilters, userId: number | null) => {
    const [WHERE, params, LIMIT] = location.getFilters(filters)
    const [JOIN, joinParams] = statusJoin(filters.statusScope)

    const sql = `
      SELECT l.id, l.user_id userId, l.disabled, l.image, l.image_maps, l.lat, l.lon, l.name, ${EFF_FIELDS}, l.date_add dateAdd, c.name categoryName, c.icon categoryIcon, c.color categoryColor,
        u.username userUsername, u.image userImage, u.roles userRoles,
        GROUP_CONCAT(CASE WHEN fu.user_id = ? THEN fl.favorite_id ELSE NULL END) fids
      FROM location l
      LEFT JOIN category c ON c.id = l.category_id
      LEFT JOIN user u ON u.id = l.user_id
      LEFT JOIN favorite_location fl ON fl.location_id = l.id
      LEFT JOIN favorite_user fu ON fu.favorite_id = fl.favorite_id
      ${JOIN}
      WHERE 1 ${WHERE} AND l.lat IS NOT NULL AND l.lon IS NOT NULL AND l.dedup_removed_at IS NULL
      GROUP BY l.id
      ORDER BY id DESC
      ${LIMIT}
    `

    return db.query(sql, [userId, ...joinParams, ...params])
  },

  getCount: (filters: SearchFilters) => {
    const [WHERE, params] = location.getFilters(filters)
    const [JOIN, joinParams] = statusJoin(filters.statusScope)

    const sql = `SELECT COUNT(DISTINCT l.id) total FROM location l LEFT JOIN favorite_location fl ON fl.location_id = l.id ${JOIN} WHERE 1 ${WHERE} AND l.dedup_removed_at IS NULL`

    return db.query(sql, [...joinParams, ...params], 0)
  },

  // Weekly import counts (Monday-based weeks) for the date slider histogram
  getImportHistogram: (filters: SearchFilters) => {
    const [WHERE, params] = location.getFilters({ ...filters, dateFrom: undefined, dateTo: undefined, page: undefined })
    const [JOIN, joinParams] = statusJoin(filters.statusScope)
    const sql = `
      SELECT DATE_FORMAT(DATE_SUB(DATE(l.date_add), INTERVAL WEEKDAY(l.date_add) DAY), '%Y-%m-%d') week, COUNT(DISTINCT l.id) total
      FROM location l
      ${JOIN}
      WHERE 1 ${WHERE} AND l.date_add IS NOT NULL AND l.lat IS NOT NULL AND l.dedup_removed_at IS NULL
      GROUP BY week
      ORDER BY week
    `
    return db.query(sql, [...joinParams, ...params])
  },

  getUserList: (userId: number) => {
    return location.getList({ users: [userId] }, userId)
  },
  getUserCount: (userId: number) => {
    return location.getCount({ users: [userId] })
  },

  getUser: (id: number) => {
    const sql = `SELECT user_id FROM location WHERE id = ?`
    return db.query(sql, [id], 0)
  },

  getImages: (userId: number) => {
    const sql = `SELECT image FROM location l WHERE user_id = ?`
    return db.query(sql, [userId])
  },

  findNearbyByName: (name: string, lat: number, lon: number, deltaDeg: number = 0.0005) => {
    const sql = `SELECT id FROM location
                 WHERE name = ?
                   AND lat BETWEEN ? AND ?
                   AND lon BETWEEN ? AND ?
                   AND dedup_removed_at IS NULL
                 LIMIT 1`
    return db.query(sql, [name, lat - deltaDeg, lat + deltaDeg, lon - deltaDeg, lon + deltaDeg], 0)
  },

  updateCoreFields: (
    id: number,
    name: string,
    description: string,
    lat: number,
    lon: number,
    categoryId: number | null,
    image: string | null = null,
    source: string | null = null,
  ) => {
    const extraSql: string[] = []
    const extraParams: any[] = []
    if (image) {
      extraSql.push('image = ?')
      extraParams.push(image)
    }
    if (source !== null) {
      extraSql.push('source = ?')
      extraParams.push(source)
    }
    const extra = extraSql.length ? ', ' + extraSql.join(', ') : ''
    const sql = `UPDATE location SET name = ?, description = ?, lat = ?, lon = ?, category_id = ?${extra} WHERE id = ?`
    return db.query(sql, [name, description, lat, lon, categoryId, ...extraParams, id])
  },

  add: (
    name: string,
    description: string,
    image: string,
    lat: number,
    lon: number,
    categoryId: number,
    countryId: number,
    userId: number | null = null,
    source: string | null = null,
  ) => {
    const sql = `INSERT INTO location (name, description, image, lat, lon, category_id, country_id, user_id, source, date_add)
                 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
    return db.query(sql, [name, description, image, lat, lon, categoryId, countryId, userId, source])
  },

  update: (
    id: number,
    name: string,
    description: string,
    image: string,
    lat: number,
    lon: number,
    categoryId: number,
    countryId: number,
  ) => {
    const sql = `UPDATE location SET name = ?, description = ?, image = ?, lat = ?, lon = ?, category_id = ?, country_id = ? WHERE id = ?`
    return db.query(sql, [name, description, image, lat, lon, categoryId, countryId, id])
  },

  delete: (id: number) => {
    const sql = `DELETE FROM location WHERE id = ?`
    return db.query(sql, [id])
  },

  addPinterest: (
    pid: number,
    source: string,
    url: string,
    lat: number | null,
    lon: number | null,
    name: string | null,
    description: string | null,
    imageDirect: string | null,
    countryId: number | null,
    categoryId: number | null,
  ) => {
    const sql = `INSERT INTO location (pid, source, url, lat, lon, name, description, image, country_id, category_id, date_add) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
    return db.query(sql, [pid, source, url, lat, lon, name, description, imageDirect, countryId, categoryId])
  },

  setStatus: (id: number, status: string, rating: string | null, reason: string | null, danger: boolean) => {
    const sql = `UPDATE location SET status = ?, rating = ?, invalid_reason = ?, danger = ?, visited_at = NOW() WHERE id = ?`
    return db.query(sql, [status, rating, reason, danger ? 1 : 0, id])
  },

  // Masque un point pour tout le monde (même mécanisme que la déduplication, récupérable)
  hide: (id: number) => {
    return db.query(`UPDATE location SET dedup_removed_at = NOW() WHERE id = ?`, [id])
  },

  // Statut personnel (non-admin) : remplace le précédent de cette personne sur ce point
  setPersonalStatus: (id: number, userId: number, status: string, rating: string | null, reason: string | null, danger: boolean) => {
    const sql = `INSERT INTO location_status (location_id, user_id, status, rating, invalid_reason, danger, visited_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE status = VALUES(status), rating = VALUES(rating), invalid_reason = VALUES(invalid_reason), danger = VALUES(danger), visited_at = NOW()`
    return db.query(sql, [id, userId, status, rating, reason, danger ? 1 : 0])
  },

  addVisit: (id: number, userId: number, status: string, rating: string | null, reason: string | null, danger: boolean) => {
    const sql = `INSERT INTO location_visit (location_id, user_id, status, rating, invalid_reason, danger) VALUES (?, ?, ?, ?, ?, ?)`
    return db.query(sql, [id, userId, status, rating, reason, danger ? 1 : 0])
  },

  // ~30 m box; used by importers so invalid points are never recreated
  findInvalidNear: (lat: number, lon: number, deltaDeg: number = 0.00027) => {
    const sql = `SELECT id FROM location
                 WHERE status = 'invalid' AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
                 LIMIT 1`
    return db.query(sql, [lat - deltaDeg, lat + deltaDeg, lon - deltaDeg, lon + deltaDeg], 0)
  },

  // Any point (any source) within ~40 m: one point per place, not one per photo
  findNear: (lat: number, lon: number, deltaDeg: number = 0.00036) => {
    const sql = `SELECT id FROM location
                 WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? AND dedup_removed_at IS NULL
                 LIMIT 1`
    return db.query(sql, [lat - deltaDeg, lat + deltaDeg, lon - deltaDeg, lon + deltaDeg], 0)
  },

  addImported: (r: {
    pid: number
    source: string
    url: string
    lat: number
    lon: number
    name: string
    description: string | null
    image: string
    imageUrl: string
    credit: string | null
    license: string | null
    countryId: number | null
    categoryId: number | null
  }) => {
    const sql = `INSERT INTO location (pid, source, url, lat, lon, name, description, image, image_url, image_credit, image_license, country_id, category_id, date_add)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
    return db.query(sql, [r.pid, r.source, r.url.slice(0, 255), r.lat, r.lon, r.name.slice(0, 250), r.description, r.image, r.imageUrl.slice(0, 512), r.credit?.slice(0, 255) ?? null, r.license?.slice(0, 64) ?? null, r.countryId, r.categoryId])
  },

  getByPid: (pid: number, source: string) => {
    const sql = `SELECT id FROM location WHERE pid = ? AND source = ?`
    return db.query(sql, [pid, source], 0)
  },
}

export default location
