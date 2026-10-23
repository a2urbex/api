// Wikimedia Commons importer: geotagged photos in abandoned-places categories.
// One MediaWiki call returns coordinates + image URL + author + licence (prop=coordinates|imageinfo).
//
//   bun run src/importers/commons.ts --dry-run
//   bun run src/importers/commons.ts --limit=200 --category="Abandoned hospitals"
import { ImportRecord, fetchJson, parseArgs, rateLimiter, runImport, stripHtml } from './common'

export const SOURCE = 'Wikimedia Commons'
const API = 'https://commons.wikimedia.org/w/api.php'

// Existing Commons categories (checked); searched with their subcategories (deepcat)
const CATEGORIES = [
  'Abandoned hospitals',
  'Abandoned factories',
  'Abandoned hotels',
  'Abandoned houses',
  'Abandoned schools',
  'Abandoned churches',
  'Abandoned castles',
  'Abandoned cinemas',
  'Abandoned power stations',
  'Abandoned mines',
  'Abandoned amusement parks',
  'Abandoned prisons',
  'Abandoned restaurants',
  'Urban exploration',
  'Abandoned buildings in France',
  'Abandoned buildings in Belgium',
  'Abandoned buildings in Germany',
  'Abandoned buildings in Italy',
]

const cleanTitle = (title: string) =>
  title
    .replace(/^File:/, '')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/\s*-\s*geograph\.org\.uk\s*-\s*\d+/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\(\d{6,}\)/g, '') // Flickr ids in mirrored file names
    .replace(/\b(IMG|DSC|DSCF|P)\s?_?\d{3,}\b/gi, '')
    .replace(/^\d{4} \d{2} \d{2}( \d{2} \d{2} \d{2})?/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

async function* fromCategories(categories: string[]): AsyncIterable<ImportRecord> {
  const wait = rateLimiter(1000) // Wikimedia etiquette: 1 req/s with a descriptive User-Agent
  for (const cat of categories) {
    const hint = cat.replace(/^Abandoned |^Urban /, '').replace(/ in .*$/, '')
    let cont: Record<string, string> = {}
    do {
      await wait()
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: `deepcat:"${cat}" filetype:bitmap`,
        gsrlimit: '50',
        prop: 'coordinates|imageinfo',
        colimit: 'max',
        iiprop: 'url|extmetadata',
        iiurlwidth: '1280',
        iiextmetadatafilter: 'Artist|LicenseShortName|ObjectName|ImageDescription',
        ...cont,
      })
      const data = await fetchJson(`${API}?${params}`)
      for (const p of Object.values<any>(data?.query?.pages || {})) {
        const co = p.coordinates?.[0]
        const ii = p.imageinfo?.[0]
        const meta = ii?.extmetadata || {}
        yield {
          pid: Number(p.pageid),
          url: ii?.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
          lat: co ? Number(co.lat) : null,
          lon: co ? Number(co.lon) : null,
          name: cleanTitle(stripHtml(meta.ObjectName?.value) || p.title) || 'Abandoned place',
          description: stripHtml(meta.ImageDescription?.value).slice(0, 1000) || null,
          imageUrl: ii?.thumburl || ii?.url || null,
          credit: stripHtml(meta.Artist?.value) || null,
          license: stripHtml(meta.LicenseShortName?.value) || null,
          hint,
        }
      }
      cont = data?.continue?.gsroffset ? { gsroffset: String(data.continue.gsroffset), continue: data.continue.continue } : {}
    } while (Object.keys(cont).length)
  }
}

// args.category: optional "Cat A|Cat B" override
export const records = (args: Record<string, string> = {}) =>
  fromCategories(args.category ? args.category.split('|') : CATEGORIES)

if (import.meta.main) {
  const opts = parseArgs()
  await runImport(SOURCE, records(opts.args), opts)
}
