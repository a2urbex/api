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
  id: number
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
  favoriteId?: number
}

interface Location {
  id: string
  lat: number
  lon: number
  name: string
  image: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  fids: string[]
}

interface LocationFilters {
  categories: { [key: string]: string }
  countries: { [key: string]: string }
  sources?: { [key: string]: string }
}

interface Friend {
  id: string
  username: string
  image: string
}
