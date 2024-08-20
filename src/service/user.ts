import dao from 'dao'

const userService = {
  getFriends: async (userId: number) => {
    const friends = await dao.friend.getUserFriends(userId)
    return friends.map((item: any) => item.friend_id)
  },
}

export default userService
