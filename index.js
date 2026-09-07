require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const http = require('http');
const { WebSocketServer } = require('ws');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./utils/database');
const db = require('./utils/database');
const welcomeCommands = require('./src/commands');
const { createWelcomeEmbed, createGoodbyeEmbed, createBoostEmbed } = require('./utils/helpers');

// Load commands: commands/ directory first (other agent's), then welcome-only from src/
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
const extraCommands = commandFiles.map(f => require(path.join(__dirname, 'commands', f))).filter(c => c && c.data && typeof c.execute === 'function');
const extraNames = new Set(extraCommands.map(c => c.data.name));
const welcomeOnly = welcomeCommands.filter(c => c && c.data && typeof c.execute === 'function' && !extraNames.has(c.data.name));
const commands = [...extraCommands, ...welcomeOnly];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ]
});

client.commands = new Collection();
const cooldowns = new Collection();
const botStats = { commandsUsed: 0 };
for (const command of commands) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async (c) => {
  console.log(`\x1b[32m✓\x1b[0m Logged in as ${c.user.tag}`);
  console.log(`\x1b[32m✓\x1b[0m Serving ${c.guilds.cache.size} guilds`);
  client.user.setPresence({
    activities: [{ name: `Welcoming members | /help`, type: ActivityType.Watching }],
    status: 'online'
  });
  try {
    const slashCommands = commands.map(c => c.data.toJSON());
    await client.application.commands.set(slashCommands);
    console.log(`\x1b[32m✓\x1b[0m Registered ${slashCommands.length} slash commands`);
  } catch (e) {
    console.error('Failed to register commands:', e);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (!cooldowns.has(interaction.commandName)) cooldowns.set(interaction.commandName, new Collection());
  const now = Date.now();
  const timestamps = cooldowns.get(interaction.commandName);
  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id) + 3000;
    if (now < expirationTime) {
      return interaction.reply({ content: `Cooldown: wait ${((expirationTime - now) / 1000).toFixed(1)}s`, ephemeral: true });
    }
  }
  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), 3000);

  try {
    // Check if command needs extra params (other agent's commands)
    if (command.execute.length > 1) {
      await command.execute(interaction, client, db, botStats);
    } else {
      await command.execute(interaction);
    }
    db.prepare('INSERT INTO commands_used (guild_id, user_id, command) VALUES (?, ?, ?)')
      .run(interaction.guild?.id || 'dm', interaction.user.id, interaction.commandName);
    db.prepare("UPDATE guild_stats SET total_commands = total_commands + 1, last_updated = datetime('now') WHERE guild_id = ?")
      .run(interaction.guild?.id || 'dm');
  } catch (e) {
    console.error(`Command error [${interaction.commandName}]:`, e);
    const reply = { content: 'An error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});

client.on(Events.GuildMemberAdd, async member => {
  if (member.user.bot) return;
  const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(member.guild.id);
  if (!config) return;

  if (config.welcome_enabled && config.welcome_channel) {
    const channel = member.guild.channels.cache.get(config.welcome_channel);
    if (channel) {
      try {
        const embed = createWelcomeEmbed(member, member.guild, config);
        await channel.send({ embeds: [embed] });
        db.prepare("INSERT INTO welcome_logs (guild_id, user_id, user_tag, channel_id, type) VALUES (?, ?, ?, ?, 'join')")
          .run(member.guild.id, member.id, member.user.tag, config.welcome_channel);
        db.prepare("UPDATE guild_stats SET total_welcomes = total_welcomes + 1, total_members = ?, last_updated = datetime('now') WHERE guild_id = ?")
          .run(member.guild.memberCount, member.guild.id);
      } catch (e) { console.error(`Welcome error [${member.guild.id}]:`, e.message); }
    }
  }

  if (config.autorole_enabled && config.autorole_id) {
    try {
      const role = member.guild.roles.cache.get(config.autorole_id);
      if (role) await member.roles.add(role, 'Auto-role');
    } catch (e) { console.error(`Auto-role error [${member.guild.id}]:`, e.message); }
  }
});

client.on(Events.GuildMemberRemove, async member => {
  if (member.user.bot) return;
  const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(member.guild.id);
  if (!config || !config.goodbye_enabled || !config.goodbye_channel) return;
  const channel = member.guild.channels.cache.get(config.goodbye_channel);
  if (channel) {
    try {
      const embed = createGoodbyeEmbed(member, member.guild, config);
      await channel.send({ embeds: [embed] });
      db.prepare("INSERT INTO welcome_logs (guild_id, user_id, user_tag, channel_id, type) VALUES (?, ?, ?, ?, 'leave')")
        .run(member.guild.id, member.id, member.user.tag, config.goodbye_channel);
    } catch (e) { console.error(`Goodbye error:`, e.message); }
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!oldMember.premiumSince && newMember.premiumSince) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(newMember.guild.id);
    if (!config || !config.boost_channel) return;
    const channel = newMember.guild.channels.cache.get(config.boost_channel);
    if (channel) {
      try {
        const embed = createBoostEmbed(newMember, newMember.guild, config);
        await channel.send({ embeds: [embed] });
      } catch (e) { console.error('Boost error:', e.message); }
    }
  }
});

// Leveling system
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  const now = Date.now();
  const lastXp = message._lastXpTime || 0;
  if (now - lastXp < 60000) return;
  message._lastXpTime = now;

  const xpGain = Math.floor(Math.random() * 15) + 5;
  let row = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(message.guild.id, message.author.id);
  if (!row) {
    db.prepare('INSERT INTO user_levels (guild_id, user_id, xp, level, messages) VALUES (?, ?, 0, 0, 0)').run(message.guild.id, message.author.id);
    row = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(message.guild.id, message.author.id);
  }
  let newXp = (row.xp || 0) + xpGain;
  let newLevel = row.level || 0;
  let newMessages = (row.messages || 0) + 1;
  let levelUp = false;
  let xpNeeded = Math.floor(100 * Math.pow(1.5, newLevel));
  while (newXp >= xpNeeded) { newXp -= xpNeeded; newLevel++; levelUp = true; xpNeeded = Math.floor(100 * Math.pow(1.5, newLevel)); }
  db.prepare('UPDATE user_levels SET xp = ?, level = ?, messages = ? WHERE guild_id = ? AND user_id = ?').run(newXp, newLevel, newMessages, message.guild.id, message.author.id);

  if (levelUp) {
    try {
      await message.channel.send({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(0xFFD700).setTitle('Level Up!').setDescription(`${message.author} reached **Level ${newLevel}**! 🎉`).setTimestamp()] });
    } catch {}
  }
});

