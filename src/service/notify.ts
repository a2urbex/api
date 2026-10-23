import webpush from 'web-push'

import config from 'config'
import dao from 'dao'

export type Channel = 'admin_system' | 'users_news' | 'outings'

// critical = cannot be opted out; roles = who gets it by default (null = every approved user)
// audience: admin = admins only · staff = admins + superusers (they see every point) · all = every approved user
// defaultOn: state before the user touches the toggle (critical channels cannot be turned off)
type Audience = 'admin' | 'staff' | 'all'
export const CHANNELS: Record<Channel, { label: string; critical: boolean; audience: Audience; defaultOn: (roles: string[]) => boolean }> = {
  admin_system: { label: 'System reports', critical: true, audience: 'admin', defaultOn: () => true },
  // new spots: on for admins, opt-in for superusers
  users_news: { label: 'New spots', critical: false, audience: 'staff', defaultOn: (roles) => roles.includes('ROLE_ADMIN') },
  outings: { label: 'Outings', critical: false, audience: 'all', defaultOn: () => true },
}

export const canReceive = (channel: Channel, roles: string[]) => {
  if (roles.includes('ROLE_DEMO')) return false
  const a = CHANNELS[channel].audience
  if (a === 'admin') return roles.includes('ROLE_ADMIN')
  if (a === 'staff') return roles.includes('ROLE_ADMIN') || roles.includes('ROLE_SUPERUSER')
  return true
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
  const ch = CHANNELS[channel]
  const users = await dao.push.getActiveUsers()
  // explicit choices (on/off); otherwise the role default applies
  const prefs = new Map<number, boolean>((await dao.push.getChannelPrefs(channel)).map((r: any) => [r.user_id, !!r.enabled]))

  return users
    .filter((u: any) => !userIds || userIds.includes(u.id))
    .filter((u: any) => {
      const roles = parseRoles(u.roles)
      if (!canReceive(channel, roles)) return false
      return ch.critical || (prefs.get(u.id) ?? ch.defaultOn(roles))
    })
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
