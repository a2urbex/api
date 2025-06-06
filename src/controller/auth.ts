import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import utils from '@core/utils'
import config from 'config'
import dao from 'dao'
import mailService from 'service/mail'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const createJwt = (id: number, email: string, roles = [], duration: number = 3600) => {
  return jwt.sign({ id, email, roles }, config.jwtSecret, { expiresIn: duration })
}

/**
 * POST /auth/login
 * @description User login
 *
 * body @param {string} email - Email
 * body @param {string} password - Password
 * body @param {boolean} keepMeLoggedIn - Stay connected
 *
 * @returns {{token: string}}
 */
auth.post('/login', async (c) => {
  const { email, password, keepMeLoggedIn } = await c.req.json()

  const exist = await dao.user.exist(email)
  if (!exist) throw new HTTPException(404, { message: "User doesn't exist" })
  if (exist.old) return c.json({ old: true })

  const match = await bcrypt.compare(config.password.secret + password, exist.password)
  if (!match) throw new HTTPException(403, { message: 'Invalid password.' })

  return c.json({ token: createJwt(exist.id, email, JSON.parse(exist.roles), keepMeLoggedIn ? 3600 * 24 * 365 : 3600) })
})

/**
 * POST /auth/register
 * @description User register
 *
 * body @param {string} email - Email
 * body @param {string} password - Password
 * body @param {string} username - Username
 *
 * @returns {{token: string}}
 */
auth.post('/register', async (c) => {
  const { email, password, username } = await c.req.json()

  const verify1 = utils.validator.email(email)
  if (!verify1) throw new HTTPException(400, { message: 'Invalid email' })

  const verify2 = utils.validator.password(password)
  if (!verify2) throw new HTTPException(400, { message: 'Invalid password' })

  const exist = await dao.user.exist(email)
  if (exist) throw new HTTPException(409, { message: 'User already exist' })

  const hash = await bcrypt.hash(config.password.secret + password, config.password.salt)
  const add = await dao.user.add(email, hash, username, ['ROLE_USER'])

  const addFavorite = await dao.favorite.add('like', true)
  await dao.favorite.addUser(addFavorite.insertId, add.insertId)

  return c.json({ token: createJwt(add.insertId, email) })
})

/**
 * POST /auth/password/forgot
 * @description Send password reset email
 *
 * body @param {string} email - Email
 */
auth.post('/password/forgot', async (c) => {
  const { email } = await c.req.json()

  const exist = await dao.user.exist(email)
  if (!exist) throw new HTTPException(404, { message: "User doesn't exist" })

  const token = utils.generateRandomString(24)
  const date = new Date()
  date.setDate(date.getDate() + 1)

  await dao.token.add('password_reset', token, date, exist.id)

  const url = `${config.forgotPasswordUrl}/${token}`
  await mailService.resetPassword(exist.email, exist.username, url)

  return c.json({})
})

/**
 * POST /auth/password/forgot
 * @description Reset user password
 *
 * body @param {string} token - Token
 * body @param {string} password - Password
 */
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
