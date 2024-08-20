import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import dao from 'dao'
import utils from '@core/utils'
import locationService from 'service/location'

const favorite = new Hono<{ Bindings: Bindings; Variables: Variables }>()

favorite.get('/', async (c) => {
  const user = c.get('user')

  const data = await dao.favorite.getList(user.id)
  const list = data.map((item: any) => {
    item.id = utils.encrypt(item.id.toString(), 'favorite')
    return item
  })

  return c.json(list)
})

favorite.get('/:id', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const id = parseInt(utils.decrypt(encryptedId, 'favorite'))

  const fav = await dao.favorite.get(id, user.id)
  const favUsers = await dao.favorite.getUsers(id)
  const users = favUsers.map((item: any) => item.user_id)

  if (!users.includes(user.id) && !fav?.share) throw new HTTPException(403, { message: 'Favorite is private' })

  const data = await locationService.getLocations(user, { favoriteId: id })
  return c.json(data)
})

favorite.post('/', async (c) => {
  const user = c.get('user')
  const { name, locationId } = await c.req.json()
  let locId = 0

  if (locationId) {
    locId = parseInt(utils.decrypt(locationId, 'location'))
    const access = await locationService.hasAccess(locationId, user)
    if (!access) throw new HTTPException(403, { message: 'Location is private' })
  }

  const add = await dao.favorite.add(name)
  await dao.favorite.addUser(add.insertId, user.id)
  if (locId > 0) await dao.favorite.addLocation(add.insertId, locId)

  return c.json({ id: utils.encrypt(add.insertId.toString(), 'favorite') })
})

favorite.put('/:id/location', async (c) => {
  const user = c.get('user')
  const { locationId, active } = await c.req.json()
  const encryptedId = c.req.param('id')

  const id = parseInt(utils.decrypt(encryptedId, 'favorite'))
  const locId = parseInt(utils.decrypt(locationId, 'location'))

  const access = await locationService.hasAccess(locId, user)
  if (!access) throw new HTTPException(403, { message: 'Location is private' })

  const has = await dao.favorite.hasLocation(id, locId)
  if (has && active) throw new HTTPException(400, { message: 'Location already in favorite' })

  if (active) await dao.favorite.addLocation(id, locId)
  else await dao.favorite.deleteLocation(id, locId)

  return c.json({})
})

favorite.delete('/:id', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const id = parseInt(utils.decrypt(encryptedId, 'favorite'))

  const fav = await dao.favorite.get(id, user.id)
  if (fav.master) throw new HTTPException(403, { message: "Master favorite can't be deleted" })

  const favUsers = await dao.favorite.getUsers(id)
  const users = favUsers.map((item: any) => item.user_id)
  if (!users.includes(user.id)) throw new HTTPException(403, { message: 'User unauthorized' })

  await dao.favorite.deleteUser(id, user.id)

  if (users.length === 1) {
    await dao.favorite.deleteLocations(id)
    await dao.favorite.delete(id)
  }

  return c.json({})
})

export default favorite
