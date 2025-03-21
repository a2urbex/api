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

user.put('/:id/roles', async (c) => {
  const currentUser = c.get('user')
  
  if (!utils.isAdmin(currentUser)) {
    throw new HTTPException(403, { message: 'Only administrators can update user roles' })
  }

  const encryptedId = c.req.param('id')
  const userId = parseInt(utils.decrypt(encryptedId, 'user'))
  const { roles } = await c.req.json()

  if (!Array.isArray(roles)) {
    throw new HTTPException(400, { message: 'Roles must be an array' })
  }

  await dao.user.updateRoles(userId, roles)
  return c.json({ message: 'User roles updated successfully' })
})

export default user 