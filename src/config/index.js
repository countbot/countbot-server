// api/src/config/index.js

export default {
  env: process.env.NODE_ENV || 'development',
  app: {
    port: (process.env.PORT),
  },
  apiUrl: process.env.API_URL,
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  gm: {
    token: process.env.TOKEN,
    groupId: process.env.GROUP_ID,
    botId: process.env.BOT_ID,
  },
};
