import { HTTPException } from 'hono/http-exception'
import dao from 'dao'

// Roles are read from the DB (not the JWT) so an admin change applies without re-login.
// Small TTL cache keeps it to ~1 query per user every 15 s.
const TTL = 15000
const cache = new Map<number, { roles: string[]; at: number }>()

const parse = (roles: any): string[] => {
  if (Array.isArray(roles)) return roles
  try {
    return JSON.parse(roles) || []
  } catch {
    return []
  }
}

export const currentRoles = async (userId: number): Promise<string[]> => {
  const hit = cache.get(userId)
  if (hit && Date.now() - hit.at < TTL) return hit.roles
  const row = await dao.user.getRoles(userId)
  if (!row) throw new HTTPException(401, { message: 'Unknown user' })
  const roles = parse(row.roles)
  cache.set(userId, { roles, at: Date.now() })
  return roles
}

export const invalidateRoles = (userId: number) => cache.delete(userId)
