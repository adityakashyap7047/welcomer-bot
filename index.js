require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, ActivityType, PermissionFlagsBits, AuditLogEvent, EmbedBuilder } = require('discord.js');
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
const { createWelcomeEmbed, createGoodbyeEmbed, createBoostEmbed } = require('./utils/helpers');
const ProtectionSystem = require('./utils/protection');

// ═══════════════════════════════════════════════════════════════
// PRIVATE BOT CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '';
const ALLOWED_GUILD_IDS = process.env.ALLOWED_GUILD_IDS
  ? process.env.ALLOWED_GUILD_IDS.split(',').map(id => id.trim()).filter(Boolean)
  : [];

function isGuildAllowed(guildId) {
  if (ALLOWED_GUILD_IDS.length === 0) return true;
  if (ALLOWED_GUILD_IDS.includes(guildId)) return true;
  try {
    const row = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ? AND is_active = 1').get(guildId);
    if (row) return true;
  } catch {}
  return false;
}

function isOwner(userId) {
  return BOT_OWNER_ID && userId === BOT_OWNER_ID;
}

// ═══════════════════════════════════════════════════════════════
// LOAD COMMANDS
// ═══════════════════════════════════════════════════════════════
const welcomeCommands = require('./src/commands');
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
const commands = [];
const commandNames = new Set();

for (const file of commandFiles) {
  const loaded = require(path.join(__dirname, 'commands', file));
  const cmdArray = Array.isArray(loaded) ? loaded : [loaded];
  for (const command of cmdArray) {
    if (command && command.data && typeof command.execute === 'function') {
      if (!commandNames.has(command.data.name)) {
        commands.push(command);
        commandNames.add(command.data.name);
      }
    }
  }
}

for (const command of welcomeCommands) {
  if (command && command.data && typeof command.execute === 'function') {
    if (!commandNames.has(command.data.name)) {
      commands.push(command);
      commandNames.add(command.data.name);
    }
  }
}

console.log(`\x1b[36m✓\x1b[0m Loaded ${commands.length} unique commands`);

// ═══════════════════════════════════════════════════════════════
// DISCORD CLIENT
// ═══════════════════════════════════════════════════════════════
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
const protection = new ProtectionSystem(client);

for (const command of commands) {
  client.commands.set(command.data.name, command);
}

