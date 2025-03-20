import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import dao from 'dao'
import utils from '@core/utils'
import userService from 'service/user'
import { authMiddleware } from 'service/auth'

const user = new Hono<{ Bindings: Bindings; Variables: Variables }>()
user.use('*', authMiddleware)

user.get('/', async (c) => {
  const users = await dao.user.getAll()
  
  const formattedUsers = users.map((user: any) => ({
    ...userService.formatUser(user),
    roles: JSON.parse(user.roles)
  }))

  return c.json(formattedUsers)
})

export default user 