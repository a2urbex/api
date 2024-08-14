const utils = {
  generateRandomString: (length: number, charset: string = 'abcdefghijklmnopqrstuvwxyz0123456789') => {
    const result: string[] = []
    for (let i = 0; i < length; i++) result.push(charset.charAt(Math.floor(Math.random() * charset.length)))
    return result.join('')
  },

  validator: {
    email: (str: string) => /^[^@]+@[^@]+\.[^@]+$/.test(str),
    password: (str: string) => str.length >= 8,
  },

  isAdmin: (user: User) => {
    return user.roles.includes('ROLE_ADMIN')
  },
  isSuperUser: (user: User) => {
    return user.roles.includes('ROLE_SUPERUSER') || utils.isAdmin(user)
  },
}

export default utils
