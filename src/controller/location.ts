import { Hono } from 'hono'

import dao from 'dao'
import utils from '@core/utils'

const location = new Hono<{ Bindings: Bindings; Variables: Variables }>()

location.get('/filter', async (c) => {
  const user = c.get('user')
  const out: any = {
    category: {},
    country: {},
  }

  const countryRaw = await dao.country.getList()
  countryRaw.forEach((item: any) => (out.country[item.id] = item.name))

  const categoryRaw = await dao.category.getList()
  categoryRaw.forEach((item: any) => (out.category[item.id] = item.name))

  if (utils.isSuperUser(user)) {
    out.source = {}
    const sourceRaw = await dao.source.getList()
    sourceRaw.forEach((item: any) => (out.source[item.name] = item.name))
  }

  return c.json(out)
})

const getLocations = async (user: User, filters: SearchFilters = {}) => {
  if (!utils.isSuperUser(user)) {
    const friendRaw = await dao.friend.getUserFriends(user.id)
    const friends = friendRaw.map((item: any) => item.friend_id)
    filters.users = [user.id, ...friends]
    delete filters.sources
  }

  const list = await dao.location.getList(filters)
  const out = list.map((item: any) => {
    item.id = utils.encrypt(item.id.toString(), 'location')
    item.fids = item.fids?.split(',').map((fid: number) => utils.encrypt(fid.toString(), 'favorite'))
    return item
  })

  return out
}

location.post('/:page{[0-9]+}', async (c) => {
  const user = c.get('user')
  const page = parseInt(c.req.param('page'))
  const { string, categories, countries, sources } = await c.req.json()

  const data = await getLocations(user, { string, categories, countries, sources, page })
  return c.json(data)
})

location.post('/', async (c) => {
  const user = c.get('user')
  const { string, categories, countries, sources } = await c.req.json()

  const data = await getLocations(user, { string, categories, countries, sources })
  return c.json(data)
})

export default location
