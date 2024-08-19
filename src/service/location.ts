import utils from '@core/utils'
import dao from 'dao'

const locationService = {
  getLocations: async (user: User, filters: SearchFilters = {}) => {
    if (!utils.isSuperUser(user)) {
      const friendRaw = await dao.friend.getUserFriends(user.id)
      const friends = friendRaw.map((item: any) => item.friend_id)
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
}

export default locationService
