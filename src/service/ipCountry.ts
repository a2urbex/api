import { Context } from 'hono'
import { getConnInfo } from 'hono/bun'

// Country from the client IP. Cloudflare header first, otherwise country.is then ipwho.is (free, no key), cached 24 h.
const TTL = 24 * 3600 * 1000
const cache = new Map<string, { code: string | null; at: number }>()

const isPrivate = (ip: string) =>
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc|fd|fe80:)/i.test(ip) || ip === 'localhost'

export const clientIp = (c: Context): string | null => {
  const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || c.req.header('cf-connecting-ip') || c.req.header('x-real-ip')
  if (ip) return ip.replace(/^::ffff:/, '')
  try {
    return getConnInfo(c).remote.address?.replace(/^::ffff:/, '') || null
  } catch {
    return null
  }
}

export const countryFromIp = async (c: Context): Promise<string | null> => {
  const cf = c.req.header('cf-ipcountry')?.toUpperCase()
  if (cf && /^[A-Z]{2}$/.test(cf) && cf !== 'XX') return cf

  const ip = clientIp(c)
  if (!ip || isPrivate(ip)) return null

  const hit = cache.get(ip)
  if (hit && Date.now() - hit.at < TTL) return hit.code

  let code: string | null = null
  const lookups: [string, (j: any) => any][] = [
    [`https://api.country.is/${encodeURIComponent(ip)}`, (j) => j?.country],
    [`https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code,success`, (j) => j?.success && j.country_code],
  ]
  for (const [url, pick] of lookups) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
      const value = String(pick(await res.json()) || '').toUpperCase()
      if (res.ok && /^[A-Z]{2}$/.test(value)) {
        code = value
        break
      }
    } catch {
      // timeout / network / bad JSON: try the next service
    }
  }
  cache.set(ip, { code, at: Date.now() })
  return code
}
