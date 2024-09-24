import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import dao from 'dao'
import utils from '@core/utils'

import locationService from 'service/location'
import geocoderService from 'service/geocoder'
import config from 'config'

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

location.post('/', async (c) => {
  const user = c.get('user')
  const body: any = await c.req.parseBody()

  const country = await geocoderService.getCountry(body.lat, body.lon)
  const image = await utils.saveImage(body.image, config.image.location)

  await dao.location.add(body.name, body.description, image, body.lat, body.lon, body.categoryId, country.id, user.id)

  return c.json({})
})
location.put('/:id', async (c) => {})
location.delete('/:id', async (c) => {})

export default location
