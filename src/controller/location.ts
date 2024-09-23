import { Hono } from 'hono'

import dao from 'dao'
import utils from '@core/utils'
import locationService from 'service/location'

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

location.post('/p/:page{[0-9]+}', async (c) => {
  const user = c.get('user')
  const page = parseInt(c.req.param('page'))
  const { string, categories, countries, sources } = await c.req.json()

  const data = await locationService.getLocations(user, { string, categories, countries, sources, page })
  return c.json(data)
})

location.post('/map', async (c) => {
  const user = c.get('user')
  const { string, categories, countries, sources } = await c.req.json()

  const data = await locationService.getLocations(user, { string, categories, countries, sources })
  return c.json(data)
})

location.get('/:id', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const id = parseInt(utils.decrypt(encryptedId, 'location'))

  const item = await dao.location.get(id, user.id)
  return c.json(locationService.formatLocation(item))
})

location.get('/', async (c) => {
  const user = c.get('user')

  const data = await locationService.getLocations(user, {}, true)
  return c.json(data)
})

export default location
