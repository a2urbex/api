import * as mysql from 'mysql2/promise'
import { HTTPException } from 'hono/http-exception'

export default class Db {
  opts: MysqlOpts
  mysqlPool: mysql.Pool

  constructor(opts: MysqlOpts) {
    this.opts = opts
    this.mysqlPool = mysql.createPool({
      host: this.opts.host,
      user: this.opts.user,
      database: this.opts.database,
      password: this.opts.password,
      connectionLimit: this.opts.connectionLimit,
      port: this.opts.port,
    })

    console.log(`mysql pool created ${this.opts.host}:${this.opts.port}, ${this.opts.user}`)
  }

  async query(request: string, params: any = null, formatter: number | null = null) {
    let conn: mysql.PoolConnection | undefined

    try {
      conn = await this.mysqlPool.getConnection()
      if (!conn) throw new HTTPException(500, { message: 'Unable to connect to database' })

      const query = await conn.query(request, params)
      const data = query[0]

      if (formatter === 0) return data?.[0]
      return data
    } catch (err) {
      console.log(err)
      throw new HTTPException(500, { message: 'SQL query error' })
    } finally {
      if (conn) conn.release()
    }
  }

  async batch(request: string, params: any = null, size: number = 500) {
    const chunks: any[] = []
    for (let i = 0; i < params.length; i += size) chunks.push(params.slice(i, i + size))
    for (let i = 0; i < chunks.length; i++) {
      const req = request + new Array(chunks[i].length).fill('(?)').join(',')
      await this.query(req, chunks[i], null)
    }
  }
}
