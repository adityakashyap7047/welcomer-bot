const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot and API latency'),
  async execute(interaction, client) {
    const sent = await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription('Pinging...')], fetchReply: true });
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Pong!')
      .addFields(
        { name: 'WebSocket', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Roundtrip', value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true }
      )
      .setTimestamp();
    await sent.edit({ embeds: [embed] });
  }
};
