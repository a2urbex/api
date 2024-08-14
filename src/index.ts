import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'

import { start } from '@core/init'
import config from 'config'

import auth from 'controller/auth'

start()

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath('/api')
app.route('/auth', auth)

app.use(async (c, next) => {
  const headers = c.req.header()
  const auth = headers.authorization?.split(' ')

  if (auth?.length !== 2) throw new HTTPException(401, { message: 'Invalid headers' })
  const token = auth[1]

  try {
    const data = jwt.verify(token, config.jwtSecret, { clockTolerance: 10 })
    c.set('user', { id: data.id, email: data.email })
  } catch (e: any) {
    throw new HTTPException(401, { message: 'Invalid token' })
  }

  return next()
})

app.get('/test', async (c) => {
  return c.json({ test: true })
})

export default {
  port: config.port,
  fetch: app.fetch,
}
