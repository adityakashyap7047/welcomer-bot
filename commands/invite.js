const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('invite').setDescription('Get the bot invite link'),
  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Invite Me!')
      .setDescription(`[Click here to invite ${client.user.username}](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands)`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
