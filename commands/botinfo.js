const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Show bot information'),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    const uptime = client.uptime;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor(uptime % 86400000 / 3600000);
    const minutes = Math.floor(uptime % 3600000 / 60000);
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${client.user.username} Info`)
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Users', value: `${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`, inline: true },
        { name: 'Channels', value: `${client.channels.cache.size}`, inline: true },
        { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
        { name: 'Memory', value: `${mem} MB`, inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Discord.js', value: 'v14.x', inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
