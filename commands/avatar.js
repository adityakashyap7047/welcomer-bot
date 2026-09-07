const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Get a user's avatar")
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false)),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    const target = interaction.options.getUser('user') || interaction.user;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${target.tag}'s Avatar`)
      .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
