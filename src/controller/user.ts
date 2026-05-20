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
    roles: JSON.parse(user.roles),
    pending: Number(user.pending),
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

user.put('/:id/pending', async (c) => {
  const currentUser = c.get('user')

  if (!utils.isAdmin(currentUser)) {
    throw new HTTPException(403, { message: 'Only administrators can update pending status' })
  }

  const encryptedId = c.req.param('id')
  const userId = parseInt(utils.decrypt(encryptedId, 'user'))
  const { pending } = await c.req.json()

  if (pending !== 0 && pending !== 1) {
    throw new HTTPException(400, { message: 'Pending must be 0 or 1' })
  }

  await dao.user.updatePending(userId, pending)
  return c.json({ message: 'User pending status updated successfully' })
})

user.delete('/:id', async (c) => {
  const currentUser = c.get('user')

  if (!utils.isAdmin(currentUser)) {
    throw new HTTPException(403, { message: 'Only administrators can delete users' })
  }

  const encryptedId = c.req.param('id')
  const userId = parseInt(utils.decrypt(encryptedId, 'user'))

  await dao.user.delete(userId)
  return c.json({ message: 'User deleted successfully' })
})

export default user 