// ═══════════════════════════════════════════════════════════════
// BOT READY
// ═══════════════════════════════════════════════════════════════
client.once(Events.ClientReady, async (c) => {
  console.log(`\x1b[32m✓\x1b[0m Logged in as ${c.user.tag}`);
  console.log(`\x1b[32m✓\x1b[0m Serving ${c.guilds.cache.size} guilds`);

  if (ALLOWED_GUILD_IDS.length > 0) {
    console.log(`\x1b[33m!\x1b[0m Private mode: ${ALLOWED_GUILD_IDS.length} allowed guild(s)`);
    for (const [, guild] of client.guilds.cache) {
      if (!isGuildAllowed(guild.id)) {
        console.log(`\x1b[31m✕\x1b[0m Leaving unauthorized guild: ${guild.name} (${guild.id})`);
        await guild.leave().catch(() => {});
      }
    }
  }

  client.user.setPresence({
    activities: [{ name: `/help | ${c.guilds.cache.size} servers`, type: ActivityType.Watching }],
    status: 'online'
  });

  try {
    const slashCommands = commands.map(c => c.data.toJSON());
    await client.application.commands.set(slashCommands);
    console.log(`\x1b[32m✓\x1b[0m Registered ${slashCommands.length} slash commands`);
  } catch (e) {
    console.error('Failed to register commands:', e);
  }

  setInterval(() => {
    for (const [, guild] of client.guilds.cache) {
      protection.monitorAuditLog(guild).catch(() => {});
    }
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════
// GUILD JOIN/LEAVE RESTRICTION
// ═══════════════════════════════════════════════════════════════
client.on(Events.GuildCreate, async guild => {
  if (ALLOWED_GUILD_IDS.length > 0 && !isGuildAllowed(guild.id)) {
    console.log(`\x1b[31m✕\x1b[0m Leaving unauthorized guild: ${guild.name} (${guild.id})`);
    await guild.leave().catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (interaction.guild && !isGuildAllowed(interaction.guild.id)) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: 'This bot is not configured to work in this server.',
        ephemeral: true
      });
    }
  }

  if (!cooldowns.has(interaction.commandName)) cooldowns.set(interaction.commandName, new Collection());
  const now = Date.now();
  const timestamps = cooldowns.get(interaction.commandName);
  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id) + 3000;
    if (now < expirationTime) {
      return interaction.reply({
        content: `Cooldown: wait ${((expirationTime - now) / 1000).toFixed(1)}s`,
        ephemeral: true
      });
    }
  }
  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), 3000);

  try {
    await command.execute(interaction, client, db, botStats);

    db.prepare('INSERT INTO commands_used (guild_id, user_id, command) VALUES (?, ?, ?)')
      .run(interaction.guild?.id || 'dm', interaction.user.id, interaction.commandName);
    db.prepare("UPDATE guild_stats SET total_commands = total_commands + 1, last_updated = datetime('now') WHERE guild_id = ?")
      .run(interaction.guild?.id || 'dm');
  } catch (e) {
    console.error(`Command error [${interaction.commandName}]:`, e);
    const reply = { content: 'An error occurred while executing this command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════════
// WELCOME / GOODBYE / BOOST EVENTS
// ═══════════════════════════════════════════════════════════════
client.on(Events.GuildMemberAdd, async member => {
  if (member.user.bot) return;
  if (!isGuildAllowed(member.guild.id)) return;

  try {
    await protection.checkAntiRaid(member);
  } catch (e) { console.error('Anti-raid error:', e.message); }

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
  if (!isGuildAllowed(member.guild.id)) return;

  const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(member.guild.id);
  if (!config || !config.goodbye_enabled || !config.goodbye_channel) return;
  const channel = member.guild.channels.cache.get(config.goodbye_channel);
  if (channel) {
    try {
      const embed = createGoodbyeEmbed(member, member.guild, config);
      await channel.send({ embeds: [embed] });
      db.prepare("INSERT INTO welcome_logs (guild_id, user_id, user_tag, channel_id, type) VALUES (?, ?, ?, ?, 'leave')")
        .run(member.guild.id, member.id, member.user.tag, config.goodbye_channel);
    } catch (e) { console.error('Goodbye error:', e.message); }
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!isGuildAllowed(newMember.guild.id)) return;
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

// ═══════════════════════════════════════════════════════════════
// ANTI-NUKE EVENT MONITORS
// ═══════════════════════════════════════════════════════════════
client.on(Events.ChannelDelete, async channel => {
  if (!channel.guild) return;
  try {
    const auditLogs = await channel.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.ChannelDelete });
    const entry = auditLogs.entries.first();
    if (entry && entry.executor && !entry.executor.bot) {
      const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(channel.guild.id);
      if (config?.anti_nuke_enabled) {
        await protection.checkAntiNuke(channel.guild, 'channel_delete', entry.executor);
      }
      const log = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Channel Deleted')
        .setDescription(`**${channel.name}** was deleted by ${entry.executor}`)
        .setTimestamp();
      protection.logToGuild(channel.guild, log);
    }
  } catch {}
});

client.on(Events.GuildRoleDelete, async role => {
  if (!role.guild) return;
  try {
    const auditLogs = await role.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.RoleDelete });
    const entry = auditLogs.entries.first();
    if (entry && entry.executor && !entry.executor.bot) {
      const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(role.guild.id);
      if (config?.anti_nuke_enabled) {
        await protection.checkAntiNuke(role.guild, 'role_delete', entry.executor);
      }
      const log = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Role Deleted')
        .setDescription(`**${role.name}** was deleted by ${entry.executor}`)
        .setTimestamp();
      protection.logToGuild(role.guild, log);
    }
  } catch {}
});

