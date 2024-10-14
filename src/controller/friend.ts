import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import utils from '@core/utils'
import dao from 'dao'

import { authMiddleware } from 'service/middleware'
import userService from 'service/user'

const friend = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * Auth middleware to verify if the user is logged in for all routes below
 */
friend.use(authMiddleware)

/**
 * GET /friend
 * @description Get friends, pending friends and waiting approval friends
 *
 * @returns {{
 *  pending: Friend[]
 *  waiting: Friend[]
 *  friends: Friend[]
 * }}
 */
friend.get('/', async (c) => {
  const user = c.get('user')

  const pending = await dao.friend.getPendingUsers(user.id)
  const waiting = await dao.friend.getWaitingUsers(user.id)
  const friends = await dao.friend.getUsers(user.id)

  return c.json({
    pending: userService.formatUsers(pending),
    waiting: userService.formatUsers(waiting),
    friends: userService.formatUsers(friends),
  })
})

/**
 * GET /friend/search
 * @description Search for users who are not friends
 *
 * query @param {string} string - Optional - Search string
 *
 * @returns {Friend[]}
 */
friend.get('/search', async (c) => {
  const user = c.get('user')
  const string = c.req.queries('string')
  const str = string ? string[0] : ''

  const users = await dao.friend.getUserFriends(user.id)
  const list = await dao.user.getFriendSearch([user.id, ...users], str)

  return c.json(userService.formatUsers(list))
})

/**
 * POST /friend/:id
 * @description Make friend request
 *
 * route @param {id} string - User id
 *
 * @returns {{ friend: boolean }}
 */
friend.post('/:id', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const friendId = parseInt(utils.decrypt(encryptedId, 'user'))

  const isFriend = await dao.friend.isFriend(user.id, friendId)
  if (isFriend === 'friend') throw new HTTPException(409, { message: 'Already friend' })
  if (isFriend === 'pending') throw new HTTPException(409, { message: 'Pending request already exist' })

  const isFriend2 = await dao.friend.isFriend(friendId, user.id)
  if (isFriend2 === 'pending') await dao.friend.enableFriend(friendId, user.id)

  await dao.friend.addFriend(user.id, friendId, isFriend2 !== 'pending')

  return c.json({ friend: isFriend2 === 'pending' })
})

/**
 * DELETE /friend/:id
 * @description Delete friend
 *
 * route @param {id} string - User id
 */
friend.delete('/:id', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const friendId = parseInt(utils.decrypt(encryptedId, 'user'))

  const isFriend = await dao.friend.isFriend(user.id, friendId)
  if (isFriend !== 'friend') throw new HTTPException(404, { message: 'Not friend' })

  await dao.friend.deleteFriend(user.id, friendId)
  await dao.friend.deleteFriend(friendId, user.id)

  return c.json({})
})

/**
 * PUT /friend/:id/cancel
 * @description Cancel friend request
 *
 * route @param {id} string - User id
 */
friend.put('/:id/cancel', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const friendId = parseInt(utils.decrypt(encryptedId, 'user'))

  const isFriend = await dao.friend.isFriend(user.id, friendId)
  if (isFriend !== 'pending') throw new HTTPException(404, { message: 'No pending request' })

  await dao.friend.deleteFriend(user.id, friendId)

  return c.json({})
})

/**
 * PUT /friend/:id/accept
 * @description Accept friend request
 *
 * route @param {id} string - User id
 */
friend.put('/:id/accept', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const friendId = parseInt(utils.decrypt(encryptedId, 'user'))

  const isFriend = await dao.friend.isFriend(friendId, user.id)
  if (isFriend !== 'pending') throw new HTTPException(404, { message: 'No pending request' })

  await dao.friend.enableFriend(friendId, user.id)
  await dao.friend.addFriend(user.id, friendId, false)

  return c.json({})
})

/**
 * PUT /friend/:id/decline
 * @description Decline friend request
 *
 * route @param {id} string - User id
 */
friend.put('/:id/decline', async (c) => {
  const user = c.get('user')
  const encryptedId = c.req.param('id')
  const friendId = parseInt(utils.decrypt(encryptedId, 'user'))

  const isFriend = await dao.friend.isFriend(friendId, user.id)
  if (isFriend !== 'pending') throw new HTTPException(404, { message: 'No pending request' })

  await dao.friend.deleteFriend(friendId, user.id)

  return c.json({})
})

export default friend
