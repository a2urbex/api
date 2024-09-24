import NodeGeocoder from 'node-geocoder'

import config from 'config'
import dao from 'dao'

let geocoder: any = null

const geocoderService = {
  init: () => {
    geocoder = NodeGeocoder({ apiKey: config.googleApiKey })
  },

  getCountry: async (lat: number, lon: number) => {
    if (!lat || !lon || lat < -90 || lat > 90 || lon < -90 || lon > 90) return

    const res = await geocoder.reverse({ lat, lon })
    if (!res.length || !res[0].countryCode) return

    const exist = await dao.country.getFromCode(res[0].countryCode)
    if (exist) return exist

    const add = await dao.country.add(res[0].country, res[0].countryCode)
    return { id: add.insertId, name: res[0].country, code: res[0].countryCode }
  },
}

export default geocoderService
