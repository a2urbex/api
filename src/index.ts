import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { HTTPException } from 'hono/http-exception'

import { start } from '@core/init'
import config from 'config'

import auth from 'controller/auth'
import location from 'controller/location'
import account from 'controller/account'
import favorite from 'controller/favorite'
import friend from 'controller/friend'
import user from 'controller/user'

start()

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const noImage = () => {
  throw new HTTPException(404, { message: 'no image found' })
}
app.use('/img/locations/*', serveStatic({ root: './', onNotFound: noImage }))
app.use('/img/users/*', serveStatic({ root: './', onNotFound: noImage }))

app.use(
  '*',
  cors({
    origin: '*',
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
app.route('/location', location)
app.route('/account', account)
app.route('/favorite', favorite)
app.route('/friend', friend)
app.route('/users', user)

export default {
  port: config.port,
  fetch: app.fetch,
}
