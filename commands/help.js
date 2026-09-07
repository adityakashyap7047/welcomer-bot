const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all available commands'),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    const categories = {
      'Welcome': ['setup-welcome', 'test-welcome', 'disable-welcome', 'setup-goodbye', 'disable-goodbye', 'setup-autorole', 'disable-autorole', 'setup-boost', 'setup-logs', 'welcome-preview', 'welcome-logs', 'pause-welcome', 'resume-welcome', 'clean-welcomes'],
      'Moderation': ['kick', 'ban', 'unban', 'mute', 'unmute', 'warn', 'warnings', 'clearwarnings', 'purge', 'lock', 'unlock', 'slowmode', 'timeout', 'untimeout', 'broadcast'],
      'Fun': ['8ball', 'coinflip', 'dice', 'rps', 'poll', 'giveaway', 'joke', 'random', 'calc'],
      'Utility': ['help', 'ping', 'invite', 'serverinfo', 'userinfo', 'botinfo', 'avatar', 'banner', 'roleinfo', 'channelinfo', 'stats', 'welcome-logs', 'top-commands', 'setup-reaction-role', 'widget', 'set-prefix', 'nick', 'role-add', 'role-remove']
    };

    const embed = new EmbedBuilder()
      .setTitle('Bot Commands')
      .setDescription('Here are all available commands organized by category.')
      .setColor(0x5865F2)
      .setTimestamp()
      .setFooter({ text: `${interaction.guild?.name || 'Bot'} Commands`, iconURL: interaction.guild?.iconURL() });

    for (const [category, commands] of Object.entries(categories)) {
      embed.addFields({ name: `${category}`, value: commands.map(c => `\`/${c}\``).join(', '), inline: false });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite Bot')
        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
        .setStyle(ButtonStyle.Link)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