// ========== EXPRESS DASHBOARD ==========
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// WebSocket for real-time stats
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  const sendStats = () => {
    try {
      const active = db.prepare('SELECT COUNT(*) as count FROM guilds WHERE welcome_enabled = 1').get().count;
      const totalCmds = db.prepare('SELECT COUNT(*) as count FROM commands_used').get().count;
      const totalWelcomes = db.prepare('SELECT COUNT(*) as count FROM welcome_logs').get().count;
      ws.send(JSON.stringify({
        type: 'stats',
        guilds: client.guilds.cache.size,
        users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
        uptime: client.uptime,
        memory: parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
        ping: client.ws.ping,
        activeWelcomes: active,
        totalCommands: totalCmds,
        totalWelcomes: totalWelcomes
      }));
    } catch {}
  };
  sendStats();
  const interval = setInterval(sendStats, 3000);
  ws.on('close', () => clearInterval(interval));
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'nexus-welcomer-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL || `http://localhost:${PORT}/auth/callback`,
    scope: ['identify', 'guilds', 'guilds.join'],
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;
    // Check if this is a verification flow
    if (req.query && req.query.state) {
      req.query._verificationState = req.query.state;
    }
    return done(null, profile);
  }));
}

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => { res.locals.user = req.user || null; next(); });

app.get('/auth/login', passport.authenticate('discord'));
app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), async (req, res) => {
  // Store authorized user
  if (req.user && req.user.accessToken) {
    db.prepare("INSERT OR REPLACE INTO authorized_users (user_id, username, access_token, refresh_token, authorized_at) VALUES (?, ?, ?, ?, datetime('now'))")
      .run(req.user.id, req.user.username, req.user.accessToken, req.user.refreshToken || '');
  }

  // Check if this is a verification flow (state contains guildId/roleId)
  const state = req.query.state;
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      if (decoded.guildId && decoded.roleId) {
        const guild = client.guilds.cache.get(decoded.guildId);
        if (guild) {
          try {
            const member = await guild.members.fetch(req.user.id);
            if (member) {
              await member.roles.add(decoded.roleId, 'Verification');
              db.prepare("INSERT OR REPLACE INTO verified_users (user_id, guild_id, verified_at) VALUES (?, ?, datetime('now'))")
                .run(req.user.id, decoded.guildId);
            }
          } catch (e) { console.error(`Verify role error: ${e.message}`); }
        }
        return res.send(`<!DOCTYPE html><html><head><title>Verified</title>
          <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a1a;font-family:Inter,sans-serif;color:#fff;text-align:center}
          .box{background:#12121a;border:1px solid #2a2a4a;border-radius:20px;padding:3rem;max-width:400px;animation:fadeIn .5s ease-out}
          .check{font-size:4rem;margin-bottom:1rem;animation:bounce .6s ease-out}
          @keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
          @keyframes bounce{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
          a{color:#5865F2;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}</style></head><body>
          <div class="box"><div class="check">✅</div><h2>Verification Complete!</h2>
          <p style="color:#b9bbbe;margin:1rem 0">You have been verified and your role has been assigned.</p>
          <a href="/">Return to Dashboard</a></div></body></html>`);
      }
    } catch (e) { /* Not a verification state, continue to dashboard */ }
  }

  res.redirect('/dashboard');
});
app.get('/auth/logout', (req, res) => { req.logout(() => res.redirect('/')); });

