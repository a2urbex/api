import { createCipheriv, createDecipheriv, createHash } from 'crypto'
import config from 'config'

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

  // generate iv
  // createHash('sha512').update('string').digest('hex').substring(0, 16)
  // generate key
  // createHash('sha512').update('string').digest('hex').substring(0, 32)

  encrypt: (str: string, type: string) => {
    // @ts-ignore
    const cipher = createCipheriv(config.encryption.method, config.encryption[type], config.encryption.iv)
    return Buffer.from(cipher.update(str, 'utf8', 'hex') + cipher.final('hex')).toString('utf8')
  },

  decrypt: (str: string, type: string) => {
    const buff = Buffer.from(str, 'utf8')
    // @ts-ignore
    const decipher = createDecipheriv(config.encryption.method, config.encryption[type], config.encryption.iv)
    return decipher.update(buff.toString('utf8'), 'hex', 'utf8') + decipher.final('utf8')
  },
}

export default utils
