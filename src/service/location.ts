import { HTTPException } from 'hono/http-exception'

import utils from '@core/utils'
import dao from 'dao'

const EARTH_R = 6371000
const toRad = (d: number) => (d * Math.PI) / 180

const zoneBbox = (zone: Zone): [number, number, number, number] => {
  if (zone.type === 'circle') {
    const dLat = (zone.radius / EARTH_R) * (180 / Math.PI)
    const dLon = dLat / Math.max(Math.cos(toRad(zone.lat)), 0.01)
    return [zone.lat - dLat, zone.lon - dLon, zone.lat + dLat, zone.lon + dLon]
  }
  const lats = zone.points.map((p) => p[0])
  const lons = zone.points.map((p) => p[1])
  return [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)]
}

const inZone = (zone: Zone, lat: number, lon: number) => {
  if (zone.type === 'circle') {
    const dLat = toRad(lat - zone.lat)
    const dLon = toRad(lon - zone.lon)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(zone.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2
    return 2 * EARTH_R * Math.asin(Math.sqrt(h)) <= zone.radius
  }
  // ray casting
  let inside = false
  const pts = zone.points
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i]
    const [yj, xj] = pts[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const locationService = {
  getLocations: async (user: User | any, filters: SearchFilters = {}, self: boolean = false, zone: Zone | null = null) => {
    if (user) {
      if (self) {
        filters.users = [user.id]
      } else {
        if (!utils.isSuperUser(user)) {
          const friends = await dao.friend.getUserFriends(user.id)
          filters.users = [user.id, ...friends]
          delete filters.sources
          delete filters.excludedSources
        }
      }
    }

    if (zone) {
      filters.bbox = zoneBbox(zone)
      delete filters.page
      const rows = (await dao.location.getList(filters, user?.id)).filter((l: any) => inZone(zone, l.lat, l.lon))
      return { count: rows.length, list: rows.map((item: any) => locationService.formatLocation(item)) }
    }

    const count = await dao.location.getCount(filters)
    const list = await dao.location.getList(filters, user?.id)

    return { count: count.total, list: list.map((item: any) => locationService.formatLocation(item)) }
  },

  parseZone: (zone: any): Zone | null => {
    if (zone?.type === 'circle') {
      const lat = Number(zone.lat), lon = Number(zone.lon), radius = Number(zone.radius)
      if ([lat, lon, radius].every(Number.isFinite) && radius > 0 && radius <= 2000000) return { type: 'circle', lat, lon, radius }
    }
    if (zone?.type === 'polygon' && Array.isArray(zone.points) && zone.points.length >= 3 && zone.points.length <= 500) {
      const points = zone.points.map((p: any) => [Number(p[0]), Number(p[1])] as [number, number])
      if (points.every((p: number[]) => p.every(Number.isFinite))) return { type: 'polygon', points }
    }
    return null
  },

  formatLocation: (item: any) => {
    item.id = utils.encrypt(item.id.toString(), 'location')
    item.fids = item.fids?.split(',').map((fid: number) => utils.encrypt(fid.toString(), 'favorite'))
    item.image = utils.getImageUrl(item.image)
    item.image_maps = utils.getImageUrl(item.image_maps)
    item.userImage = utils.getImageUrl(item.userImage)

    if (!item.fids) item.fids = []
    if (item.userId) item.userId = utils.encrypt(item.userId.toString(), 'user')

    if (item.userRoles !== undefined) {
      if (Array.isArray(item.userRoles)) {
      } else if (typeof item.userRoles === 'string') {
        try {
          item.userRoles = JSON.parse(item.userRoles)
        } catch {
          item.userRoles = []
        }
      } else {
        item.userRoles = []
      }
    }

    return item
  },

  hasAccess: async (locationId: number, user: User) => {
    if (utils.isSuperUser(user)) return

    const friends = await dao.friend.getUserFriends(user.id)
    const location = await dao.location.getUser(locationId)

    const list = [...friends, user.id]
    if (!list.includes(location.user_id)) throw new HTTPException(403, { message: 'Location is private' })
  },
}

export default locationService
