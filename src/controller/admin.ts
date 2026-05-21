import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { HTTPException } from 'hono/http-exception'
import { randomUUID } from 'node:crypto'

import dao from 'dao'
import { authMiddleware, authQueryMiddleware, adminMiddleware } from 'service/middleware'
import { DedupJob, registry } from 'service/dedup'

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
  try { body = await c.req.json() } catch (_) { /* empty body allowed */ }
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
      await dao.dedup.updateJob(
        id,
        job.state,
        job.processed,
        job.duplicates,
        job.kept,
        job.error ?? null
      )
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
    let unsub: (() => void) | null = null
    let resolveDone: (() => void) | null = null

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

export default admin
