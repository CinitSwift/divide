export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Vercel Postgres 配置
  database: {
    // Vercel Postgres 使用 POSTGRES_URL 环境变量
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT, 10) || 5432,
    username: process.env.POSTGRES_USER || process.env.DB_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.POSTGRES_DATABASE || process.env.DB_DATABASE || 'game_team_divider',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  wechat: {
    appId: process.env.WECHAT_APPID,
    appSecret: process.env.WECHAT_SECRET,
  },
});
