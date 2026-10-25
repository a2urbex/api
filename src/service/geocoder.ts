import * as crcLib from 'country-reverse-geocoding'
import * as countries from 'i18n-iso-countries'
import dao from 'dao'

// `my` (pattern fwk) expose les contours des pays de la lib, réutilisés pour cadrer la carte
const crcData: { country_data?: any[] } = {}
const crc = crcLib.country_reverse_geocoding({}, crcData)

type Ring = [number, number][]
type Bounds = [[number, number], [number, number]]

// Aire approchée (degrés², corrigée de la latitude) : suffit pour comparer les morceaux d'un même pays
const ringArea = (ring: Ring) => {
  let a = 0
  let lat = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
    lat += ring[i][1]
  }
  return (Math.abs(a) / 2) * Math.cos((lat / ring.length) * (Math.PI / 180))
}

const boundsCache = new Map<string, Bounds | null>()

const geocoderService = {
  getCountry: async (lat: number, lon: number) => {
    if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return

    const result = crc.get_country(lat, lon)
    if (!result?.code) return

    const code = countries.alpha3ToAlpha2(result.code)
    if (!code) return

    const exist = await dao.country.getFromCode(code)
    if (exist) return exist

    const add = await dao.country.add(result.name, code)
    return { id: add.insertId, name: result.name, code }
  },

  /**
   * Zone [[sud, ouest], [nord, est]] d'un pays (ISO alpha-2), pour la vue de départ de la carte.
   * Seuls les morceaux d'au moins 25 % du plus grand comptent : Guyane, Alaska ou Svalbard ne décentrent pas la vue.
   */
  getBounds: (code: string): Bounds | null => {
    if (boundsCache.has(code)) return boundsCache.get(code)!

    const alpha3 = countries.alpha2ToAlpha3(code)
    const feature = alpha3 && crcData.country_data?.find((f: any) => f.id === alpha3)
    let bounds: Bounds | null = null

    if (feature) {
      const { type, coordinates } = feature.geometry
      const rings: Ring[] = type === 'Polygon' ? [coordinates[0]] : coordinates.map((p: Ring[]) => p[0])
      const areas = rings.map(ringArea)
      const max = Math.max(...areas)
      let [s, w, n, e] = [90, 180, -90, -180]
      rings.forEach((ring, i) => {
        if (areas[i] < max * 0.25) return
        for (const [lon, lat] of ring) [s, w, n, e] = [Math.min(s, lat), Math.min(w, lon), Math.max(n, lat), Math.max(e, lon)]
      })
      bounds = [[s, w], [n, e]]
    }

    boundsCache.set(code, bounds)
    return bounds
  },
}

export default geocoderService
