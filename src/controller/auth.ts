import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import dao from 'dao'
import config from 'config'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const createJwt = (id: number, email: string, duration: number = 3600) => {
  return jwt.sign({ id, email }, config.jwtSecret, { expiresIn: duration })
}

auth.post('/login', async (c) => {
  const { email, password, keepMeLoggedIn } = await c.req.json()

  const exist = await dao.user.exist(email)
  if (!exist) throw new HTTPException(404, { message: "User doesn't exist" })

  const match = await bcrypt.compare(config.password.secret + password, exist.password)
  if (!match) throw new HTTPException(401, { message: 'Invalid password' })

  return c.json({ token: createJwt(exist.id, email, keepMeLoggedIn ? 3600 * 365 : 3600) })
})
auth.post('/register', async (c) => {
  const { email, password, name, lastname } = await c.req.json()

  const exist = await dao.user.exist(email)
  if (exist) throw new HTTPException(409, { message: 'User already exist' })

  const hash = await bcrypt.hash(config.password.secret + password, config.password.salt)
  const add = await dao.user.add(email, hash, name, lastname)

  return c.json({ token: createJwt(add.insertId, email) })
})

export default auth
