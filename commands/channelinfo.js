const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'channelinfo',
  description: 'Get information about a channel',
  async execute(message, args, client) {
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]) || message.channel;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`Channel: ${channel.name}`)
      .addFields(
        { name: 'ID', value: channel.id, inline: true },
        { name: 'Type', value: `${channel.type}`, inline: true },
        { name: 'Category', value: channel.parent?.name || 'None', inline: true },
        { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true },
        { name: 'Slowmode', value: `${channel.rateLimitPerUser || 0}s`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
