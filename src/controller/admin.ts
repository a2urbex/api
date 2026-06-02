import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { HTTPException } from 'hono/http-exception'
import { randomUUID } from 'crypto'

import dao from 'dao'
import utils from '@core/utils'
import config from 'config'
import { authMiddleware, authQueryMiddleware, adminMiddleware } from 'service/middleware'
import { DedupJob, registry } from 'service/dedup'
import importService from 'service/import'
import geocoderService from 'service/geocoder'

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * POST /admin/dedup/start
 * Starts a deduplication job. Returns the job id immediately; progress is
 * streamed over /admin/dedup/:id/stream.
 *
 * body @param {number} radius - Optional - radius in meters (default 25)
 */
admin.post('/dedup/start', authMiddleware, adminMiddleware, async (c) => {
  const user = c.get('user')
  let body: any = {}
  try {
    body = await c.req.json()
  } catch (_) {
    /* empty body allowed */
  }
  const radiusM = Math.max(1, Math.min(1000, parseInt(body.radius) || 25))

  const total = await dao.dedup.countActivePoints()
  const id = randomUUID()
  const job = new DedupJob(id, dao.dedup.streamPoints(), total, radiusM)
  registry.add(job)

  await dao.dedup.createJob(id, total, radiusM, user.id)

  // Batched soft-delete to avoid 1 UPDATE per duplicate.
  const removedBuf: number[] = []
  const flushRemoved = async () => {
    if (!removedBuf.length) return
    const ids = removedBuf.splice(0, removedBuf.length)
    await dao.dedup.markRemoved(id, ids)
  }

  // Fire and forget — progress is observed via SSE.
  ;(async () => {
    try {
      await job.run({
        chunkSize: 5_000,
        onRemoved: (pid) => {
          removedBuf.push(pid)
          if (removedBuf.length >= 5_000) return flushRemoved()
        },
      })
      await flushRemoved()
    } catch (e) {
      console.error('Dedup job failed', e)
    } finally {
      await dao.dedup.updateJob(id, job.state, job.processed, job.duplicates, job.kept, job.error ?? null)
    }
  })()

  return c.json({ id, total, radius: radiusM })
})

/**
 * POST /admin/dedup/:id/stop
 * Signals a running job to stop gracefully.
 */
admin.post('/dedup/:id/stop', authMiddleware, adminMiddleware, (c) => {
  const job = registry.get(c.req.param('id'))
  if (!job) throw new HTTPException(404, { message: 'Job not found' })
  job.stop()
  return c.json({ ok: true })
})

/**
 * GET /admin/dedup/:id
 * Returns the current snapshot (REST polling fallback).
 */
admin.get('/dedup/:id', authMiddleware, adminMiddleware, (c) => {
  const job = registry.get(c.req.param('id'))
  if (!job) throw new HTTPException(404, { message: 'Job not found' })
  return c.json(job.snapshot())
})

/**
 * GET /admin/dedup/:id/stream?token=JWT
 * Server-Sent Events stream of live stats. Token is passed as a query
 * parameter because EventSource cannot set custom headers.
 */
admin.get('/dedup/:id/stream', authQueryMiddleware, adminMiddleware, (c) => {
  const job = registry.get(c.req.param('id'))
  if (!job) throw new HTTPException(404, { message: 'Job not found' })

  return streamSSE(c, async (stream) => {
    let unsub: () => void = () => {}
    let resolveDone: () => void = () => {}

    stream.onAbort(() => {
      unsub?.()
      resolveDone?.()
    })

    await new Promise<void>((resolve) => {
      resolveDone = resolve
      unsub = job.subscribe(async (s) => {
        try {
          await stream.writeSSE({ event: 'stats', data: JSON.stringify(s) })
        } catch (_) {
          // client disconnected
        }
        if (s.state === 'finished' || s.state === 'stopped' || s.state === 'error') {
          resolve()
        }
      })
    })

    unsub?.()
  })
})

/**
 * GET /admin/dedup
 * History of past jobs.
 */
admin.get('/dedup', authMiddleware, adminMiddleware, async (c) => {
  const jobs = await dao.dedup.listJobs(20)
  return c.json({ list: jobs })
})

/**
 * POST /admin/imports
 * Upload a KML/KMZ file and create locations attributed to the chosen user.
 *
 * formData @param {File} file
 * formData @param {string} assignee - Optional - target username (defaults to 'a2urbex')
 * formData @param {string} categoryId - Optional - category to attach to imported locations
 * formData @param {string} overwriteDuplicates - 'true' to update existing matches by name+coords
 * formData @param {string} createFavoritesList - 'true' to create a favorite list named after the file
 */
