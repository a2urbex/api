import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import dao from 'dao'
import utils from '@core/utils'

import { authMiddleware, favoriteMiddleware, getUser } from 'service/middleware'
import locationService from 'service/location'
import userService from 'service/user'

const favorite = new Hono<{ Bindings: Bindings; Variables: Variables }>()

favorite.get('/:id{[0-9a-z]{24,}}', async (c) => {
  const user = getUser(c)
  const encryptedId = c.req.param('id')
  const id = parseInt(utils.decrypt(encryptedId, 'favorite'))

  const fav = await dao.favorite.get(id)
  const users = await dao.favorite.getUsers(id)

  let isPrivate = !users.includes(user?.id)
  if (isPrivate && fav?.share) isPrivate = false

  if (isPrivate) throw new HTTPException(403, { message: 'Favorite is private' })

  const data = await locationService.getLocations(user, { favoriteId: id })
  return c.json({ name: fav.name, ...data })
})

favorite.use(authMiddleware)

favorite.get('/summary', async (c) => {
  const user = c.get('user')

  const data = await dao.favorite.getList(user.id)
  const list = data.map((item: any) => {
    item.id = utils.encrypt(item.id.toString(), 'favorite')
    return item
  })

  return c.json(list)
})

favorite.get('/', async (c) => {
  const user = c.get('user')

  const data = await dao.favorite.getList(user.id)
  const list: any = []

  for (let i = 0; i < data.length; i++) {
    const item = { ...data[i] }
    const users = await dao.favorite.getUsersInfo(item.id)
    item.users = userService.formatUsers(users)
    item.id = utils.encrypt(item.id.toString(), 'favorite')
    list.push(item)
  }

  return c.json(list)
})

favorite.post('/', async (c) => {
  const user = c.get('user')
  const { name, locationId } = await c.req.json()
  let locId = 0

  if (locationId) {
    locId = parseInt(utils.decrypt(locationId, 'location'))
    await locationService.hasAccess(locationId, user)
  }

  const add = await dao.favorite.add(name)
  await dao.favorite.addUser(add.insertId, user.id)
  if (locId > 0) await dao.favorite.addLocation(add.insertId, locId)

  return c.json({ id: utils.encrypt(add.insertId.toString(), 'favorite') })
})

favorite.put('/:id/location/:locationId', favoriteMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.get('id')

  const encryptedLocationId = c.req.param('locationId')
  const locId = parseInt(utils.decrypt(encryptedLocationId, 'location'))

  await locationService.hasAccess(locId, user)

  const has = await dao.favorite.hasLocation(id, locId)
  if (has) await dao.favorite.deleteLocation(id, locId)
  else await dao.favorite.addLocation(id, locId)

  return c.json({})
})

favorite.delete('/:id', favoriteMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.get('id')

  const users = await dao.favorite.getUsers(id)

  const fav = await dao.favorite.get(id)
  if (fav.master) throw new HTTPException(403, { message: "Master favorite can't be deleted" })

  await dao.favorite.deleteUser(id, user.id)

  if (users.length === 1) {
    await dao.favorite.deleteLocations(id)
    await dao.favorite.delete(id)
  }

  return c.json({})
})

favorite.put('/:id/disable', favoriteMiddleware, async (c) => {
  const id = c.get('id')

  const fav = await dao.favorite.get(id)
  if (fav.master) throw new HTTPException(403, { message: "Master favorite can't be disabled" })

  await dao.favorite.disable(id, !fav.disabled)

  return c.json({})
})

favorite.put('/:id/share', favoriteMiddleware, async (c) => {
  const id = c.get('id')

  const fav = await dao.favorite.get(id)
  if (fav.master) throw new HTTPException(403, { message: "Master favorite can't be shared" })

  await dao.favorite.share(id, !fav.share)

  return c.json({})
})

favorite.get('/:id/search', favoriteMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.get('id')

  const string = c.req.queries('string')
  const str = string ? string[0] : ''

  const users = await dao.favorite.getUsers(id)
  const friends = await dao.friend.getUserFriends(user.id)

  const usersId = friends.filter((id: number) => !users.includes(id))
  const list = await dao.user.getFavoriteSearch(usersId, str)

  return c.json(userService.formatUsers(list))
})

favorite.put('/:id/user/:userId', favoriteMiddleware, async (c) => {
  const id = c.get('id')

  const encryptedUserId = c.req.param('userId')
  const usrId = parseInt(utils.decrypt(encryptedUserId, 'user'))

  const users = await dao.favorite.getUsers(id)
  if (users.includes(usrId)) throw new HTTPException(400, { message: 'User already in favorite' })

  await dao.favorite.addUser(id, usrId)

  return c.json({})
})

export default favorite
