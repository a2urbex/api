import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import utils from '@core/utils'
import config from 'config'
import dao from 'dao'

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
  const { email, password, firstname, lastname } = await c.req.json()

  const verify1 = utils.validator.email(email)
  if (!verify1) throw new HTTPException(400, { message: 'Invalid email' })

  const verify2 = utils.validator.password(password)
  if (!verify2) throw new HTTPException(400, { message: 'Invalid password' })

  const exist = await dao.user.exist(email)
  if (exist) throw new HTTPException(409, { message: 'User already exist' })

  const hash = await bcrypt.hash(config.password.secret + password, config.password.salt)
  const add = await dao.user.add(email, hash, firstname, lastname)

  return c.json({ token: createJwt(add.insertId, email) })
})

auth.post('/password/forgot', async (c) => {
  const { email } = await c.req.json()

  const exist = await dao.user.exist(email)
  if (!exist) throw new HTTPException(404, { message: "User doesn't exist" })

  const token = utils.generateRandomString(24)
  const date = new Date()
  date.setDate(date.getDate() + 1)

  await dao.token.add('password_reset', token, date, exist.id)

  return c.json({ token })
})

auth.post('/password/reset', async (c) => {
  const { token, password } = await c.req.json()

  const verify = utils.validator.password(password)
  if (!verify) throw new HTTPException(400, { message: 'Invalid password' })

  const get = await dao.token.get('password_reset', token)
  if (!get) throw new HTTPException(404, { message: 'Invalid token' })

  const hash = await bcrypt.hash(config.password.secret + password, config.password.salt)
  await dao.user.updatePassword(get.user_id, hash)

  await dao.token.delete(get.id)

  return c.json({})
})

export default auth
