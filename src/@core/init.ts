import config from 'config'
import Db from '@core/Db'
import daoList from 'dao'

import categoryService from 'service/category'

export const start = async () => {
  const start = new Date()
  console.log('start')

  const db = new Db(config.mysql)
  loadDao(db)

  await categoryService.init()

  const end = new Date()
  console.log(`started in ${end.getTime() - start.getTime()}ms`)
}

const loadDao = (db: db) => {
  for (let name in daoList) daoList[name].init(db)
}
