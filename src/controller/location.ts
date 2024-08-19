import { Hono } from 'hono'

import dao from 'dao'
import utils from '@core/utils'

const location = new Hono<{ Bindings: Bindings; Variables: Variables }>()

location.get('/filter', async (c) => {
  const user = c.get('user')
  const out: any = {
    categories: {},
    countries: {},
  }

  const countryRaw = await dao.country.getList()
  countryRaw.forEach((item: any) => (out.countries[item.id] = item.name))

  const categoryRaw = await dao.category.getList()
  categoryRaw.forEach((item: any) => (out.categories[item.id] = item.name))

  if (utils.isSuperUser(user)) {
    out.sources = {}
    const sourceRaw = await dao.source.getList()
    sourceRaw.forEach((item: any) => (out.sources[item.name] = item.name))
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

  const count = await dao.location.getCount(filters)
  const list = await dao.location.getList(filters)

  list.forEach((item: any) => {
    item.id = utils.encrypt(item.id.toString(), 'location')
    item.fids = item.fids?.split(',').map((fid: number) => utils.encrypt(fid.toString(), 'favorite'))
    if (!item.fids) item.fids = []
  })

  return { count: count.total, list }
}

location.post('/p/:page{[0-9]+}', async (c) => {
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
