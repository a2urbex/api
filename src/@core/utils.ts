import { createCipheriv, createDecipheriv } from 'crypto'
import { HTTPException } from 'hono/http-exception'
import * as fs from 'node:fs/promises'

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
    try {
      return decipher.update(buff.toString('utf8'), 'hex', 'utf8') + decipher.final('utf8')
    } catch (e) {
      throw new HTTPException(404, { message: 'id not found' })
    }
  },

  getImageUrl: (str: string) => {
    if (!str) return str
    if (str.indexOf('/img/') === 0) return config.apiUrl + str
    return str
  },

  getImageExtension: (type: string) => {
    const types = {
      'image/png': 'png',
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpg',
    }

    return types[type]
  },

  saveImage: async (img: any, path: string) => {
    const imgType = utils.getImageExtension(img.type)
    if (!imgType) throw new HTTPException(422, { message: 'Unauthorized image format' })

    const imgPath = `${path}/${utils.generateRandomString(16)}.${imgType}`
    const buffer = await img.arrayBuffer()

    try {
      await fs.writeFile(imgPath, buffer)
    } catch (e) {
      console.log(e)
      throw new HTTPException(500, { message: 'Error uploading image' })
    }

    return '/' + imgPath
  },

  // Downloads a remote image to the given path and returns a stored relative path
  // (e.g. "/img/locations/abc123.jpeg"), or null if the URL is unreachable or
  // points at an unsupported format. Never throws — failures are non-fatal.
  downloadImage: async (url: string, path: string): Promise<string | null> => {
    try {
      if (!/^https?:\/\//i.test(url)) return null
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) return null

      const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      let ext = utils.getImageExtension(contentType)
      if (!ext) {
        const m = url.split('?')[0].match(/\.(png|jpe?g)$/i)
        if (m) ext = m[1].toLowerCase() === 'jpg' ? 'jpg' : (m[1].toLowerCase() as any)
      }
      if (!ext) return null

      const buf = new Uint8Array(await res.arrayBuffer())
      if (!buf.byteLength) return null

      const imgPath = `${path}/${utils.generateRandomString(16)}.${ext}`
      await fs.writeFile(imgPath, buf)
      return '/' + imgPath
    } catch (_) {
      return null
    }
  },

  deleteImage: async (imgPath: string) => {
    if (imgPath?.indexOf('/img/') !== 0) return
    let path = imgPath.charAt(0) === '/' ? imgPath.substring(1) : imgPath

    const exist = await fs.exists(path)
    if (!exist) return

    try {
      await fs.unlink(path)
    } catch (e) {
      throw new HTTPException(500, { message: 'Error deleting old image' })
    }
  },
}

export default utils
