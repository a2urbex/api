const mysql = {
  host: process.env.MYSQL_HOST || `localhost`,
  user: process.env.MYSQL_USER || `root`,
  password: process.env.MYSQL_PASSWORD || `root`,
  database: process.env.MYSQL_DB || `urbex`,
  port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
  connectionLimit: process.env.MYSQL_CON_LIMIT ? parseInt(process.env.MYSQL_CON_LIMIT) : 10,
}

export default {
  mysql: mysql,
  secret: process.env.ACCESS_TOKEN_SECRET || '',
}
