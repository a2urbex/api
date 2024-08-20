import utils from '@core/utils'
import dao from 'dao'
import userService from './user'

const locationService = {
  getLocations: async (user: User, filters: SearchFilters = {}) => {
    if (!utils.isSuperUser(user)) {
      const friends = await userService.getFriends(user.id)
      filters.users = [user.id, ...friends]
      delete filters.sources
    }

    const count = await dao.location.getCount(filters)
    const list = await dao.location.getList(filters, user.id)

    return { count: count.total, list: list.map((item: any) => locationService.formatLocation(item)) }
  },

  formatLocation: (item: any) => {
    item.id = utils.encrypt(item.id.toString(), 'location')
    item.fids = item.fids?.split(',').map((fid: number) => utils.encrypt(fid.toString(), 'favorite'))
    item.image = utils.getImageUrl(item.image)
    if (!item.fids) item.fids = []

    return item
  },

  hasAccess: async (locationId: number, user: User) => {
    if (utils.isSuperUser(user)) return true

    const friends = await userService.getFriends(user.id)
    const location = await dao.location.getUser(locationId)

    return friends.includes(location.user_id)
  },
}

export default locationService
