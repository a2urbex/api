import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import config from 'config'
import dao from 'dao'
import utils from '@core/utils'
import { authMiddleware } from 'service/middleware'
import { CHANNELS, Channel, notify, canReceive } from 'service/notify'

const push = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /push/key
 * @description Public VAPID key used by the browser to subscribe
 */
push.get('/key', (c) => c.json({ key: config.vapid.publicKey || null }))

push.use(authMiddleware)

/**
 * POST /push/subscribe
 * body @param {PushSubscriptionJSON} subscription - { endpoint, keys: { p256dh, auth } }
 */
push.post('/subscribe', async (c) => {
  const user = c.get('user')
  const { endpoint, keys } = await c.req.json()
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth)
    throw new HTTPException(400, { message: 'Invalid subscription' })

  await dao.push.subscribe(user.id, endpoint, keys.p256dh, keys.auth)
  return c.json({})
})

/**
 * DELETE /push/subscribe
 * body @param {string} endpoint
 */
push.delete('/subscribe', async (c) => {
  const user = c.get('user')
  const { endpoint } = await c.req.json()
  await dao.push.unsubscribe(user.id, endpoint)
  return c.json({})
})

/**
 * GET /push/preferences
 * @returns {{channel: string, label: string, critical: boolean, enabled: boolean}[]} channels visible to this user
 */
push.get('/preferences', async (c) => {
  const user = c.get('user')
  const prefs = new Map((await dao.push.getPrefs(user.id)).map((p: any) => [p.channel, !!p.enabled]))
  const roles = user.roles || []

  const list = (Object.keys(CHANNELS) as Channel[])
    .filter((ch) => canReceive(ch, roles))
    .map((ch) => ({ channel: ch, label: CHANNELS[ch].label, critical: CHANNELS[ch].critical, enabled: CHANNELS[ch].critical || (prefs.get(ch) ?? CHANNELS[ch].defaultOn(roles)) }))
  return c.json(list)
})

/**
 * PUT /push/preferences
 * body @param {string} channel
 * body @param {boolean} enabled
 */
push.put('/preferences', async (c) => {
  const user = c.get('user')
  const { channel, enabled } = await c.req.json()
  const ch = CHANNELS[channel as Channel]
  if (!ch || ch.critical || !canReceive(channel as Channel, user.roles || [])) throw new HTTPException(400, { message: 'Channel cannot be changed' })

  await dao.push.setPref(user.id, channel, !!enabled)
  return c.json({})
})

/**
 * POST /push/test
 * @description Send a test notification to the current user's own devices (bypasses channel opt-outs)
 */
push.post('/test', async (c) => {
  const user = c.get('user')
  const res = await notify('admin_system', { title: 'a2urbex test', body: 'Notifications work on this device.', url: '/app-settings' }, [user.id], true)
  return c.json(res)
})

export default push
