import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import dao from 'dao'
import utils from '@core/utils'
import { authMiddleware } from 'service/middleware'

const exploration = new Hono<{ Bindings: Bindings; Variables: Variables }>()

exploration.use(authMiddleware)

// Close sessions; listStatus is applied to their lists (finished on end/expiry, upcoming on reset)
const close = async (sessions: any[], listStatus: string) => {
  await dao.exploration.end(sessions.map((s) => s.id))
  for (const s of sessions) if (s.favoriteId) await dao.favorite.setStatus(s.favoriteId, listStatus)
}

const format = (row: any) =>
  row ? { ...row, id: undefined, favoriteId: utils.encrypt(row.favoriteId.toString(), 'favorite') } : null

/**
 * GET /exploration
 * @description Active exploration (expired ones are closed and their list marked finished)
 *
 * @returns {{favoriteId: string, name: string, startedAt: string, expiresAt: string} | null}
 */
exploration.get('/', async (c) => {
  const user = c.get('user')
  await close(await dao.exploration.getExpiredOpen(user.id), 'finished')
  return c.json(format(await dao.exploration.getActive(user.id)))
})

/**
 * POST /exploration
 * @description Start exploring a list; refused (409) while another list is being explored
 *
 * body @param {string} favoriteId - Favorite encoded id
 */
exploration.post('/', async (c) => {
  const user = c.get('user')
  const { favoriteId } = await c.req.json()
  const id = parseInt(utils.decrypt(favoriteId || '', 'favorite'))

  const users = await dao.favorite.getUsers(id)
  if (!users.includes(user.id)) throw new HTTPException(403, { message: 'User unauthorized' })

  // One exploration at a time: the running one must be ended first (expired ones are closed here)
  await close(await dao.exploration.getExpiredOpen(user.id), 'finished')
  const running = await dao.exploration.getActive(user.id)
  if (running && running.favoriteId !== id) throw new HTTPException(409, { message: `"${running.name}" is already being explored` })
  if (running) return c.json(format(running))

  await dao.exploration.start(user.id, id)
  await dao.favorite.setStatus(id, 'in_progress')

  return c.json(format(await dao.exploration.getActive(user.id)))
})

/**
 * DELETE /exploration
 * @description End the active exploration; list becomes finished. ?reset=1 puts the list back to upcoming.
 */
exploration.delete('/', async (c) => {
  const user = c.get('user')
  const reset = c.req.query('reset') === '1'
  await close(await dao.exploration.getOpen(user.id), reset ? 'upcoming' : 'finished')
  return c.json(null)
})

export default exploration
