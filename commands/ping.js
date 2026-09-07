const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  description: 'Check bot latency',
  async execute(message, args, client) {
    const sent = await message.reply({ embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('Pinging...')] });
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Pong!')
      .addFields(
        { name: 'WebSocket', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Roundtrip', value: `${sent.createdTimestamp - message.createdTimestamp}ms`, inline: true }
      )
      .setTimestamp();
    sent.edit({ embeds: [embed] });
  }
};
