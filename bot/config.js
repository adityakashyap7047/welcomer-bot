require('dotenv').config();
module.exports = {
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/auth/callback',
  dashboardURL: process.env.DASHBOARD_URL || 'http://localhost:3000',
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'change-me-secret',
  ownerId: process.env.BOT_OWNER_ID,
  prefix: process.env.BOT_PREFIX || '!'
};