// Verification - initiates OAuth with state containing guildId + roleId
app.get('/verify/:guildId/:roleId', (req, res) => {
  const { guildId, roleId } = req.params;
  const state = Buffer.from(JSON.stringify({ guildId, roleId })).toString('base64');
  passport.authenticate('discord', {
    scope: ['identify', 'guilds', 'guilds.join'],
    state
  })(req, res);
});

function ensureAuth(req, res, next) { if (req.isAuthenticated()) return next(); res.redirect('/auth/login'); }

// API
app.post('/api/guild/:id/config', ensureAuth, (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const member = guild.members.cache.get(req.user.id);
  if (!member || !member.permissions.has('ManageGuild')) return res.status(403).json({ error: 'No permission' });

  const data = req.body;

  // Map camelCase form names to snake_case DB columns
  const fieldMap = {
    welcomeEnabled: 'welcome_enabled',
    welcomeChannel: 'welcome_channel',
    welcomeMessage: 'welcome_message',
    welcomeColor: 'welcome_color',
    welcomeImage: 'welcome_image',
    welcomeTitle: 'welcome_title',
    welcomeFooter: 'welcome_footer',
    customEmbedColor: 'welcome_color',
    customEmbedTitle: 'welcome_title',
    customEmbedFooter: 'welcome_footer',
    goodbyeEnabled: 'goodbye_enabled',
    goodbyeChannel: 'goodbye_channel',
    goodbyeMessage: 'goodbye_message',
    goodbyeColor: 'goodbye_color',
    autoroleEnabled: 'autorole_enabled',
    autoRole: 'autorole_id',
    autoroleId: 'autorole_id',
    boostChannel: 'boost_channel',
    boostMessage: 'boost_message',
    logChannel: 'log_channel',
    prefix: 'prefix'
  };

  // Ensure guild row exists
  const existing = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(req.params.id);
  if (!existing) {
    db.prepare("INSERT OR IGNORE INTO guilds (guild_id, guild_name, updated_at) VALUES (?, ?, datetime('now'))").run(req.params.id, guild.name);
  }

  for (const [formKey, dbCol] of Object.entries(fieldMap)) {
    if (data[formKey] !== undefined && data[formKey] !== '') {
      db.prepare(`UPDATE guilds SET ${dbCol} = ?, updated_at = datetime('now') WHERE guild_id = ?`)
        .run(data[formKey], req.params.id);
    }
  }

  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  res.json({
    guilds: client.guilds.cache.size,
    users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
    uptime: client.uptime,
    memory: parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
    activeWelcomes: db.prepare('SELECT COUNT(*) as count FROM guilds WHERE welcome_enabled = 1').get().count,
    totalCommands: db.prepare('SELECT COUNT(*) as count FROM commands_used').get().count,
    totalWelcomes: db.prepare('SELECT COUNT(*) as count FROM welcome_logs').get().count,
    ping: client.ws.ping, status: 'online'
  });
});

// Pages
app.get('/', (req, res) => {
  res.render('index', { stats: {
    guilds: client.guilds.cache.size,
    users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
    uptime: client.uptime,
    activeWelcomes: db.prepare('SELECT COUNT(*) as count FROM guilds WHERE welcome_enabled = 1').get().count
  }, clientId: process.env.DISCORD_CLIENT_ID });
});

app.get('/dashboard', ensureAuth, (req, res) => {
  const guilds = client.guilds.cache.filter(g => {
    const m = g.members.cache.get(req.user.id);
    return m && m.permissions.has('ManageGuild');
  }).map(g => ({
    id: g.id, name: g.name,
    icon: g.iconURL({ dynamic: true, size: 128 }),
    memberCount: g.memberCount,
    config: db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(g.id)
  }));
  res.render('dashboard', { guilds });
});

