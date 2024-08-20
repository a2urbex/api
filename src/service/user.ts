import utils from '@core/utils'

const userService = {
  formatUser: (item: any) => {
    item.id = utils.encrypt(item.id.toString(), 'user')
    return item
  },
  formatUsers: (list: any) => {
    return list.map((item: any) => userService.formatUser(item))
  },
}

export default userService
