import { Builder, By, WebDriver } from 'selenium-webdriver'
import Chrome from 'selenium-webdriver/chrome'
import dao from 'dao'
import config from 'config'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import geocoderService from './geocoder'
import categoryService from './category'

/** Default source name used when no source is configured in the admin settings. */
const DEFAULT_SOURCE = 'Pinterest'

export type PinterestState = 'running' | 'finished' | 'error' | 'stopped'

export interface PinterestStats {
  id: string
  state: PinterestState
  processed: number // pins seen
  inserted: number // new locations created
  skipped: number // already existed / no coords / no image
  failed: number // pins that errored
  speed: number // processed per second
  error?: string
}

export type Listener = (s: PinterestStats) => void
export type LogListener = (line: string) => void

const MAX_BUFFERED_LOGS = 400

/**
 * Tracks the progress of a single Pinterest import run. Mirrors the DedupJob
 * pattern: subscribers receive a fresh snapshot on every emit, and the run can
 * be stopped cooperatively (checked between pins). It also keeps a bounded ring
 * buffer of human-readable log lines streamed live to the admin UI.
 */
export class PinterestJob {
  state: PinterestState = 'running'
  processed = 0
  inserted = 0
  skipped = 0
  failed = 0
  startedAt = 0
  error?: string
  aborted = false

  /** Bounded ring buffer of recent log lines (replayed to new subscribers). */
  recentLogs: string[] = []

  private listeners = new Set<Listener>()
  private logListeners = new Set<LogListener>()

  constructor(
    public readonly id: string,
    /** Source name attributed to imported points. */
    public readonly source: string,
  ) {}

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => this.listeners.delete(fn)
  }

  /** Subscribe to log lines; the recent buffer is replayed immediately. */
  subscribeLogs(fn: LogListener): () => void {
    for (const line of this.recentLogs) fn(line)
    this.logListeners.add(fn)
    return () => this.logListeners.delete(fn)
  }

  /** Record a log line: buffered, broadcast to subscribers, and echoed to stdout. */
  log(line: string): void {
    this.recentLogs.push(line)
    if (this.recentLogs.length > MAX_BUFFERED_LOGS) this.recentLogs.shift()
    for (const fn of this.logListeners) fn(line)
    console.log(`[pinterest] ${line}`)
  }

  stop(): void {
    if (this.state === 'running') this.aborted = true
  }

  snapshot(): PinterestStats {
    const elapsed = (Date.now() - this.startedAt) / 1000
    return {
      id: this.id,
      state: this.state,
      processed: this.processed,
      inserted: this.inserted,
      skipped: this.skipped,
      failed: this.failed,
      speed: elapsed > 0 ? this.processed / elapsed : 0,
      error: this.error,
    }
  }

  emit(): void {
    const s = this.snapshot()
    for (const fn of this.listeners) fn(s)
  }
}

class JobRegistry {
  private jobs = new Map<string, PinterestJob>()
  add(job: PinterestJob) {
    this.jobs.set(job.id, job)
  }
  get(id: string) {
    return this.jobs.get(id)
  }
  remove(id: string) {
    this.jobs.delete(id)
  }
}

export const registry = new JobRegistry()

/** Module-level guard: only one Pinterest run may execute at a time. */
let running = false

/** Shape of a pin item returned by the Pinterest BoardFeedResource API. */
interface PinItem {
  id: number
  type: string
  title?: string
  description?: string
  unified_user_note?: string
  images?: {
    orig?: { url: string }
  }
}

/** Session cookies extracted from Selenium after login. */
interface PinterestCookies {
  sessionCookie: string
  csrfToken: string
  userAgent: string
  driver: WebDriver
}

/**
 * Converts a coordinate string to decimal degrees.
 * @param {string} coord - The coordinate string to convert.
 * @returns {string} The converted coordinate.
 */