app.get('/dashboard/:id', ensureAuth, (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.redirect('/dashboard');
  const member = guild.members.cache.get(req.user.id);
  if (!member || !member.permissions.has('ManageGuild')) return res.redirect('/dashboard');
  const raw = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(req.params.id) || {};
  const logs = db.prepare('SELECT * FROM welcome_logs WHERE guild_id = ? ORDER BY id DESC LIMIT 50').all(req.params.id);
  const stats = db.prepare('SELECT * FROM guild_stats WHERE guild_id = ?').get(req.params.id) || {};

  // Map snake_case DB columns to camelCase for template
  const config = {
    welcomeEnabled: raw.welcome_enabled,
    welcomeChannel: raw.welcome_channel,
    welcomeMessage: raw.welcome_message,
    welcomeColor: raw.welcome_color,
    customEmbedColor: raw.welcome_color,
    welcomeTitle: raw.welcome_title,
    customEmbedTitle: raw.welcome_title,
    welcomeFooter: raw.welcome_footer,
    customEmbedFooter: raw.welcome_footer,
    goodbyeEnabled: raw.goodbye_enabled,
    goodbyeChannel: raw.goodbye_channel,
    goodbyeMessage: raw.goodbye_message,
    goodbyeColor: raw.goodbye_color,
    autoroleEnabled: raw.autorole_enabled,
    autoRole: raw.autorole_id,
    autoroleId: raw.autorole_id,
    boostChannel: raw.boost_channel,
    boostMessage: raw.boost_message,
    logChannel: raw.log_channel,
    prefix: raw.prefix || '!'
  };

  res.render('guild', {
    guild, config, logs, stats,
    channels: guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })),
    roles: guild.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
  });
});

app.get('/commands', (req, res) => res.render('commands'));
app.get('/status', (req, res) => {
  res.render('status', { stats: {
    guilds: client.guilds.cache.size,
    users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
    uptime: client.uptime,
    memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    ping: client.ws.ping,
    activeWelcomes: db.prepare('SELECT COUNT(*) as count FROM guilds WHERE welcome_enabled = 1').get().count,
    totalCommands: db.prepare('SELECT COUNT(*) as count FROM commands_used').get().count,
    totalWelcomes: db.prepare('SELECT COUNT(*) as count FROM welcome_logs').get().count,
    nodeVersion: process.version
  }});
});

app.get('/bio', (req, res) => {
  const totalWelcomes = db.prepare('SELECT COUNT(*) as count FROM welcome_logs WHERE type = ?').get('join')?.count || 0;
  const totalLeaves = db.prepare('SELECT COUNT(*) as count FROM welcome_logs WHERE type = ?').get('leave')?.count || 0;
  const activeGuilds = db.prepare('SELECT COUNT(*) as count FROM guilds WHERE welcome_enabled = 1').get().count;
  const totalGuilds = client.guilds.cache.size;
  const totalUsers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
  res.render('bio', {
    user: req.user || null,
    stats: {
      totalWelcomes, totalLeaves, activeGuilds, totalGuilds, totalUsers,
      uptime: client.uptime, ping: client.ws.ping,
      memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
      totalCommands: db.prepare('SELECT COUNT(*) as count FROM commands_used').get().count,
      nodeVersion: process.version, status: 'online'
    }
  });
});

app.post('/dashboard/:id/save', ensureAuth, (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.redirect('/dashboard');
  const member = guild.members.cache.get(req.user.id);
  if (!member || !member.permissions.has('ManageGuild')) return res.redirect('/dashboard');

  const { welcome_channel, welcome_message, welcome_color, goodbye_channel, goodbye_message, goodbye_color, boost_channel, boost_message, autorole_id, log_channel, prefix } = req.body;

  db.prepare(`INSERT OR REPLACE INTO guilds (guild_id, guild_name, welcome_enabled, welcome_channel, welcome_message, welcome_color, goodbye_enabled, goodbye_channel, goodbye_message, goodbye_color, boost_channel, boost_message, autorole_enabled, autorole_id, log_channel, prefix, updated_at)
    SELECT ?, ?, 1, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
    FROM (SELECT 1)`).run(
    guild.id, guild.name,
    welcome_channel || null, welcome_message || 'Welcome to {server}, {user}! You are member #{count}!', welcome_color || '#00ff88',
    goodbye_channel || null, goodbye_message || 'Goodbye {user}, we will miss you!', goodbye_color || '#ff4444',
    boost_channel || null, boost_message || '{user} just boosted {server}!',
    autorole_id || null, log_channel || null, prefix || '!'
  );

  res.redirect(`/dashboard/${req.params.id}`);
});

async function start() {
  await initDatabase();
  try { await client.login(process.env.DISCORD_BOT_TOKEN); }
  catch (e) { console.error('\x1b[31mDiscord login failed:\x1b[0m', e.message); }
  server.listen(PORT, () => console.log(`\x1b[32m✓\x1b[0m Dashboard on port ${PORT}`));
}

start();
