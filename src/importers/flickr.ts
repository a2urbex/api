// Flickr importer: photos tagged urbex / abandoned, geotagged at street-level accuracy, Creative Commons only.
// Needs a free API key in FLICKR_API_KEY (https://www.flickr.com/services/apps/create/).
//
//   bun run src/importers/flickr.ts --dry-run
//   bun run src/importers/flickr.ts --since=2018-01-01 --tags=urbex,abandoned,lostplace
import config from 'config'
import { ImportRecord, fetchJson, parseArgs, rateLimiter, runImport } from './common'

export const SOURCE = 'Flickr'
const API = 'https://api.flickr.com/services/rest/'

// Creative Commons / public domain licence ids (flickr.photos.licenses.getInfo)
const LICENSES: Record<string, string> = {
  '1': 'CC BY-NC-SA 2.0', '2': 'CC BY-NC 2.0', '3': 'CC BY-NC-ND 2.0', '4': 'CC BY 2.0', '5': 'CC BY-SA 2.0', '6': 'CC BY-ND 2.0',
  '9': 'CC0 1.0', '10': 'Public Domain Mark', '11': 'CC BY 4.0', '12': 'CC BY-SA 4.0', '13': 'CC BY-ND 4.0',
  '14': 'CC BY-NC 4.0', '15': 'CC BY-NC-SA 4.0', '16': 'CC BY-NC-ND 4.0',
}
const MIN_ACCURACY = 15 // 16 = street, 11 = city: keep only precise geotags

async function* search(tags: string, since: string): AsyncIterable<ImportRecord> {
  if (!config.flickrApiKey) throw new Error('FLICKR_API_KEY is missing in .env')
  const wait = rateLimiter(1100) // Flickr allows 3600 calls/hour

  // Flickr caps a search at ~4000 results: walk time windows of 3 months
  const DAY = 86400
  let from = Math.floor(Date.parse(since) / 1000)
  const now = Math.floor(Date.now() / 1000)
  while (from < now) {
    const to = Math.min(now, from + 91 * DAY)
    for (let page = 1, pages = 1; page <= pages && page <= 16; page++) {
      await wait()
      const data = await fetchJson(
        `${API}?${new URLSearchParams({
          method: 'flickr.photos.search',
          api_key: config.flickrApiKey,
          format: 'json',
          nojsoncallback: '1',
          tags,
          tag_mode: 'any',
          has_geo: '1',
          accuracy: String(MIN_ACCURACY),
          license: Object.keys(LICENSES).join(','),
          content_type: '1',
          media: 'photos',
          safe_search: '1',
          min_upload_date: String(from),
          max_upload_date: String(to),
          extras: 'geo,url_l,url_c,url_z,owner_name,license,tags',
          per_page: '250',
          page: String(page),
        })}`,
      )
      if (data?.stat !== 'ok') throw new Error(`Flickr: ${data?.message || 'error'}`)
      pages = data.photos?.pages || 0
      for (const p of data.photos?.photo || []) {
        if (Number(p.accuracy) < MIN_ACCURACY) continue
        yield {
          pid: Number(p.id),
          url: `https://www.flickr.com/photos/${p.owner}/${p.id}`,
          lat: p.latitude ? Number(p.latitude) : null,
          lon: p.longitude ? Number(p.longitude) : null,
          name: (p.title || '').trim() || 'Abandoned place',
          description: null,
          imageUrl: p.url_l || p.url_c || p.url_z || null,
          credit: p.ownername || p.owner,
          license: LICENSES[String(p.license)] || null,
          hint: p.tags,
        }
      }
    }
    from = to
  }
}

export const records = (args: Record<string, string> = {}) =>
  search(args.tags || 'urbex,abandoned,lostplace,abandonedplaces', args.since || '2012-01-01')

if (import.meta.main) {
  const opts = parseArgs()
  await runImport(SOURCE, records(opts.args), opts)
}