const convertCoord = (coord: string): number => {
  const match = coord.match(/(\d+)°(\d+)'(\d+(?:\.\d+)?)"([A-Z])/)
  if (!match) return 0

  const [, deg, min, sec, dir] = match
  const pos = ['N', 'E'].includes(dir) ? 1 : -1
  return pos * (parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600)
}

/**
 * Replaces Pinterest thumbnail size segments with `/originals/`
 * to retrieve the full-resolution image URL.
 * @param {string} url - The Pinterest image URL.
 * @returns {string} The full-resolution URL.
 */
const toOriginalUrl = (url: string): string => {
  return url
    .replace('/236x/', '/originals/')
    .replace('/474x/', '/originals/')
    .replace('/736x/', '/originals/')
    .replace('/564x/', '/originals/')
}

/**
 * Builds a headless Chrome WebDriver instance.
 * @returns {WebDriver}
 */
const buildDriver = (): WebDriver => {
  const options = new Chrome.Options()
    .windowSize({ width: 1920, height: 1080 })
    .addArguments('--headless')
    .addArguments('--no-sandbox')
    .addArguments('--disable-dev-shm-usage')
    .addArguments('--disable-gpu', '--log-level=3')

  if (config.selenium?.chromeBinaryPath) {
    options.setChromeBinaryPath(config.selenium.chromeBinaryPath)
  }

  const builder = new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)

  if (config.selenium?.chromedriverPath) {
    const service = new Chrome.ServiceBuilder(config.selenium.chromedriverPath)
    builder.setChromeService(service)
  }

  return builder.build() as unknown as WebDriver
}

/**
 * Logs in to Pinterest via Selenium and returns the session cookies
 * needed to authenticate subsequent API requests.
 * @param {string} email - Pinterest account email.
 * @param {string} password - Pinterest account password.
 * @returns {Promise<PinterestCookies>} The extracted session cookies.
 * @throws {Error} If login fails or required cookies are not found.
 */
const loginAndGetCookies = async (email: string, password: string): Promise<PinterestCookies> => {
  const driver = buildDriver()

  try {
    await driver.get('https://fr.pinterest.com/login')
    await driver.manage().setTimeouts({ implicit: 3000 })

    for (let i = 0; i < 3; i++) {
      try {
        await driver.findElement(By.id('email'))
        break
      } catch {
        await driver.sleep(1000)
      }
    }

    await driver.findElement(By.id('email')).sendKeys(email)
    await driver.findElement(By.id('password')).sendKeys(password)
    await driver.sleep(1000)
    await driver.findElement(By.xpath("//button[@type='submit']")).click()
    await driver.sleep(5000)

    const allCookies = await driver.manage().getCookies()
    const sessionCookieObj = allCookies.find((c) => c.name === '_pinterest_sess')
    const csrfCookieObj = allCookies.find((c) => c.name === 'csrftoken')

    if (!sessionCookieObj || !csrfCookieObj) {
      throw new Error('Login failed: required cookies not found. Check your credentials.')
    }

    const userAgent = (await driver.executeScript('return navigator.userAgent')) as string
    const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join('; ')

    return {
      sessionCookie: cookieHeader,
      csrfToken: csrfCookieObj.value,
      userAgent,
      driver, // ← return the live driver instead of quitting
    }
  } catch (error) {
    await driver.quit()
    throw error
  }
  // NOTE: no finally quit — driver stays alive for API calls
}

