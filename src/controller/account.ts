import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import bcrypt from 'bcrypt'

import dao from 'dao'
import utils from '@core/utils'
import config from 'config'

import { authMiddleware, getUser } from 'service/middleware'
import geocoderService from 'service/geocoder'
import { countryFromIp } from 'service/ipCountry'

const account = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /account/:id
 * @description Get account page
 *
 * route @param {string} id - User encoded id
 *
 * @returns {} -- see return c.json() below
 */
account.get('/:id{[0-9a-z]{24,}}', async (c) => {
  const user = getUser(c)
  const encryptedId = c.req.param('id')
  const id = parseInt(utils.decrypt(encryptedId, 'user'))

  const userData = await dao.user.get(id)
  const locationCount = await dao.location.getUserCount(id)
  const friendCount = await dao.friend.getUserFriendsCount(id)
  const isFriend = await dao.friend.isFriend(user?.id, id)
  const images = await dao.location.getImages(id)

  return c.json({
    username: userData.username,
    about: userData.about,
    youtube: userData.youtube,
    tiktok: userData.tiktok,
    instagram: userData.instagram,
    image: utils.getImageUrl(userData.image),
    banner: utils.getImageUrl(userData.banner),
    urbexCount: locationCount.total,
    friendCount: friendCount.total,
    friendStatus: isFriend,
    images: images.map((v: any) => v.image),
    roles: Array.isArray(userData.roles)
      ? userData.roles
      : JSON.parse(userData.roles || '[]'),
  })
})

/**
 * Auth middleware to verify if the user is logged in for all routes below
 */
account.use(authMiddleware)

/**
 * GET /
 * @description Get user base info
 *
 * @returns {{id: string, username: string, image: string, isAdmin: boolean}}
 */
account.get('/', async (c) => {
  const user = c.get('user')

  const userData = await dao.user.get(user.id)

  return c.json({
    id: utils.encrypt(user.id.toString(), 'user'),
    username: userData.username,
    image: userData.image,
    isAdmin: utils.isAdmin(user),
  })
})

/**
 * GET /details
 * @description Get user info
 *
 * @returns {} -- see return c.json() below
 */
account.get('/details', async (c) => {
  const user = c.get('user')

  const userData = await dao.user.get(user.id)

  return c.json({
    email: userData.email,
    username: userData.username,
    about: userData.about,
    youtube: userData.youtube,
    tiktok: userData.tiktok,
    instagram: userData.instagram,
    image: userData.image,
    banner: userData.banner,
  })
})

/**
 * PUT /
 * @description Edit profile
 *
 * formData @param {string} about - About
 * formData @param {string} youtube - Youtube
 * formData @param {string} Tiktok - Tiktok
 * formData @param {string} instagram - Instagram
 * formData @param {File} image - Optional - Image
 * formData @param {File} banner - Optional - Banner
 */
account.put('/', async (c) => {
  const user = c.get('user')
  const body: any = await c.req.parseBody()

  const userData = await dao.user.get(user.id)

  let image: string | null = null
  let banner: string | null = null

  if (body.image) {
    if (userData.image) await utils.deleteImage(userData.image)
    image = await utils.saveImage(body.image, config.path.user)
  }

  if (body.banner) {
    if (userData.banner) await utils.deleteImage(userData.banner)
    banner = await utils.saveImage(body.banne, config.path.user)
  }

  await dao.user.update(user.id, body.about, body.youtube, body.tiktok, body.instagram, image, banner)

  return c.json({})
})

/**
 * GET /account/country
 * @description Resolve the default country: account setting > GPS (lat/lon) > IP > Accept-Language > FR
 *
 * query @param {number} lat - Optional - only sent when the browser already granted geolocation
 * query @param {number} lon - Optional
 *
 * @returns {{ setting: string|null, code: string, countryId: number|null, source: string, countries: {code: string, name: string}[] }}
 */
account.get('/country', async (c) => {
  const user = c.get('user')
  const row = await dao.user.getDefaultCountry(user.id)
  const setting: string | null = row?.default_country || null

  let code = setting
  let source = 'account'
  let countryId: number | null = null

  if (!code) {
    const lat = parseFloat(c.req.query('lat') || '')
    const lon = parseFloat(c.req.query('lon') || '')
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const found = await geocoderService.getCountry(lat, lon)
      if (found) [code, countryId, source] = [found.code, found.id, 'geolocation']
    }
  }

  if (!code) {
    const fromIp = await countryFromIp(c)
    if (fromIp) [code, source] = [fromIp, 'ip']
  }

  if (!code) {
    const region = (c.req.header('accept-language') || '').match(/^[a-z]{2,3}-([A-Z]{2})/i)?.[1]?.toUpperCase()
    if (region) [code, source] = [region, 'language']
  }

  const countries = await dao.country.getListWithCode()
  if (!countryId) countryId = countries.find((x: any) => x.code === code)?.id ?? null
  if (!countryId) {
    code = 'FR'
    source = 'default'
    countryId = countries.find((x: any) => x.code === 'FR')?.id ?? null
  }

  return c.json({ setting, code, countryId, source, countries: countries.map((x: any) => ({ code: x.code, name: x.name })) })
})

/**
 * PUT /account/country
 * @description Set default country (null = Auto)
 *
 * body @param {string|null} code - ISO alpha-2 code
 */
account.put('/country', async (c) => {
  const user = c.get('user')
  const { code } = await c.req.json()
  const value = typeof code === 'string' && /^[A-Z]{2}$/.test(code) ? code : null

  await dao.user.setDefaultCountry(user.id, value)
  return c.json({ setting: value })
})

/**
 * PUT /password
 * @description Edit password
 *
 * formData @param {string} password - Password
 * formData @param {string} newPassword - newPassword
 */
account.put('/password', async (c) => {
  const user = c.get('user')
  const body: any = await c.req.parseBody()

  const current = await dao.user.getPassword(user.id)

  const match = await bcrypt.compare(config.password.secret + body.password, current.password)
  if (!match) throw new HTTPException(403, { message: 'Invalid password' })

  const verify = utils.validator.password(body.newPassword)
  if (!verify) throw new HTTPException(400, { message: 'Invalid new password' })

  const hash = await bcrypt.hash(config.password.secret + body.newPassword, config.password.salt)
  await dao.user.updatePassword(user.id, hash)

  return c.json({})
})

export default account
