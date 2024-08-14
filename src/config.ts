const mysql = {
  host: process.env.MYSQL_HOST || `localhost`,
  user: process.env.MYSQL_USER || `root`,
  password: process.env.MYSQL_PASSWORD || `root`,
  database: process.env.MYSQL_DB || `urbex`,
  port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
  connectionLimit: process.env.MYSQL_CON_LIMIT ? parseInt(process.env.MYSQL_CON_LIMIT) : 10,
}

export default {
  port: process.env.PORT,
  mysql: mysql,
  password: {
    secret: process.env.PASSWORD_SECRET,
    salt: process.env.PASSWORD_SALT ? parseInt(process.env.PASSWORD_SALT) : 10,
  },
  jwtSecret: process.env.JWT_SECRET || '',
}
