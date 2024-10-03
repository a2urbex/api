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
  frontUrl: process.env.FRONT_URL as string,
  apiUrl: process.env.API_URL as string,
  forgotPasswordUrl: process.env.FORGOT_PASSWORD_URL as string,

  password: {
    secret: process.env.PASSWORD_SECRET,
    salt: process.env.PASSWORD_SALT ? parseInt(process.env.PASSWORD_SALT) : 10,
  },
  jwtSecret: process.env.JWT_SECRET as string,
  pageSize: process.env.PAGE_SIZE ? parseInt(process.env.PAGE_SIZE) : 50,
  encryption: {
    method: process.env.ENCRYPT_METHOD,
    iv: process.env.IV_SECRET,
    location: process.env.LOCATION_SECRET,
    favorite: process.env.FAVORITE_SECRET,
    user: process.env.USER_SECRET,
  },

  path: {
    location: process.env.LOCATION_IMAGE_PATH as string,
    user: process.env.USER_IMAGE_PATH as string,
    mail: process.env.MAIL_HTML_PATH as string,
  },

  googleApiKey: process.env.GOOGLE_API_KEY,

  mail: {
    service: process.env.MAIL_SERVICE,
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
  },
}
