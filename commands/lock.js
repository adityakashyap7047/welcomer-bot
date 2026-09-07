const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'lock',
  description: 'Lock a channel',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply({ content: 'You need ManageChannels permission.' });

    const channel = message.mentions.channels.first() || message.channel;
    await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Channel Locked')
      .setDescription(`${channel} has been locked.`)
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