admin.post('/imports', authMiddleware, adminMiddleware, async (c) => {
  const uploader = c.get('user')
  const body: any = await c.req.parseBody()

  const file: File | undefined = body.file
  if (!file || typeof file === 'string') throw new HTTPException(400, { message: 'Missing file' })

  const filename = file.name
  const lower = filename.toLowerCase()
  if (!lower.endsWith('.kml') && !lower.endsWith('.kmz')) {
    throw new HTTPException(400, { message: 'Only .kml and .kmz files are supported' })
  }

  const rawAssignee = body.assignee ? body.assignee.toString() : ''
  const categoryId = body.categoryId ? parseInt(body.categoryId) : null
  const overwriteDuplicates = body.overwriteDuplicates === 'true' || body.overwriteDuplicates === '1'
  const createFavoritesList = body.createFavoritesList === 'true' || body.createFavoritesList === '1'

  // 'a2urbex' (and empty) means platform-owned → no user_id on the locations.
  const isPlatform = !rawAssignee || rawAssignee.toLowerCase() === 'a2urbex'
  let assigneeId: number | null = null
  if (!isPlatform) {
    const u = await dao.user.getByUsername(rawAssignee)
    if (!u) throw new HTTPException(400, { message: `Assignee user '${rawAssignee}' not found` })
    assigneeId = u.id
  }

  const jobId = randomUUID()
  await dao.importJob.create(jobId, filename, file.size, categoryId, assigneeId, uploader.id, {
    overwriteDuplicates,
    createFavoritesList,
    platform: isPlatform,
  })

  let inserted = 0
  let skipped = 0
  let updated = 0
  let favoriteId: number | null = null

  try {
    const placemarks = await importService.parse(filename, file)

    if (createFavoritesList && placemarks.length) {
      const favName = filename.replace(/\.(kml|kmz)$/i, '').slice(0, 80) || 'Imported'
      const add = await dao.favorite.add(favName)
      favoriteId = add.insertId
      // Favorites need at least one owning user; for platform imports we
      // attach the uploader so the list can be reached & shared from the admin UI.
      await dao.favorite.addUser(favoriteId!, assigneeId ?? uploader.id)
    }

    for (const p of placemarks) {
      const existing = await dao.location.findNearbyByName(p.name, p.lat, p.lon)
      if (existing) {
        if (overwriteDuplicates) {
          const localImage = p.imageUrl ? await utils.downloadImage(p.imageUrl, config.path.location) : null
          await dao.location.updateCoreFields(existing.id, p.name, p.description, p.lat, p.lon, categoryId, localImage)
          updated++
          if (favoriteId) {
            const has = await dao.favorite.hasLocation(favoriteId, existing.id)
            if (!has) await dao.favorite.addLocation(favoriteId, existing.id)
          }
        } else {
          skipped++
        }
        continue
      }

      const country = await geocoderService.getCountry(p.lat, p.lon).catch(() => null)
      const localImage = p.imageUrl ? await utils.downloadImage(p.imageUrl, config.path.location) : null
      const add = await dao.location.add(
        p.name,
        p.description,
        localImage as any,
        p.lat,
        p.lon,
        categoryId as any,
        country?.id ?? null,
        assigneeId,
      )
      inserted++
      if (favoriteId) await dao.favorite.addLocation(favoriteId, add.insertId)
    }

    await dao.importJob.finish(jobId, 'finished', placemarks.length, inserted, skipped, updated, favoriteId, null)

    return c.json({
      id: jobId,
      total: placemarks.length,
      inserted,
      skipped,
      updated,
      favoriteId: favoriteId ? utils.encrypt(favoriteId.toString(), 'favorite') : null,
    })
  } catch (e: any) {
    const msg = e?.message || String(e)
    await dao.importJob.finish(jobId, 'error', 0, inserted, skipped, updated, favoriteId, msg)
    throw new HTTPException(500, { message: `Import failed: ${msg}` })
  }
})

/**
 * GET /admin/imports
 * History of past imports.
 */
admin.get('/imports', authMiddleware, adminMiddleware, async (c) => {
  const jobs = await dao.importJob.list(30)
  return c.json({ list: jobs })
})

/**
 * DELETE /admin/imports/:id
 * Delete a history entry (does not delete the imported locations).
 */
admin.delete('/imports/:id', authMiddleware, adminMiddleware, async (c) => {
  await dao.importJob.delete(c.req.param('id'))
  return c.json({ ok: true })
})

export default admin
