import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

import dao from 'dao'
import utils from '@core/utils'

const location = new Hono<{ Bindings: Bindings; Variables: Variables }>()

location.get('/filter', async (c) => {
  const user = c.get('user')
  const out: any = {
    category: {},
    country: {},
  }

  const countryRaw = await dao.country.getList()
  countryRaw.forEach((item: any) => (out.country[item.id] = item.name))

  const categoryRaw = await dao.category.getList()
  categoryRaw.forEach((item: any) => (out.category[item.id] = item.name))

  if (utils.isSuperUser(user)) {
    out.source = {}
    const sourceRaw = await dao.source.getList()
    sourceRaw.forEach((item: any) => (out.source[item.id] = item.name))
  }

  return c.json(out)
})

export default location
