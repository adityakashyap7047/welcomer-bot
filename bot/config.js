require('dotenv').config();
module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL || 'http://localhost:3000/auth/callback',
  dashboardURL: process.env.DASHBOARD_URL || 'http://localhost:3000',
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'change-me-secret',
  ownerId: process.env.OWNER_ID,
  prefix: process.env.BOT_PREFIX || '!'
};