const pinterestService = {
  /** Whether a Pinterest run is currently in progress. */
  isRunning: (): boolean => running,

  /**
   * Resolves the source name to attribute to imported points from the admin
   * settings. Falls back to the default when no source is configured.
   * @returns {Promise<{ id: number | null; name: string }>}
   */
  resolveSource: async (): Promise<{ id: number | null; name: string }> => {
    const settings = await dao.pinterest.getSettings()
    if (settings?.source_id && settings?.source_name) {
      return { id: settings.source_id, name: settings.source_name }
    }
    return { id: null, name: DEFAULT_SOURCE }
  },

  /**
   * Entry point for a run: creates the output directory, logs in via Selenium to
   * get session cookies, then fetches the full board feed via the Pinterest API.
   * Progress and final state are reported on the provided job.
   * @param {PinterestJob} job - The job tracking this run.
   * @returns {Promise<void>}
   */
  fetch: async (job: PinterestJob): Promise<void> => {
    running = true
    job.startedAt = Date.now()
    job.state = 'running'
    job.emit()

    const outputDir = path.join(config.path.location)
    let cookies: PinterestCookies | null = null

    try {
      fs.mkdirSync(outputDir, { recursive: true })

      job.log('Logging in to Pinterest via browser...')
      cookies = await loginAndGetCookies(config.pinterest.email, config.pinterest.password)
      job.log('Login successful, cookies extracted.')

      await pinterestService.getFeed(cookies, job)

      job.state = job.aborted ? 'stopped' : 'finished'
      job.log(job.aborted ? 'Run stopped by user.' : 'Run finished.')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('Pinterest run failed:', error)
      job.state = 'error'
      job.error = msg
      job.log(`ERROR: ${msg}`)
    } finally {
      running = false
      if (cookies?.driver) {
        try {
          await cookies.driver.quit()
        } catch (_) {
          /* driver may already be closed */
        }
      }
      job.emit()
    }
  },

  /**
   * Fetches a page of pins from the Pinterest BoardFeedResource API.
   * Recursively follows bookmarks to paginate through the full board.
   * @param {PinterestCookies} cookies - Session cookies from the logged-in browser.
   * @param {PinterestJob} job - The job tracking this run.
   * @param {string[]} [bookmarks] - Pagination bookmarks from a previous response.
   * @returns {Promise<void>}
   */
  getFeed: async (cookies: PinterestCookies, job: PinterestJob, bookmarks?: string[]): Promise<void> => {
    if (job.aborted) return

    if (!bookmarks) {
      const driver = cookies.driver as any

      // Inject interceptor via CDP
      await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: `
        window.__pinterestResponses = []

        // Intercept fetch
        const _originalFetch = window.fetch
        window.fetch = async function(...args) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '')
          console.log('[INTERCEPT] fetch called:', url)
          const response = await _originalFetch(...args)
          if (url.includes('BoardFeedResource')) {
            response.clone().json().then(data => {
              console.log('[INTERCEPT] BoardFeedResource captured!')
              window.__pinterestResponses.push(data)
            }).catch(() => {})
          }
          return response
        }

        // Intercept XHR too in case Pinterest uses that
        const _originalOpen = XMLHttpRequest.prototype.open
        const _originalSend = XMLHttpRequest.prototype.send
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          this.__url = url
          return _originalOpen.apply(this, [method, url, ...rest])
        }
        XMLHttpRequest.prototype.send = function(...args) {
          this.addEventListener('load', function() {
            if (this.__url && this.__url.includes('BoardFeedResource')) {
              console.log('[INTERCEPT] XHR BoardFeedResource captured!')
              try {
                window.__pinterestResponses.push(JSON.parse(this.responseText))
              } catch(e) {}
            }
          })
          return _originalSend.apply(this, args)
        }
      `,
      })

      await cookies.driver.get(`https://fr.pinterest.com${config.pinterest.boardUrl}`)
      await cookies.driver.sleep(3000)

      const interceptReady = await cookies.driver.executeScript(
        `return typeof window.__pinterestResponses !== 'undefined'`,
      )
      console.log('Intercept script active:', interceptReady)

      await cookies.driver.executeScript(`window.scrollTo(0, document.body.scrollHeight)`)
      await cookies.driver.sleep(3000)
    } else {
      await cookies.driver.executeScript(`window.scrollTo(0, document.body.scrollHeight)`)
      await cookies.driver.sleep(3000)
    }

    // Poll for intercepted responses
    let intercepted: any = null
    for (let i = 0; i < 15; i++) {
      const responses = (await cookies.driver.executeScript(`return window.__pinterestResponses.splice(0)`)) as any[]

      if (responses && responses.length > 0) {
        intercepted = responses[0]
        break
      }

      console.log(`Waiting for BoardFeedResource response... attempt ${i + 1}`)
      await cookies.driver.sleep(1000)
    }

    if (!intercepted) {
      throw new Error('No BoardFeedResource response intercepted after scrolling.')
    }

    job.log(`Intercepted Pinterest response — ${intercepted?.resource_response?.data?.length ?? 0} pins on this page`)
    await pinterestService.parseFeed(intercepted, cookies, job)
  },

  /**
   * Parses a feed API response, saves each pin, and paginates if more pages exist.
   * @param {Record<string, any>} json - The raw JSON response from the Pinterest API.
   * @param {PinterestCookies} cookies - Session cookies, forwarded for paginated requests.
   * @param {PinterestJob} job - The job tracking this run.
   * @returns {Promise<void>}
   */
  parseFeed: async (json: Record<string, any>, cookies: PinterestCookies, job: PinterestJob): Promise<void> => {
    const items: PinItem[] = json?.resource_response?.data ?? []

    for (const item of items) {
      if (job.aborted) return
      if (item?.type === 'pin') {
        job.processed++
        await pinterestService.savePin(item, job)
        job.emit()
      }
    }

    const rssMb = Math.round(process.memoryUsage().rss / 1048576)
    job.log(
      `Page done — processed=${job.processed} inserted=${job.inserted} skipped=${job.skipped} failed=${job.failed} (rss ${rssMb}MB)`,
    )

    const bookmarks: string[] | undefined = json?.resource?.options?.bookmarks
    const isEnd = !bookmarks || bookmarks[0] === '-end-'

    if (isEnd || job.aborted) {
      job.log('Reached end of board feed.')
      return
    }

    await pinterestService.getFeed(cookies, job, bookmarks)
  },

  /**
   * Downloads the image for a pin and records it in the database,
   * preserving all available metadata (id, description, coordinates).
   * Skips pins that have already been saved. Updates the job counters.
   * @param {PinItem} item - The pin object from the Pinterest API.
   * @param {PinterestJob} job - The job tracking this run.
   * @returns {Promise<void>}
   */
  savePin: async (item: PinItem, job: PinterestJob): Promise<void> => {
    const SOURCE = job.source

    try {
      const exists = await dao.location.getByPid(item.id, SOURCE)
      if (exists) {
        job.skipped++
        return
      }

      const imgUrl = item?.images?.orig?.url
      if (!imgUrl) {
        job.log(`Pin ${item.id} has no image URL, skipping.`)
        job.skipped++
        return
      }

      const originalUrl = toOriginalUrl(imgUrl)
      const ext = path.extname(originalUrl) || '.jpg'
      const imgName = `${randomUUID()}${ext}`
      const imgDest = path.join(config.path.location, imgName)

      const imgResponse = await fetch(originalUrl)
      if (!imgResponse.ok) {
        throw new Error(`Failed to fetch image: ${imgResponse.status} ${imgResponse.statusText}`)
      }

      fs.writeFileSync(imgDest, new Uint8Array(await imgResponse.arrayBuffer()))

      const rawText = item.description ?? item.unified_user_note ?? ''

      // Format 1: "Name lat lon    address"
      const formatA = rawText.match(/^\s*(.*?)\s+([\d]+°[\d]+'[\d.]+"[NS])\s+([\d]+°[\d]+'[\d.]+"[EW])\s*(.*)/s)

      // Format 2: "lat lon    Name address"
      const formatB = rawText.match(/^\s*([\d]+°[\d]+'[\d.]+"[NS])\s+([\d]+°[\d]+'[\d.]+"[EW])\s*(.*)/s)

      let lat: number | null = null
      let lon: number | null = null
      let name: string | null = null
      let description: string | null = null

      if (formatB) {
        // Starts with coordinates
        lat = convertCoord(formatB[1])
        lon = convertCoord(formatB[2])
        name = formatB[3].trim().substring(0, 250) || (item.title ?? null)
      } else if (formatA && formatA[1].trim()) {
        // Name comes first
        lat = convertCoord(formatA[2])
        lon = convertCoord(formatA[3])
        name = formatA[1].trim().substring(0, 250)
      } else {
        // No coordinates found at all
        name = item.title ?? null
      }
      name = item.title?.substring(0, 250) ?? name ?? null
      description = item.description?.substring(0, 250) ?? null

      const country = lat && lon ? await geocoderService.getCountry(lat, lon) : null
      const category: any = name ? categoryService.getCategory(name) : null

      await dao.location.addPinterest(
        item.id,
        SOURCE,
        `${config.pinterest.url}/pin/${item.id}`,
        lat,
        lon,
        name,
        description,
        `/${path.join(config.path.location, imgName)}`,
        country?.id ?? null,
        category?.id ?? null,
      )

      job.inserted++
      job.log(`Imported pin ${item.id}${name ? ` — ${name}` : ''}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      job.log(`Failed pin ${item.id}: ${msg}`)
      job.failed++
    }
  },
}

export default pinterestService
