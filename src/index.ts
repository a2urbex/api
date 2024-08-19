import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'

import { start } from '@core/init'
import config from 'config'

import auth from 'controller/auth'
import location from 'controller/location'
import account from 'controller/account'

start()

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use(
  '*',
  cors({
    origin: config.frontUrl as string,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })
)

app.options('*', (c) => {
  return c.text('', 204)
})

app.route('/auth', auth)

app.use(async (c, next) => {
  const headers = c.req.header()
  const auth = headers.authorization?.split(' ')

  if (auth?.length !== 2) throw new HTTPException(401, { message: 'Invalid headers' })
  const token = auth[1]

  try {
    const data = jwt.verify(token, config.jwtSecret, { clockTolerance: 10 })
    c.set('user', { id: data.id, email: data.email, roles: data.roles })
  } catch (e: any) {
    throw new HTTPException(401, { message: 'Invalid token' })
  }

  return next()
})

app.route('/location', location)
app.route('/account', account)

export default {
  port: config.port,
  fetch: app.fetch,
}
