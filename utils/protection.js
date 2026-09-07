const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('./database');

class ProtectionSystem {
  constructor(client) {
    this.client = client;
    this.joinTracker = new Map();
    this.spamTracker = new Map();
    this.nukeTracker = new Map();
  }

  logToGuild(guild, embed) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guild.id);
    if (config?.log_channel) {
      const channel = guild.channels.cache.get(config.log_channel);
      if (channel) {
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  }

  logProtection(guild, userId, action, reason) {
    db.prepare("INSERT INTO protection_log (guild_id, user_id, action, reason) VALUES (?, ?, ?, ?)")
      .run(guild.id, userId, action, reason);
  }

  async autoPunish(member, action, reason) {
    if (!member || !member.guild) return;
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(member.guild.id);
    const punish = config?.auto_punish || action;

    try {
      switch (punish) {
        case 'ban':
          if (member.bannable) await member.ban({ reason });
          break;
        case 'kick':
          if (member.kickable) await member.kick(reason);
          break;
        case 'timeout':
          if (member.moderatable) await member.timeout(300000, reason);
          break;
        case 'warn':
          db.prepare('INSERT INTO warnings (guildId, userId, moderatorId, reason) VALUES (?, ?, ?, ?)')
            .run(member.guild.id, member.id, this.client.user.id, reason);
          break;
      }
    } catch (e) {
      console.error(`Auto-punish error: ${e.message}`);
    }
  }

  async checkAntiRaid(member) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(member.guild.id);
    if (!config?.anti_raid_enabled) return false;

    const guildId = member.guild.id;
    const now = Date.now();
    const window = (config.raid_window || 30) * 1000;
    const threshold = config.raid_threshold || 5;

    if (!this.joinTracker.has(guildId)) this.joinTracker.set(guildId, []);

    const joins = this.joinTracker.get(guildId);
    joins.push({ userId: member.id, time: now });

    const recentJoins = joins.filter(j => now - j.time < window);
    this.joinTracker.set(guildId, recentJoins);

    if (recentJoins.length >= threshold) {
      this.logProtection(member.guild, member.id, 'raid_detected', `${recentJoins.length} joins in ${config.raid_window}s`);
      await this.autoPunish(member, config.raid_action || 'kick', 'Raid detection triggered');

      const log = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Raid Detected!')
        .setDescription(`${recentJoins.length} users joined in ${config.raid_window} seconds.`)
        .setTimestamp();
      this.logToGuild(member.guild, log);

      this.joinTracker.set(guildId, []);
      return true;
    }

    return false;
  }

  async checkAntiSpam(message) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(message.guild.id);
    if (!config?.anti_spam_enabled) return false;

    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    const threshold = config.spam_threshold || 5;

    if (!this.spamTracker.has(key)) this.spamTracker.set(key, []);

    const msgs = this.spamTracker.get(key);
    msgs.push({ time: now, content: message.content });

    const recentMsgs = msgs.filter(m => now - m.time < 5000);
    this.spamTracker.set(key, recentMsgs);

    if (recentMsgs.length >= threshold) {
      await message.delete().catch(() => {});
      await this.autoPunish(message.member, 'timeout', 'Spam detected');
      this.logProtection(message.guild, message.author.id, 'spam_detected', `${recentMsgs.length} msgs in 5s`);

      const log = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('Spam Detected')
        .setDescription(`${message.author} (${message.author.id}) was spamming.`)
        .setTimestamp();
      this.logToGuild(message.guild, log);

      this.spamTracker.set(key, []);
      return true;
    }

    return false;
  }

  checkBadWords(message) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(message.guild.id);
    if (!config?.anti_badwords_enabled || !config.bad_words) return false;

    const words = config.bad_words.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
    const content = message.content.toLowerCase();

    for (const word of words) {
      if (content.includes(word)) {
        message.delete().catch(() => {});
        this.autoPunish(message.member, 'timeout', `Bad word detected: ${word}`);
        this.logProtection(message.guild, message.author.id, 'bad_word', word);

        const log = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('Bad Word Detected')
          .setDescription(`${message.author} used a blocked word.`)
          .setTimestamp();
        this.logToGuild(message.guild, log);
        return true;
      }
    }
    return false;
  }

  checkCapsFilter(message) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(message.guild.id);
    if (!config?.anti_caps_enabled) return false;
    if (message.content.length < 10) return false;

    const caps = message.content.replace(/[^A-Z]/g, '').length;
    const total = message.content.replace(/[^A-Za-z]/g, '').length;
    if (total === 0) return false;

    const percentage = (caps / total) * 100;
    if (percentage >= (config.caps_threshold || 70)) {
      message.delete().catch(() => {});
      this.logProtection(message.guild, message.author.id, 'caps_violation', `${Math.round(percentage)}% caps`);

      const log = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('Caps Filter Triggered')
        .setDescription(`${message.author} sent ${Math.round(percentage)}% caps.`)
        .setTimestamp();
      this.logToGuild(message.guild, log);
      return true;
    }
    return false;
  }

  checkLinkFilter(message) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(message.guild.id);
    if (!config?.anti_links_enabled) return false;

    const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/i;
    if (linkRegex.test(message.content)) {
      message.delete().catch(() => {});
      this.logProtection(message.guild, message.author.id, 'link_detected', 'Link posted');

      const log = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('Link Filter Triggered')
        .setDescription(`${message.author} posted a link.`)
        .setTimestamp();
      this.logToGuild(message.guild, log);
      return true;
    }
    return false;
  }

  async checkAntiNuke(guild, action, executor) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guild.id);
    if (!config?.anti_nuke_enabled) return;

    const key = `${guild.id}-${executor.id}`;
    const now = Date.now();

    if (!this.nukeTracker.has(key)) this.nukeTracker.set(key, []);

    const actions = this.nukeTracker.get(key);
    actions.push({ action, time: now });

    const recent = actions.filter(a => now - a.time < 60000);
    this.nukeTracker.set(key, recent);

    if (recent.length >= 3) {
      this.logProtection(guild, executor.id, 'nuke_detected', `Multiple destructive actions`);

      const member = guild.members.cache.get(executor.id);
      if (member) await this.autoPunish(member, 'ban', 'Anti-nuke: multiple destructive actions');

      const log = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Anti-Nuke Triggered!')
        .setDescription(`${executor} performed multiple destructive actions.`)
        .setTimestamp();
      this.logToGuild(guild, log);

      this.nukeTracker.set(key, []);
    }
  }

  async monitorAuditLog(guild) {
    const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guild.id);
    if (!config?.audit_log_enabled) return;

    try {
      const memberLogs = await guild.fetchAuditLogs({ limit: 5, type: 1 });
      const memberEntry = memberLogs.entries.first();
      if (memberEntry) {
        const log = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Member Kicked')
          .setDescription(`<@${memberEntry.target.id}> was kicked by ${memberEntry.executor}`)
          .addFields({ name: 'Reason', value: memberEntry.reason || 'No reason' })
          .setTimestamp();
        this.logToGuild(guild, log);
      }

      const banLogs = await guild.fetchAuditLogs({ limit: 5, type: 2 });
      const banEntry = banLogs.entries.first();
      if (banEntry) {
        const log = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Member Banned')
          .setDescription(`<@${banEntry.target.id}> was banned by ${banEntry.executor}`)
          .addFields({ name: 'Reason', value: banEntry.reason || 'No reason' })
          .setTimestamp();
        this.logToGuild(guild, log);
      }
    } catch {}
  }
}

module.exports = ProtectionSystem;
