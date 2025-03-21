import { HTTPException } from 'hono/http-exception'

import utils from '@core/utils'
import dao from 'dao'

const locationService = {
  getLocations: async (user: User | any, filters: SearchFilters = {}, self: boolean = false) => {
    if (user) {
      if (self) {
        filters.users = [user.id]
      } else {
        if (!utils.isSuperUser(user)) {
          const friends = await dao.friend.getUserFriends(user.id)
          filters.users = [user.id, ...friends]
          delete filters.sources
        }
      }
    }

    const count = await dao.location.getCount(filters)
    const list = await dao.location.getList(filters, user?.id)

    return { count: count.total, list: list.map((item: any) => locationService.formatLocation(item)) }
  },

  formatLocation: (item: any) => {
    item.id = utils.encrypt(item.id.toString(), 'location')
    item.fids = item.fids?.split(',').map((fid: number) => utils.encrypt(fid.toString(), 'favorite'))
    item.image = utils.getImageUrl(item.image)
    if (!item.fids) item.fids = []
    if (item.userId) item.userId = utils.encrypt(item.userId.toString(), 'user')

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