// ═══════════════════════════════════════════════════════════════
// LEVELING SYSTEM
// ═══════════════════════════════════════════════════════════════
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!isGuildAllowed(message.guild.id)) return;

  try {
    if (await protection.checkAntiSpam(message)) return;
    if (protection.checkBadWords(message)) return;
    if (protection.checkCapsFilter(message)) return;
    if (protection.checkLinkFilter(message)) return;

    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(message.guild.id);
    if (config?.anti_mass_mention_enabled) {
      const mentionCount = message.mentions.users.size + message.mentions.roles.size;
      if (mentionCount >= (config.mass_mention_threshold || 5)) {
        await message.delete().catch(() => {});
        await protection.autoPunish(message.member, 'timeout', 'Mass mention detected');
        return;
      }
    }
  } catch (e) { console.error('Protection check error:', e.message); }

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
      await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('Level Up!').setDescription(`${message.author} reached **Level ${newLevel}**!`).setTimestamp()] });
    } catch {}
  }
});

// ═══════════════════════════════════════════════════════════════
// EXPRESS DASHBOARD
// ═══════════════════════════════════════════════════════════════
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

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
    scope: ['identify', 'guilds'],
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
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
    } catch (e) { /* Not a verification state */ }
  }

  res.redirect('/dashboard');
});
app.get('/auth/logout', (req, res) => { req.logout(() => res.redirect('/')); });

app.get('/verify/:guildId/:roleId', (req, res) => {
  const { guildId, roleId } = req.params;
  const state = Buffer.from(JSON.stringify({ guildId, roleId })).toString('base64');
  passport.authenticate('discord', {
    scope: ['identify', 'guilds'],
    state
  })(req, res);
});

function ensureAuth(req, res, next) { if (req.isAuthenticated()) return next(); res.redirect('/auth/login'); }

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════
app.post('/api/guild/:id/config', ensureAuth, (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });
  const member = guild.members.cache.get(req.user.id);
  if (!member || !member.permissions.has('ManageGuild')) return res.status(403).json({ error: 'No permission' });

  const data = req.body;

  const fieldMap = {
    welcomeEnabled: 'welcome_enabled',
    welcomeChannel: 'welcome_channel',
    welcomeMessage: 'welcome_message',
    welcomeColor: 'welcome_color',
    welcomeImage: 'welcome_image',
    welcomeTitle: 'welcome_title',
    welcomeFooter: 'welcome_footer',
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
    prefix: 'prefix',
    antiRaidEnabled: 'anti_raid_enabled',
    raidThreshold: 'raid_threshold',
    raidWindow: 'raid_window',
    raidAction: 'raid_action',
    antiSpamEnabled: 'anti_spam_enabled',
    spamThreshold: 'spam_threshold',
    antiBadwordsEnabled: 'anti_badwords_enabled',
    badWords: 'bad_words',
    antiCapsEnabled: 'anti_caps_enabled',
    capsThreshold: 'caps_threshold',
    antiLinksEnabled: 'anti_links_enabled',
    antiNukeEnabled: 'anti_nuke_enabled',
    antiMassMentionEnabled: 'anti_mass_mention_enabled',
    massMentionThreshold: 'mass_mention_threshold',
    autoPunish: 'auto_punish',
    auditLogEnabled: 'audit_log_enabled',
    lockdownEnabled: 'lockdown_enabled',
    lockdownChannel: 'lockdown_channel',
    verificationEnabled: 'verification_enabled',
    verificationRole: 'verification_role',
    verificationChannel: 'verification_channel'
  };

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

// ═══════════════════════════════════════════════════════════════
// WHITELIST MANAGEMENT API (Owner Only)
// ═══════════════════════════════════════════════════════════════
function ensureOwner(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect('/auth/login');
  if (!isOwner(req.user.id)) return res.status(403).json({ error: 'Owner only' });
  next();
}

app.get('/api/whitelist', ensureOwner, (req, res) => {
  const servers = db.prepare('SELECT * FROM whitelisted_servers ORDER BY added_at DESC').all();
  const enriched = servers.map(s => ({
    ...s,
    online: client.guilds.cache.has(s.guild_id)
  }));
  res.json({ servers: enriched });
});

app.post('/api/whitelist/add', ensureOwner, (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Bot not in that server' });

  const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
  if (existing) return res.status(400).json({ error: 'Already whitelisted' });

  db.prepare("INSERT INTO whitelisted_servers (guild_id, guild_name, added_by, added_at, is_active) VALUES (?, ?, ?, datetime('now'), 1)")
    .run(guildId, guild.name, req.user.id);

  res.json({ success: true, guild: { id: guildId, name: guild.name } });
});

