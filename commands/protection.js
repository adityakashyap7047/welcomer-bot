const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../utils/database');

function getConfig(guildId) {
  return db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId) || {};
}

function setConfig(guildId, updates) {
  const existing = getConfig(guildId);
  if (!existing.guild_id) {
    db.prepare("INSERT OR IGNORE INTO guilds (guild_id, updated_at) VALUES (?, datetime('now'))").run(guildId);
  }
  for (const [key, val] of Object.entries(updates)) {
    db.prepare(`UPDATE guilds SET ${key} = ?, updated_at = datetime('now') WHERE guild_id = ?`).run(val, guildId);
  }
}

const commands = [
  // ═══════════════════════════════════════════════════════════════
  // ANTI-RAID
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder()
      .setName('setup-antiraid')
      .setDescription('Configure anti-raid protection')
      .addIntegerOption(o => o.setName('threshold').setDescription('Joins before trigger (default 5)').setMinValue(2).setMaxValue(50))
      .addIntegerOption(o => o.setName('window').setDescription('Time window in seconds (default 30)').setMinValue(10).setMaxValue(120))
      .addStringOption(o => o.setName('action').setDescription('Action against raiders')
        .addChoices({ name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }, { name: 'Timeout', value: 'timeout' }, { name: 'Lockdown', value: 'lockdown' }))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const threshold = interaction.options.getInteger('threshold') || 5;
      const window = interaction.options.getInteger('window') || 30;
      const action = interaction.options.getString('action') || 'kick';
      setConfig(interaction.guild.id, { anti_raid_enabled: 1, raid_threshold: threshold, raid_window: window, raid_action: action });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Anti-Raid Enabled')
        .addFields({ name: 'Threshold', value: `${threshold} joins`, inline: true }, { name: 'Window', value: `${window}s`, inline: true }, { name: 'Action', value: action, inline: true })
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-antiraid').setDescription('Disable anti-raid protection').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_raid_enabled: 0 });
      await interaction.reply({ content: 'Anti-raid protection disabled.', ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // ANTI-SPAM
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder()
      .setName('setup-antispam')
      .setDescription('Configure anti-spam protection')
      .addIntegerOption(o => o.setName('threshold').setDescription('Messages before action (default 5)').setMinValue(3).setMaxValue(20))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const threshold = interaction.options.getInteger('threshold') || 5;
      setConfig(interaction.guild.id, { anti_spam_enabled: 1, spam_threshold: threshold });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Anti-Spam Enabled')
        .addFields({ name: 'Threshold', value: `${threshold} messages in 5s`, inline: true }).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-antispam').setDescription('Disable anti-spam protection').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_spam_enabled: 0 });
      await interaction.reply({ content: 'Anti-spam protection disabled.', ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // BAD WORDS
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder()
      .setName('setup-badwords')
      .setDescription('Configure bad words filter')
      .addStringOption(o => o.setName('words').setDescription('Comma-separated bad words').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const words = interaction.options.getString('words');
      setConfig(interaction.guild.id, { anti_badwords_enabled: 1, bad_words: words });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Bad Words Filter Enabled')
        .addFields({ name: 'Words', value: words.split(',').length + ' words added', inline: true }).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-badwords').setDescription('Disable bad words filter').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_badwords_enabled: 0 });
      await interaction.reply({ content: 'Bad words filter disabled.', ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // CAPS FILTER
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder()
      .setName('setup-caps')
      .setDescription('Configure caps filter')
      .addIntegerOption(o => o.setName('threshold').setDescription('Caps percentage threshold (default 70)').setMinValue(50).setMaxValue(95))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const threshold = interaction.options.getInteger('threshold') || 70;
      setConfig(interaction.guild.id, { anti_caps_enabled: 1, caps_threshold: threshold });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Caps Filter Enabled')
        .addFields({ name: 'Threshold', value: `${threshold}%`, inline: true }).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-caps').setDescription('Disable caps filter').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_caps_enabled: 0 });
      await interaction.reply({ content: 'Caps filter disabled.', ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // LINK FILTER
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('setup-linkfilter').setDescription('Enable unauthorized link filter').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_links_enabled: 1 });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Link Filter Enabled').setDescription('Unauthorized links will be deleted.').setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-linkfilter').setDescription('Disable link filter').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_links_enabled: 0 });
      await interaction.reply({ content: 'Link filter disabled.', ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // ANTI-NUKE
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('setup-antinuke').setDescription('Enable anti-nuke protection (mass deletion)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_nuke_enabled: 1 });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Anti-Nuke Enabled').setDescription('Server will auto-lockdown if mass deletions detected.').setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-antinuke').setDescription('Disable anti-nuke protection').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_nuke_enabled: 0 });
      await interaction.reply({ content: 'Anti-nuke protection disabled.', ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // MENTION LIMIT
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder()
      .setName('setup-mention-limit')
      .setDescription('Configure mass mention protection')
      .addIntegerOption(o => o.setName('threshold').setDescription('Max mentions allowed (default 5)').setMinValue(1).setMaxValue(20))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const threshold = interaction.options.getInteger('threshold') || 5;
      setConfig(interaction.guild.id, { anti_mass_mention_enabled: 1, mass_mention_threshold: threshold });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Mention Limit Enabled')
        .addFields({ name: 'Threshold', value: `${threshold} mentions`, inline: true }).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-mention-limit').setDescription('Disable mass mention protection').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { anti_mass_mention_enabled: 0 });
      await interaction.reply({ content: 'Mass mention protection disabled.', ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('setup-auditlog').setDescription('Enable audit log monitoring').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { audit_log_enabled: 1 });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Audit Log Monitor Enabled').setDescription('Suspicious audit log events will be logged.').setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-auditlog').setDescription('Disable audit log monitoring').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      setConfig(interaction.guild.id, { audit_log_enabled: 0 });
      await interaction.reply({ content: 'Audit log monitoring disabled.', ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // BULK ACTIONS
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('setup-all-protections').setDescription('Enable ALL protection features at once').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      setConfig(interaction.guild.id, {
        anti_raid_enabled: 1, anti_spam_enabled: 1, anti_badwords_enabled: 1,
        anti_caps_enabled: 1, anti_links_enabled: 1, anti_nuke_enabled: 1,
        anti_mass_mention_enabled: 1, audit_log_enabled: 1
      });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('All Protections Enabled!')
        .setDescription('Anti-raid, anti-spam, bad words, caps, links, anti-nuke, mass mentions, and audit log are all now active.')
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-all-protections').setDescription('Disable ALL protection features').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      setConfig(interaction.guild.id, {
        anti_raid_enabled: 0, anti_spam_enabled: 0, anti_badwords_enabled: 0,
        anti_caps_enabled: 0, anti_links_enabled: 0, anti_nuke_enabled: 0,
        anti_mass_mention_enabled: 0, audit_log_enabled: 0
      });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('All Protections Disabled').setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('protection-status').setDescription('View current protection settings').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const config = getConfig(interaction.guild.id);
      const features = [
        { name: 'Anti-Raid', enabled: config.anti_raid_enabled },
        { name: 'Anti-Spam', enabled: config.anti_spam_enabled },
        { name: 'Bad Words', enabled: config.anti_badwords_enabled },
        { name: 'Caps Filter', enabled: config.anti_caps_enabled },
        { name: 'Link Filter', enabled: config.anti_links_enabled },
        { name: 'Anti-Nuke', enabled: config.anti_nuke_enabled },
        { name: 'Mass Mention', enabled: config.anti_mass_mention_enabled },
        { name: 'Audit Log', enabled: config.audit_log_enabled }
      ];
      const desc = features.map(f => `${f.enabled ? '✅' : '❌'} **${f.name}**`).join('\n');
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Protection Status').setDescription(desc)
        .addFields({ name: 'Auto-Punish', value: config.auto_punish || 'timeout', inline: true })
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('set-punish')
      .setDescription('Set the auto-punish type for protection violations')
      .addStringOption(o => o.setName('type').setDescription('Punishment type').setRequired(true)
        .addChoices({ name: 'Timeout (1hr)', value: 'timeout' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }, { name: 'Mute Role', value: 'mute' }))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const type = interaction.options.getString('type');
      setConfig(interaction.guild.id, { auto_punish: type });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`Auto-punish set to **${type}**`).setTimestamp()], ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // LOCKDOWN
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('lockdown').setDescription('Lockdown the server (disable messages in all channels)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
      const ProtectionSystem = require('../utils/protection');
      const prot = new ProtectionSystem(client);
      await prot.lockdownServer(interaction.guild, `Lockdown by ${interaction.user.tag}`);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('Server Locked Down').setDescription('All text channels have been locked.').setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('unlock-server').setDescription('Unlock all locked channels').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
      const ProtectionSystem = require('../utils/protection');
      const prot = new ProtectionSystem(client);
      await prot.unlockServer(interaction.guild, interaction.user);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Server Unlocked').setDescription('All channels have been unlocked.').setTimestamp()], ephemeral: true });
    }
  }
];

module.exports = commands;
