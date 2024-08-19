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

favorite.get('/:id/location', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const id = parseInt(utils.decrypt(encryptedId, 'favorite'))

  const favorite = await dao.favorite.get(id, user.id)
  if (!favorite?.hasAccess && !favorite?.share) throw new HTTPException(403, { message: 'Favorite is private' })

  const data = await locationService.getLocations(user, { favoriteId: id })
  return c.json(data)
})

export default favorite
