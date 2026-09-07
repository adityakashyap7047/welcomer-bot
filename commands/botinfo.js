const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'botinfo',
  description: 'Show bot information',
  async execute(message, args, client) {
    const uptime = client.uptime;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor(uptime % 86400000 / 3600000);
    const minutes = Math.floor(uptime % 3600000 / 60000);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${client.user.username} Info`)
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Users', value: `${client.users.cache.size}`, inline: true },
        { name: 'Channels', value: `${client.channels.cache.size}`, inline: true },
        { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Node.js', value: process.version, inline: true }
      )
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
