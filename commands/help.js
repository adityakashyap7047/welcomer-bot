const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all available commands'),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    const categories = {
      'Welcome System': ['setup-welcome', 'test-welcome', 'disable-welcome', 'setup-goodbye', 'disable-goodbye', 'setup-autorole', 'disable-autorole', 'setup-boost', 'setup-logs', 'welcome-preview', 'welcome-logs', 'pause-welcome', 'resume-welcome', 'clean-welcomes'],
      'Moderation': ['kick', 'ban', 'unban', 'mute', 'unmute', 'warn', 'warnings', 'clearwarnings', 'purge', 'lock', 'unlock', 'slowmode', 'timeout', 'untimeout'],
      'Server Protection': ['setup-antiraid', 'disable-antiraid', 'setup-antispam', 'disable-antispam', 'setup-badwords', 'disable-badwords', 'setup-caps', 'disable-caps', 'setup-linkfilter', 'disable-linkfilter', 'setup-antinuke', 'disable-antinuke', 'setup-mention-limit', 'disable-mention-limit', 'setup-auditlog', 'disable-auditlog', 'setup-all-protections', 'protection-status', 'set-punish'],
      'Fun': ['8ball', 'coinflip', 'dice', 'rps', 'poll', 'giveaway', 'joke', 'random', 'calc', 'remind'],
      'Utility': ['help', 'ping', 'invite', 'serverinfo', 'userinfo', 'botinfo', 'avatar', 'banner', 'roleinfo', 'channelinfo', 'stats', 'top-commands', 'widget', 'set-prefix', 'nick', 'role-add', 'role-remove'],
      'Leveling': ['level', 'leaderboard'],
      'Management': ['broadcast', 'migrate-server', 'join-all', 'mass-dm', 'setup-reaction-role', 'setup-verification', 'verify-stats', 'msg', 'say']
    };

    const isOwner = interaction.user.id === process.env.BOT_OWNER_ID;
    if (isOwner) {
      categories['Whitelist (Owner)'] = ['whitelist-add', 'whitelist-remove', 'whitelist-list', 'whitelist-toggle', 'whitelist-check'];
    }

    const embed = new EmbedBuilder()
      .setTitle('Bot Commands')
      .setDescription('Here are all available commands organized by category.')
      .setColor(0x5865F2)
      .setTimestamp()
      .setFooter({ text: `${interaction.guild?.name || 'Bot'} Commands`, iconURL: interaction.guild?.iconURL() });

    for (const [category, cmds] of Object.entries(categories)) {
      embed.addFields({ name: `${category}`, value: cmds.map(c => `\`/${c}\``).join(', '), inline: false });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite Bot')
        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel('Dashboard')
        .setURL(process.env.DISCORD_CALLBACK_URL ? process.env.DISCORD_CALLBACK_URL.replace('/auth/callback', '') : 'http://localhost:3000')
        .setStyle(ButtonStyle.Link)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
