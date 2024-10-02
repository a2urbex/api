import { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'

import config from 'config'

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

export { authMiddleware, getUser }
