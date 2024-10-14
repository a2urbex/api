import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import dao from 'dao'
import utils from '@core/utils'
import config from 'config'

import { authMiddleware, getUser, locationMiddleware } from 'service/middleware'
import locationService from 'service/location'
import geocoderService from 'service/geocoder'

const location = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /location/:id
 * @description Get a location
 *
 * route @param {string} id - Location encoded id
 *
 * @returns {Location}
 */
location.get('/:id{[0-9a-z]{24,}}', async (c) => {
  const user = getUser(c)
  const encryptedId = c.req.param('id')
  const id = parseInt(utils.decrypt(encryptedId, 'location'))

  const item = await dao.location.get(id, user?.id)
  return c.json(locationService.formatLocation(item))
})

/**
 * Auth middleware to verify if the user is logged in for all routes below
 */
location.use(authMiddleware)

/**
 * GET /location/filter
 * @description Get all filters for search
 *
 * @returns {LocationFilters}
 */
location.get('/filter', async (c) => {
  const user = c.get('user')
  const out: LocationFilters = {
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
    sourceRaw.forEach((item: any) => (out.sources![item.name] = item.name))
  }

  return c.json(out)
})

/**
 * POST /location/p/:page
 * @description Get location list by page
 *
 * route @param {number} page - Location page number
 * body @param {string} string - Optional - Search string
 * body @param {number[]} categories - Optional - Categories ids
 * body @param {number[]} countries - Optional - Countries ids
 * body @param {string[]} sources - Optional - Sources names
 *
 * @returns {{count: number, list: Location[]}}
 */
location.post('/p/:page{[0-9]+}', async (c) => {
  const user = c.get('user')
  const page = parseInt(c.req.param('page'))
  const { string, categories, countries, sources } = await c.req.json()

  const data = await locationService.getLocations(user, { string, categories, countries, sources, page })
  return c.json(data)
})

/**
 * POST /location/p/:page
 * @description Get map locations
 *
 * body @param {string} string - Optional - Search string
 * body @param {number[]} categories - Optional - Categories ids
 * body @param {number[]} countries - Optional - Countries ids
 * body @param {string[]} sources - Optional - Sources names
 *
 * @returns {{count: number, list: Location[]}}
 */
location.post('/map', async (c) => {
  const user = c.get('user')
  const { string, categories, countries, sources } = await c.req.json()

  const data = await locationService.getLocations(user, { string, categories, countries, sources })
  return c.json(data)
})

/**
 * GET /location
 * @description Get user locations
 *
 * @returns {{count: number, list: Location[]}}
 */
location.get('/', async (c) => {
  const user = c.get('user')

  const data = await locationService.getLocations(user, {}, true)
  return c.json(data)
})

/**
 * POST /location
 * @description Add location
 *
 * formData @param {string} name - Name
 * formData @param {string} description - Description
 * formData @param {number} lat - Latitude
 * formData @param {number} lon - Longitude
 * formData @param {number} categoryId - Category id
 * formData @param {File} image - Optional - Image
 */
location.post('/', async (c) => {
  const user = c.get('user')
  const body: any = await c.req.parseBody()

  const country = await geocoderService.getCountry(body.lat, body.lon)

  let image: any = null
  if (body.image) image = await utils.saveImage(body.image, config.path.location)

  await dao.location.add(body.name, body.description, image, body.lat, body.lon, body.categoryId, country?.id, user.id)

  return c.json({})
})

/**
 * PUT /location/:id
 * @description Edit location
 *
 * route @param {string} id - Location encoded id
 * formData @param {string} name - Name
 * formData @param {string} description - Description
 * formData @param {number} lat - Latitude
 * formData @param {number} lon - Longitude
 * formData @param {number} categoryId - Category Id
 * formData @param {File} image - Optional - Image
 */
location.put('/:id', locationMiddleware, async (c) => {
  const id = c.get('id')
  const body: any = await c.req.parseBody()

  const loc = await dao.location.getRaw(id)

  let countryId = loc.country_id
  if (parseFloat(body.lat) !== loc.lat || parseFloat(body.lon) !== loc.lon) {
    const country = await geocoderService.getCountry(body.lat, body.lon)
    countryId = country?.id
  }

  let image = loc.image
  if (body.image) {
    await utils.deleteImage(image)
    image = await utils.saveImage(body.image, config.path.location)
  }

  await dao.location.update(id, body.name, body.description, image, body.lat, body.lon, body.categoryId, countryId)

  return c.json({})
})

/**
 * POST /location
 * @description Add location
 *
 * route @param {string} id - Location encoded id
 */
location.delete('/:id', locationMiddleware, async (c) => {
  const id = c.get('id')

  const loc = await dao.location.getRaw(id)

  await utils.deleteImage(loc.image)
  await dao.location.delete(id)
  await dao.favorite.deleteLocations(id)

  return c.json({})
})

export default location
