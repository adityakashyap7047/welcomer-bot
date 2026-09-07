const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'unlock',
  description: 'Unlock a channel',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply({ content: 'You need ManageChannels permission.' });

    const channel = message.mentions.channels.first() || message.channel;
    await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Channel Unlocked')
      .setDescription(`${channel} has been unlocked.`)
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
