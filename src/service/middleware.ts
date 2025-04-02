import { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'

import config from 'config'
import utils from '@core/utils'
import dao from 'dao'

// AUTH
const authMiddleware = createMiddleware(async (c, next) => {
  const user = getUser(c, true)
  c.set('user', user)

  return next()
})

const getUser = (c: Context, error = false) => {
  const headers = c.req.header()
  const auth = headers.authorization?.split(' ')
  const token = auth?.[1]

  if (!token) {
    if (!error) return null
    throw new HTTPException(401, { message: 'Invalid headers' })
  }

  try {
    const data = jwt.verify(token, config.jwtSecret, { clockTolerance: 10 })
    return { id: data.id, email: data.email, roles: data.roles }
  } catch (e) {
    if (!error) return null
    throw new HTTPException(401, { message: 'Invalid token' })
  }
}

// LOCATION
const locationMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id') || ''
  const id = parseInt(utils.decrypt(encryptedId, 'location'))

  const loc = await dao.location.getUser(id)
  if (!utils.isAdmin(user) && loc?.user_id !== user.id) throw new HTTPException(403, { message: 'User unauthorized' })

  c.set('id', id)
  return next()
})

// FAVORITE
const favoriteMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id') || ''
  const id = parseInt(utils.decrypt(encryptedId, 'favorite'))

  const users = await dao.favorite.getUsers(id)
  if (!users.includes(user.id)) throw new HTTPException(403, { message: 'User unauthorized' })

  c.set('id', id)
  return next()
})

export { authMiddleware, getUser, locationMiddleware, favoriteMiddleware }
