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

export default friend
