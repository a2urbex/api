import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import bcrypt from 'bcrypt'

import dao from 'dao'
import utils from '@core/utils'
import config from 'config'

import { authMiddleware, getUser } from 'service/middleware'

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
    isPrivate: userData.is_private,
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
 * formData @param {boolean} isPrivate - Is private
 * formData @param {File} image - Optional - Image
 * formData @param {File} banner - Optional - Banner
 */
account.put('/', async (c) => {
  const user = c.get('user')
  const { about, youtube, tiktok, instagram, isPrivate, image, banner }: any = await c.req.parseBody()

  const userData = await dao.user.get(user.id)

  let newImage: string | null = null
  let newBanner: string | null = null

  if (image) {
    if (userData.image) await utils.deleteImage(userData.image)
    newImage = await utils.saveImage(image, config.path.user)
  }

  if (banner) {
    if (userData.banner) await utils.deleteImage(userData.banner)
    newBanner = await utils.saveImage(banner, config.path.user)
  }

  await dao.user.update(user.id, about, youtube, tiktok, instagram, isPrivate === 'true', newImage, newBanner)

  return c.json({})
})

/**
 * PUT /password
 * @description Edit password
 *
 * body @param {string} password - Password
 * body @param {string} newPassword - newPassword
 */
account.put('/password', async (c) => {
  const user = c.get('user')
  const { password, newPassword } = await c.req.json()

  const current = await dao.user.getPassword(user.id)

  const match = await bcrypt.compare(config.password.secret + password, current.password)
  if (!match) throw new HTTPException(403, { message: 'Invalid password' })

  const verify = utils.validator.password(newPassword)
  if (!verify) throw new HTTPException(400, { message: 'Invalid new password' })

  const hash = await bcrypt.hash(config.password.secret + newPassword, config.password.salt)
  await dao.user.updatePassword(user.id, hash)

  return c.json({})
})

export default account
