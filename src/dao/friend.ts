let db: db

const friend = {
  init: (db1: db) => {
    db = db1
  },

  getUserFriends: async (userId: number) => {
    const sql = `SELECT friend_id FROM friend WHERE pending = 0 AND user_id = ?`
    const result = await db.query(sql, [userId])

    if (!result) return []
    return result.map((item: any) => item.friend_id)
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

  getPendingUsers: async (userId: number) => {
    const sql = `SELECT u.id, u.firstname, u.image FROM friend f INNER JOIN user u ON u.id = f.friend_id WHERE f.pending = 1 AND f.user_id = ?`
    return db.query(sql, [userId])
  },
  getWaitingUsers: async (userId: number) => {
    const sql = `SELECT u.id, u.firstname, u.image FROM friend f INNER JOIN user u ON u.id = f.user_id WHERE f.pending = 1 AND f.friend_id = ?`
    return db.query(sql, [userId])
  },
  getUsers: async (userId: number) => {
    const sql = `SELECT u.id, u.firstname, u.image FROM friend f INNER JOIN user u ON u.id = f.user_id WHERE f.pending = 0 AND f.friend_id = ?`
    return db.query(sql, [userId])
  },
}

export default friend
