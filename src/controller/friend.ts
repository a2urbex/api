import { Hono } from 'hono'

import dao from 'dao'
import userService from 'service/user'

const friend = new Hono<{ Bindings: Bindings; Variables: Variables }>()

friend.get('/', async (c) => {
  const user = c.get('user')

  const pending = await dao.friend.getPendingUsers(user.id)
  const waiting = await dao.friend.getWaitingUsers(user.id)
  const friends = await dao.friend.getUsers(user.id)

  return c.json({
    pending: userService.formatUsers(pending),
    waiting: userService.formatUsers(waiting),
    friends: userService.formatUsers(friends),
  })
})

friend.get('/search', async (c) => {
  const user = c.get('user')
  const string = c.req.queries('string')
  const str = string ? string[0] : ''

  const users = await dao.friend.getUserFriends(user.id)
  const list = await dao.user.getFriendSearch([user.id, ...users], str)

  return c.json(userService.formatUsers(list))
})

export default friend
