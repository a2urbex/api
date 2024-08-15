import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'

import { start } from '@core/init'
import config from 'config'

import auth from 'controller/auth'
import location from 'controller/location'

start()

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (c.req.method === 'OPTIONS') {
    // Respond to preflight requests immediately
    return c.text('', 204)
  }

  await next()
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

export default {
  port: config.port,
  fetch: app.fetch,
}
