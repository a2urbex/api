import * as crcLib from 'country-reverse-geocoding'
import * as countries from 'i18n-iso-countries'
import dao from 'dao'

const crc = crcLib.country_reverse_geocoding()

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
}

export default geocoderService
