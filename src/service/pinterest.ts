import { Builder, By, WebDriver } from 'selenium-webdriver'
import Chrome from 'selenium-webdriver/chrome'
import dao from 'dao'
import config from 'config'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const SOURCE = 'Pinterest'

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
  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(
      new Chrome.Options()
        .windowSize({ width: 1920, height: 1080 })
        .addArguments('--headless')
        .addArguments('--disable-gpu', '--log-level=3'),
    )
    .build() as unknown as WebDriver
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
  /**
   * Entry point: creates the output directory, logs in via Selenium to get
   * session cookies, then fetches the full board feed via the Pinterest API.
   * @returns {Promise<void>}
   */
  fetch: async (): Promise<void> => {
    const outputDir = path.join(config.path.location)

    try {
      fs.mkdirSync(outputDir, { recursive: true })
    } catch (error) {
      console.error(`Failed to create output directory "${outputDir}":`, error)
      return
    }

    let cookies: PinterestCookies
    try {
      console.log('Logging in to Pinterest via browser...')
      cookies = await loginAndGetCookies(config.pinterest.email, config.pinterest.password)
      console.log('Login successful, cookies extracted.')
    } catch (error) {
      console.error('Login failed:', error)
      return
    }

    await pinterestService.getFeed(cookies)
  },

  /**
   * Fetches a page of pins from the Pinterest BoardFeedResource API.
   * Recursively follows bookmarks to paginate through the full board.
   * @param {PinterestCookies} cookies - Session cookies from the logged-in browser.
   * @param {string[]} [bookmarks] - Pagination bookmarks from a previous response.
   * @returns {Promise<void>}
   */
  getFeed: async (cookies: PinterestCookies, bookmarks?: string[]): Promise<void> => {
    try {
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

        // Check if the intercept script is even present
        const interceptReady = await cookies.driver.executeScript(
          `return typeof window.__pinterestResponses !== 'undefined'`,
        )
        console.log('Intercept script active:', interceptReady)

        // Check browser console logs for [INTERCEPT] messages
        const logs = await (cookies.driver as any).manage().logs().get('browser')
        logs.forEach((log: any) => console.log('Browser log:', log.message))

        await cookies.driver.executeScript(`window.scrollTo(0, document.body.scrollHeight)`)
        await cookies.driver.sleep(3000)

        // Check logs again after scroll
        const logs2 = await (cookies.driver as any).manage().logs().get('browser')
        logs2.forEach((log: any) => console.log('Browser log after scroll:', log.message))
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

      console.log('Intercepted Pinterest response, pins:', intercepted?.resource_response?.data?.length)
      await pinterestService.parseFeed(intercepted, cookies)
    } catch (error) {
      console.error('Error fetching Pinterest feed:', error)
      await cookies.driver.quit()
    }
  },

  /**
   * Parses a feed API response, saves each pin, and paginates if more pages exist.
   * @param {Record<string, any>} json - The raw JSON response from the Pinterest API.
   * @param {PinterestCookies} cookies - Session cookies, forwarded for paginated requests.
   * @returns {Promise<void>}
   */
  parseFeed: async (json: Record<string, any>, cookies: PinterestCookies): Promise<void> => {
    const items: PinItem[] = json?.resource_response?.data ?? []

    for (const item of items) {
      if (item?.type === 'pin') {
        await pinterestService.savePin(item)
      }
    }

    const bookmarks: string[] | undefined = json?.resource?.options?.bookmarks
    const isEnd = !bookmarks || bookmarks[0] === '-end-'

    if (isEnd) {
      console.log('Reached end of board feed.')
      await cookies.driver.quit()
      return
    }

    await pinterestService.getFeed(cookies, bookmarks)
  },

  /**
   * Downloads the image for a pin and records it in the database,
   * preserving all available metadata (id, description, coordinates).
   * Skips pins that have already been saved.
   * @param {PinItem} item - The pin object from the Pinterest API.
   * @returns {Promise<boolean>} `true` if saved, `false` if skipped or failed.
   */
  savePin: async (item: PinItem): Promise<boolean> => {
    console.log(`Processing pin ${item.id}...`)

    try {
      const exists = await dao.location.getByPid(item.id, SOURCE)
      if (exists) {
        console.log(`Pin ${item.id} already exists, skipping.`)
        return false
      }

      const imgUrl = item?.images?.orig?.url
      if (!imgUrl) {
        console.warn(`Pin ${item.id} has no image URL, skipping.`)
        return false
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

      await dao.location.addPinterest(
        item.id,
        SOURCE,
        `${config.pinterest.url}/pin/${item.id}`,
        lat,
        lon,
        item.title?.substring(0, 250) ?? name ?? null,
        item.description?.substring(0, 250) ?? null,
        `/${path.join(config.path.location, imgName)}`,
      )

      console.log(
        item.id,
        SOURCE,
        `${config.pinterest.url}/pin/${item.id}`,
        lat,
        lon,
        item.title?.substring(0, 250) ?? name ?? null,
        item.description?.substring(0, 250) ?? null,
        `/${path.join(config.path.location, imgName)}`,
      )

      return true
    } catch (error) {
      console.error(`Error saving pin ${item.id}:`, error)
      return false
    }
  },
}

export default pinterestService
