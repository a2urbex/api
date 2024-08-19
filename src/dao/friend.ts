let db: db

const friend = {
  init: (db1: db) => {
    db = db1
  },

  getUserFriends: (userId: number) => {
    const sql = `SELECT friend_id FROM friend WHERE pending = 0 AND user_id = ?`
    return db.query(sql, [userId])
  },
}

export default friend
