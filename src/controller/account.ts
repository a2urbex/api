import { Hono } from 'hono'

import dao from 'dao'
import utils from '@core/utils'

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

export default account
