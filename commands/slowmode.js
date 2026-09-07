const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode delay for a channel')
    .addIntegerOption(opt => opt.setName('seconds').setDescription('Duration (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    const seconds = interaction.options.getInteger('seconds');
    await interaction.channel.setRateLimitPerUser(seconds);

    const embed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('Slowmode Updated')
      .setDescription(seconds === 0 ? 'Slowmode disabled.' : `Slowmode set to **${seconds}** seconds.`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
