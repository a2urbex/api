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
 * GET /location/count
 * @description Public endpoint returning the total number of locations
 *
 * @returns {{ total: number }}
 */
location.get('/count', async (c) => {
  const row = await dao.location.getCount({})
  return c.json({ total: row?.total ?? 0 })
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
  const { string, categories, countries, sources, showInvalid } = await c.req.json()

  const data = await locationService.getLocations(user, { string, categories, countries, sources, showInvalid, page })
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
  const { string, categories, countries, sources, showInvalid, statuses, ratings, dateFrom, dateTo, zone } = await c.req.json()

  const filters = { string, categories, countries, sources, showInvalid, statuses, ratings, dateFrom, dateTo }
  const data = await locationService.getLocations(user, filters, false, locationService.parseZone(zone))
  return c.json(data)
})

/**
 * POST /location/histogram
 * @description Weekly import counts for the date slider (same filters as /map, date range ignored)
 *
 * @returns {{week: string, total: number}[]}
 */
location.post('/histogram', async (c) => {
  const user = c.get('user')
  const { string, categories, countries, sources, showInvalid, statuses, ratings } = await c.req.json()
  const filters: SearchFilters = { string, categories, countries, sources, showInvalid, statuses, ratings }

  if (!utils.isSuperUser(user)) {
    filters.users = [user.id, ...(await dao.friend.getUserFriends(user.id))]
    delete filters.sources
  }
  return c.json(await dao.location.getImportHistogram(filters))
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

const RATINGS = ['amazing', 'nice', 'meh', 'empty']
// 'walled' n'est plus proposé mais reste accepté (anciens clients) ; 'bullshit' masque le point aussitôt
const REASONS = ['bullshit', 'walled', 'no_access', 'demolished', 'guarded', 'reused', 'not_found']

/**
 * POST /location/:id/visit
 * @description Field mode: record a visit status. Reason 'bullshit' also hides the point for everyone
 * (soft delete via dedup_removed_at: recoverable, and it still blocks importers from recreating it)
 *
 * body @param {'valid'|'invalid'} status
 * body @param {string} rating - valid only
 * body @param {string} reason - invalid only
 * body @param {boolean} danger
 */
location.post('/:id/visit', async (c) => {
  const user = c.get('user')
  const id = parseInt(utils.decrypt(c.req.param('id'), 'location'))
  const { status, rating, reason, danger } = await c.req.json()

  if (status !== 'valid' && status !== 'invalid') throw new HTTPException(400, { message: 'Invalid status' })
  const r = status === 'valid' && RATINGS.includes(rating) ? rating : null
  const why = status === 'invalid' ? (REASONS.includes(reason) ? reason : 'not_found') : null

  await locationService.hasAccess(id, user)
  await dao.location.setStatus(id, status, r, why, !!danger)
  await dao.location.addVisit(id, user.id, status, r, why, !!danger)

  if (why === 'bullshit') {
    await dao.location.hide(id)
    return c.json({ removed: true })
  }

  const item = await dao.location.get(id, user.id)
  return c.json(item ? locationService.formatLocation(item) : {})
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
