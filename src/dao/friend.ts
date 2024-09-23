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

  enableFriend: async (userId: number, friendId: number) => {
    const sql = `UPDATE friend SET pending = 0 WHERE user_id = ? AND friend_id = ?`
    return db.query(sql, [userId, friendId])
  },

  addFriend: async (userId: number, friendId: number, pending: boolean = true) => {
    const sql = `INSERT INTO friend (user_id, friend_id, pending) VALUES (?, ?, ?)`
    return db.query(sql, [userId, friendId, pending])
  },

  deleteFriend: async (userId: number, friendId: number) => {
    const sql = `DELETE FROM friend WHERE user_id = ? AND friend_id = ?`
    return db.query(sql, [userId, friendId])
  },
}

export default friend
