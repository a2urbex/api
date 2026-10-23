let db: db

const push = {
  init: (db1: db) => {
    db = db1
  },

  subscribe: (userId: number, endpoint: string, p256dh: string, auth: string) => {
    const sql = `INSERT INTO push_subscription (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`
    return db.query(sql, [userId, endpoint, p256dh, auth])
  },

  unsubscribe: (userId: number, endpoint: string) => {
    const sql = `DELETE FROM push_subscription WHERE user_id = ? AND endpoint = ?`
    return db.query(sql, [userId, endpoint])
  },

  deleteById: (id: number) => {
    const sql = `DELETE FROM push_subscription WHERE id = ?`
    return db.query(sql, [id])
  },

  getForUsers: (userIds: number[]) => {
    if (!userIds.length) return []
    const sql = `SELECT id, user_id userId, endpoint, p256dh, auth FROM push_subscription WHERE user_id IN (?)`
    return db.query(sql, [userIds])
  },

  getSubscribedUsers: () => {
    const sql = `SELECT u.id, u.username, u.image, COUNT(ps.id) devices
                 FROM push_subscription ps JOIN user u ON u.id = ps.user_id
                 GROUP BY u.id ORDER BY u.username`
    return db.query(sql)
  },

  getActiveUsers: () => {
    const sql = `SELECT id, roles FROM user WHERE pending = 0`
    return db.query(sql)
  },

  getChannelPrefs: (channel: string) => {
    const sql = `SELECT user_id, enabled FROM user_notification_pref WHERE channel = ?`
    return db.query(sql, [channel])
  },

  getOptOuts: (channel: string) => {
    const sql = `SELECT user_id FROM user_notification_pref WHERE channel = ? AND enabled = 0`
    return db.query(sql, [channel])
  },

  getPrefs: (userId: number) => {
    const sql = `SELECT channel, enabled FROM user_notification_pref WHERE user_id = ?`
    return db.query(sql, [userId])
  },

  setPref: (userId: number, channel: string, enabled: boolean) => {
    const sql = `INSERT INTO user_notification_pref (user_id, channel, enabled) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`
    return db.query(sql, [userId, channel, enabled ? 1 : 0])
  },
}

export default push
