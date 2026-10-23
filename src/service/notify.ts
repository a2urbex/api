import webpush from 'web-push'

import config from 'config'
import dao from 'dao'

export type Channel = 'admin_system' | 'users_news' | 'outings'

// critical = cannot be opted out; roles = who gets it by default (null = every approved user)
export const CHANNELS: Record<Channel, { label: string; critical: boolean; adminOnly: boolean }> = {
  admin_system: { label: 'System reports', critical: true, adminOnly: true },
  users_news: { label: 'New spots', critical: false, adminOnly: false },
  outings: { label: 'Outings', critical: false, adminOnly: false },
}

export interface NotifyPayload {
  title: string
  body?: string
  url?: string
}

const enabled = !!(config.vapid.publicKey && config.vapid.privateKey)
if (enabled) webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey)

const parseRoles = (roles: any): string[] => {
  if (Array.isArray(roles)) return roles
  try {
    return JSON.parse(roles) || []
  } catch {
    return []
  }
}

const recipients = async (channel: Channel, userIds?: number[], force = false) => {
  if (force && userIds) return userIds
  const users = await dao.push.getActiveUsers()
  const optOut = new Set(CHANNELS[channel].critical ? [] : (await dao.push.getOptOuts(channel)).map((r: any) => r.user_id))

  return users
    .filter((u: any) => !userIds || userIds.includes(u.id))
    .filter((u: any) => !CHANNELS[channel].adminOnly || parseRoles(u.roles).includes('ROLE_ADMIN'))
    .filter((u: any) => !parseRoles(u.roles).includes('ROLE_DEMO'))
    .filter((u: any) => !optOut.has(u.id))
    .map((u: any) => u.id as number)
}

/**
 * Send a push to every subscriber of a channel (optionally restricted to userIds).
 * Never throws: notifications must not break the caller (importers, cron).
 */
export const notify = async (channel: Channel, payload: NotifyPayload, userIds?: number[], force = false) => {
  if (!enabled) return { sent: 0, pruned: 0, failed: 0, recipients: 0, error: 'VAPID keys missing on the server' }
  let sent = 0
  let pruned = 0
  let failed = 0
  let recipientCount = 0
  const errors: string[] = []

  try {
    const ids = await recipients(channel, userIds, force)
    recipientCount = ids.length
    const subs = await dao.push.getForUsers(ids)
    const body = JSON.stringify({ ...payload, channel })

    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400 })
          sent++
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await dao.push.deleteById(s.id)
            pruned++
          } else {
            failed++
            errors.push(`${e?.statusCode ?? 'network'}${e?.body ? ` ${String(e.body).slice(0, 80)}` : ''}`)
            console.error('push failed', e?.statusCode, e?.body)
          }
        }
      }),
    )
  } catch (e) {
    console.error('notify failed', e)
  }

  return { sent, pruned, failed, recipients: recipientCount, error: errors[0] ?? null }
}

// Importer report: counts/errors to admins, new points to users
export const reportImport = async (
  source: string,
  r: { inserted: number; skipped?: number; failed?: number; updated?: number; error?: string | null },
) => {
  const parts = [`+${r.inserted} new`, r.updated ? `${r.updated} updated` : '', `${r.skipped ?? 0} skipped`, r.failed ? `${r.failed} failed` : '']
  await notify('admin_system', {
    title: r.error ? `Import ${source} failed` : `Import ${source} done`,
    body: r.error ? r.error.slice(0, 180) : parts.filter(Boolean).join(' · '),
    url: '/admin',
  })
  if (r.inserted > 0) await notify('users_news', { title: `${r.inserted} new spots`, body: `Added from ${source}`, url: '/locations' })
}
