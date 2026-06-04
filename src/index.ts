import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { HTTPException } from 'hono/http-exception'
import { Cron } from 'croner'

import { randomUUID } from 'crypto'

import { start } from '@core/init'
import config from 'config'
import dao from 'dao'

import auth from 'controller/auth'
import location from 'controller/location'
import account from 'controller/account'
import favorite from 'controller/favorite'
import friend from 'controller/friend'
import user from 'controller/user'
import admin from 'controller/admin'
import pinterestService, { PinterestJob, registry as pinterestRegistry } from 'service/pinterest'

await start()

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
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
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
app.route('/admin', admin)

// Scheduled Pinterest import. The cron is always registered; execution is gated
// on the admin-managed settings read fresh on every tick, so toggling on/off
// takes effect on the next tick without a restart.
new Cron('0 3 * * *', async () => {
  try {
    const settings = await dao.pinterest.getSettings()
    if (!settings?.cron_enabled) return
    if (pinterestService.isRunning()) {
      console.log('Skipping scheduled Pinterest fetch — a run is already in progress')
      return
    }

    console.log('Daily pinterest fetch')
    const source = await pinterestService.resolveSource()
    const id = randomUUID()
    const job = new PinterestJob(id, source.name)
    pinterestRegistry.add(job)
    await dao.pinterest.createJob(id, 'cron', source.id, null)

    try {
      await pinterestService.fetch(job)
    } finally {
      await dao.pinterest.updateJob(
        id,
        job.state,
        job.processed,
        job.inserted,
        job.skipped,
        job.failed,
        job.error ?? null,
      )
    }
  } catch (e) {
    console.error('Scheduled Pinterest fetch failed', e)
  }
})

export default {
  port: config.port,
  fetch: app.fetch,
}
