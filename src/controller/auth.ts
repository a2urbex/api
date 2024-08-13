import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'

import config from 'config'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

auth.post('/access-token', async (c) => {
  return c.json({ cc: true })
  const { token } = await c.req.json()

  try {
    // const req = await api.auth.request('auth/accessToken', { refreshToken: token })
    // if (!req.success) return api.auth.error()
    // const data = jwt.verify(req.accessToken, config.secret, { clockTolerance: 10 })
    // return c.json({ accessToken: req.accessToken, exp: data.exp })
  } catch (e) {
    console.log(e)
    throw new HTTPException(401)
  }
})

export default auth
