import nodemailer from 'nodemailer'
import * as fs from 'node:fs/promises'

import config from 'config'

const mailService = {
  getTransporter: () => {
    return nodemailer.createTransport({
      service: config.mail.service,
      host: config.mail.host,
      port: config.mail.port,
      secure: true,
      auth: {
        user: config.mail.user,
        pass: config.mail.password,
      },
    })
  },

  send: async (to: string, subject: string, html: string) => {
    const transporter = mailService.getTransporter()

    return transporter.sendMail({
      from: `"A2urbex" <${config.mail.user}>`,
      to: to,
      subject: subject,
      html: html,
    })
  },

  getTemplate: async (filename: string, variables: Object = {}) => {
    const file = await fs.readFile(`${config.path.mail}/${filename}.html`)
    let raw = Buffer.from(file).toString()

    for (const name in variables) raw = raw.replaceAll(`##${name}##`, variables[name])
    raw = raw.replaceAll('\n', '')

    return raw
  },

  resetPassword: async (to: string, name: string, url: string) => {
    const subject = 'Réinitialisation mot de passe'
    const template = await mailService.getTemplate('resetPassword', { name, url })
    return mailService.send(to, subject, template)
  },
}

export default mailService
