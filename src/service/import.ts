// KML / KMZ import service.
// - Parses Placemarks with a single <Point> into { name, description, lat, lon }.
// - KMZ is unzipped in-memory: scans the End-of-Central-Directory record,
//   walks Central Directory entries, locates the first .kml file, then inflates it.

export type ParsedPlacemark = {
  name: string
  description: string
  lat: number
  lon: number
}

const decoder = new TextDecoder()

// ---- Zip extraction (KMZ = STORED or DEFLATE) ----
const findKmlInKmz = (buf: Uint8Array): Uint8Array => {
  // End of central directory record signature 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Invalid KMZ: EOCD not found')

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const cdCount = dv.getUint16(eocd + 10, true)
  const cdOffset = dv.getUint32(eocd + 16, true)

  let p = cdOffset
  for (let i = 0; i < cdCount; i++) {
    // Central directory file header signature 0x02014b50
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Invalid KMZ: bad CD header')
    const method = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const uncompSize = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const localOffset = dv.getUint32(p + 42, true)
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen))

    if (name.toLowerCase().endsWith('.kml')) {
      // Read local file header to skip its variable fields
      const lh = localOffset
      if (dv.getUint32(lh, true) !== 0x04034b50) throw new Error('Invalid KMZ: bad local header')
      const lhNameLen = dv.getUint16(lh + 26, true)
      const lhExtraLen = dv.getUint16(lh + 28, true)
      const dataStart = lh + 30 + lhNameLen + lhExtraLen
      const data = buf.subarray(dataStart, dataStart + compSize)

      if (method === 0) return data
      if (method === 8) {
        // @ts-ignore - Bun runtime API; windowBits = -15 → raw DEFLATE (no zlib header)
        return Bun.inflateSync(data, { windowBits: -15 }) as Uint8Array
      }
      throw new Error(`KMZ uses unsupported compression method ${method}`)
    }

    p += 46 + nameLen + extraLen + commentLen
  }

  throw new Error('No .kml entry inside KMZ')
}

// ---- KML parsing (regex-based, no external XML dep) ----
const decodeEntities = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()

const tagContent = (block: string, tag: string): string | null => {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = block.match(re)
  return m ? decodeEntities(m[1]) : null
}

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const parseKml = (xml: string): ParsedPlacemark[] => {
  const out: ParsedPlacemark[] = []
  const placemarkRe = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi
  let m: RegExpExecArray | null
  while ((m = placemarkRe.exec(xml)) !== null) {
    const block = m[1]

    // Only Placemarks with a single <Point><coordinates> are imported as POIs.
    const point = block.match(/<Point\b[^>]*>([\s\S]*?)<\/Point>/i)
    if (!point) continue

    const coordsRaw = tagContent(point[1], 'coordinates')
    if (!coordsRaw) continue

    // KML coordinates are "lon,lat[,alt]"
    const parts = coordsRaw.split(/\s+/)[0].split(',')
    if (parts.length < 2) continue
    const lon = parseFloat(parts[0])
    const lat = parseFloat(parts[1])
    if (!isFinite(lat) || !isFinite(lon)) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue

    const name = (tagContent(block, 'name') || 'Imported point').slice(0, 255)
    const description = stripHtml(tagContent(block, 'description') || '')

    out.push({ name, description, lat, lon })
  }
  return out
}

const importService = {
  async parse(filename: string, file: File): Promise<ParsedPlacemark[]> {
    const lower = filename.toLowerCase()
    const buf = new Uint8Array(await file.arrayBuffer())

    let xml: string
    if (lower.endsWith('.kmz')) {
      const kml = findKmlInKmz(buf)
      xml = decoder.decode(kml)
    } else if (lower.endsWith('.kml')) {
      xml = decoder.decode(buf)
    } else {
      throw new Error('Unsupported file format. Only .kml and .kmz are allowed.')
    }
    return parseKml(xml)
  },
}

export default importService
