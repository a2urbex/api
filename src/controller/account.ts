import { Hono } from 'hono'

import dao from 'dao'
import utils from '@core/utils'

const account = new Hono<{ Bindings: Bindings; Variables: Variables }>()

account.get('/', async (c) => {
  const user = c.get('user')

  const userData = await dao.user.get(user.id)

  return c.json({
    id: utils.encrypt(user.id.toString(), 'user'),
    username: userData.firstname,
    image: userData.image,
    isAdmin: utils.isAdmin(user),
  })
})

account.get('/:id', async (c) => {
  const encryptedId = c.req.param('id')
  const id = parseInt(utils.decrypt(encryptedId, 'user'))

  const userData = await dao.user.get(id)

  return c.json({
    username: userData.firstname,
    about: userData.about,
    youtube: userData.youtube,
    tiktok: userData.tiktok,
    instagram: userData.instagram,
    image: userData.image,
    banner: userData.banner,
  })
})

export default account
