// Wikidata importer: ruins and abandoned buildings that have BOTH coordinates (P625) and an image (P18).
// The P18 image is a Commons file: its thumbnail URL, author and licence are fetched in batches of 50.
//
//   bun run src/importers/wikidata.ts --dry-run
//   bun run src/importers/wikidata.ts --country=Q142        (France only)
import { ImportRecord, fetchJson, parseArgs, rateLimiter, runImport, stripHtml } from './common'

export const SOURCE = 'Wikidata'
const SPARQL = 'https://query.wikidata.org/sparql'
const COMMONS = 'https://commons.wikimedia.org/w/api.php'

// ruins (Q109607), abandoned building (Q106765618), or state of use = abandoned (P5817 = Q63065035)
const query = (country?: string) => `
SELECT ?item ?itemLabel ?coord ?image (SAMPLE(?typeLabel) AS ?type) WHERE {
  { ?item wdt:P31/wdt:P279* wd:Q109607 } UNION
  { ?item wdt:P31/wdt:P279* wd:Q106765618 } UNION
  { ?item wdt:P5817 wd:Q63065035 }
  ?item wdt:P625 ?coord ; wdt:P18 ?image .
  ${country ? `?item wdt:P17 wd:${country} .` : ''}
  OPTIONAL { ?item wdt:P31 ?t . ?t rdfs:label ?typeLabel . FILTER(LANG(?typeLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,de,it,es,nl,pt". }
}
GROUP BY ?item ?itemLabel ?coord ?image`

const parsePoint = (wkt: string) => {
  const m = wkt.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/)
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : { lat: null, lon: null }
}

async function* fromSparql(country?: string): AsyncIterable<ImportRecord> {
  const res = await fetchJson(`${SPARQL}?${new URLSearchParams({ query: query(country), format: 'json' })}`, {
    headers: { Accept: 'application/sparql-results+json' },
  })
  const rows = (res?.results?.bindings || []).map((b: any) => ({
    qid: b.item.value.split('/').pop() as string,
    label: b.itemLabel?.value as string,
    type: b.type?.value as string | undefined,
    file: decodeURIComponent(b.image.value.split('/').pop()) as string,
    ...parsePoint(b.coord.value),
  }))
  console.log(`Wikidata: ${rows.length} items with coordinates + image`)

  const wait = rateLimiter(1000)
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    await wait()
    const data = await fetchJson(
      `${COMMONS}?${new URLSearchParams({
        action: 'query',
        format: 'json',
        titles: batch.map((r: any) => `File:${r.file}`).join('|'),
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '1280',
        iiextmetadatafilter: 'Artist|LicenseShortName',
      })}`,
    )
    const norm = new Map<string, string>((data?.query?.normalized || []).map((n: any) => [n.from, n.to]))
    const byTitle = new Map<string, any>(Object.values<any>(data?.query?.pages || {}).map((p: any) => [p.title, p.imageinfo?.[0]]))
    for (const r of batch) {
      const t = `File:${r.file}`
      const ii = byTitle.get(norm.get(t) || t) || byTitle.get(t.replace(/_/g, ' '))
      const meta = ii?.extmetadata || {}
      yield {
        pid: Number(r.qid.replace(/^Q/, '')),
        url: `https://www.wikidata.org/wiki/${r.qid}`,
        lat: r.lat,
        lon: r.lon,
        name: r.label && !/^Q\d+$/.test(r.label) ? r.label : 'Ruins',
        description: r.type ? `${r.type} (Wikidata ${r.qid})` : `Wikidata ${r.qid}`,
        imageUrl: ii?.thumburl || ii?.url || null,
        credit: stripHtml(meta.Artist?.value) || null,
        license: stripHtml(meta.LicenseShortName?.value) || null,
        hint: r.type,
      }
    }
  }
}

// args.country: optional Wikidata country id (Q142 = France)
export const records = (args: Record<string, string> = {}) => fromSparql(args.country || undefined)

if (import.meta.main) {
  const opts = parseArgs()
  await runImport(SOURCE, records(opts.args), opts)
}
