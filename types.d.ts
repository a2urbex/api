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

interface SearchFilters {
  string?: string
  categories?: number[]
  countries?: number[]
  sources?: number[]
  users?: number[]
  page?: number
}