app.post('/api/whitelist/remove', ensureOwner, (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });

  const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
  if (!existing) return res.status(400).json({ error: 'Not whitelisted' });

  db.prepare('DELETE FROM whitelisted_servers WHERE guild_id = ?').run(guildId);
  res.json({ success: true });
});

app.post('/api/whitelist/toggle', ensureOwner, (req, res) => {
  const { guildId, active } = req.body;
  if (!guildId) return res.status(400).json({ error: 'guildId required' });

  const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
  if (!existing) return res.status(400).json({ error: 'Not whitelisted' });

  db.prepare('UPDATE whitelisted_servers SET is_active = ? WHERE guild_id = ?').run(active ? 1 : 0, guildId);
  res.json({ success: true });
});

app.get('/whitelist', ensureOwner, (req, res) => {
  const servers = db.prepare('SELECT * FROM whitelisted_servers ORDER BY added_at DESC').all();
  const allGuilds = client.guilds.cache.map(g => ({
    id: g.id, name: g.name, memberCount: g.memberCount,
    icon: g.iconURL({ dynamic: true, size: 64 })
  }));
  res.render('whitelist', { servers, allGuilds });
});

// ═══════════════════════════════════════════════════════════════
// PAGE ROUTES
// ═══════════════════════════════════════════════════════════════
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
    config: (() => { const r = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(g.id); return r ? { welcome_enabled: r.welcome_enabled } : null; })()
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

  const config = {
    welcome_enabled: raw.welcome_enabled,
    welcome_channel: raw.welcome_channel,
    welcome_message: raw.welcome_message,
    welcome_color: raw.welcome_color,
    welcome_title: raw.welcome_title,
    welcome_footer: raw.welcome_footer,
    welcome_image: raw.welcome_image,
    goodbye_enabled: raw.goodbye_enabled,
    goodbye_channel: raw.goodbye_channel,
    goodbye_message: raw.goodbye_message,
    goodbye_color: raw.goodbye_color,
    autorole_enabled: raw.autorole_enabled,
    autorole_id: raw.autorole_id,
    boost_channel: raw.boost_channel,
    boost_message: raw.boost_message,
    log_channel: raw.log_channel,
    prefix: raw.prefix || '!',
    anti_raid_enabled: raw.anti_raid_enabled,
    raid_threshold: raw.raid_threshold || 5,
    raid_window: raw.raid_window || 30,
    raid_action: raw.raid_action || 'kick',
    anti_spam_enabled: raw.anti_spam_enabled,
    spam_threshold: raw.spam_threshold || 5,
    anti_badwords_enabled: raw.anti_badwords_enabled,
    bad_words: raw.bad_words || '',
    anti_caps_enabled: raw.anti_caps_enabled,
    caps_threshold: raw.caps_threshold || 70,
    anti_links_enabled: raw.anti_links_enabled,
    anti_nuke_enabled: raw.anti_nuke_enabled,
    anti_mass_mention_enabled: raw.anti_mass_mention_enabled,
    mass_mention_threshold: raw.mass_mention_threshold || 5,
    audit_log_enabled: raw.audit_log_enabled,
    auto_punish: raw.auto_punish || 'timeout',
    lockdown_enabled: raw.lockdown_enabled,
    lockdown_channel: raw.lockdown_channel || '',
    verification_enabled: raw.verification_enabled,
    verification_role: raw.verification_role || '',
    verification_channel: raw.verification_channel || ''
  };

  res.render('guild', {
    guild, config, logs, stats,
    channels: guild.channels.cache.filter(c => c.type === 0).map(c => ({ id: c.id, name: c.name })),
    roles: guild.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
  });
});

app.get('/commands', (req, res) => {
  const commandList = commands.map(c => ({
    name: c.data.name,
    description: c.data.description || 'No description'
  }));
  res.render('commands', { commands: commandList });
});

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

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════
async function start() {
  await initDatabase();
  try { await client.login(process.env.DISCORD_BOT_TOKEN); }
  catch (e) { console.error('\x1b[31mDiscord login failed:\x1b[0m', e.message); }
  server.listen(PORT, () => console.log(`\x1b[32m✓\x1b[0m Dashboard on port ${PORT}`));
}

start();
