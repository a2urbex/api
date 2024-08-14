interface MysqlOpts {
  host: string
  user: string
  password: string
  database: string
  port: number
  connectionLimit: number
}
type db = import('@core/Db').default

type Bindings = {}
type Variables = {
  user: User
}

interface User {
  id: number
  email: string
  roles: string[]
}
