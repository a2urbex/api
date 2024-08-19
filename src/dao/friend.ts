let db: db

const friend = {
  init: (db1: db) => {
    db = db1
  },

  getUserFriends: (userId: number) => {
    const sql = `SELECT friend_id FROM friend WHERE pending = 0 AND user_id = ?`
    return db.query(sql, [userId])
  },

  getUserFriendsCount: (userId: number) => {
    const sql = `SELECT COUNT(id) total FROM friend WHERE pending = 0 AND user_id = ?`
    return db.query(sql, [userId], 0)
  },

  isFriend: async (userId: number, friendId: number) => {
    const sql = `SELECT id, pending FROM friend WHERE user_id = ? AND friend_id = ?`
    const result = await db.query(sql, [userId, friendId], 0)
    if (!result) return 'notFriend'
    return result.pending ? 'pending' : 'friend'
  },
}

export default friend
