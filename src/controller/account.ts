import { Hono } from 'hono'

import dao from 'dao'
import utils from '@core/utils'

import { authMiddleware, getUser } from 'service/middleware'

const account = new Hono<{ Bindings: Bindings; Variables: Variables }>()

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

account.use(authMiddleware)

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

account.get('/details', async (c) => {
  const user = c.get('user')

  const userData = await dao.user.get(user.id)
  return c.json(userData)
})

export default account
