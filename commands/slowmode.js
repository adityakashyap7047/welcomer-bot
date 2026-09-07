const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'slowmode',
  description: 'Set slowmode for a channel',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply({ content: 'You need ManageChannels permission.' });

    const seconds = parseInt(args[0]) || 0;
    if (seconds < 0 || seconds > 21600) return message.reply({ content: 'Slowmode must be 0-21600 seconds.' });

    await message.channel.setRateLimitPerUser(seconds);
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Slowmode Updated')
      .setDescription(seconds === 0 ? 'Slowmode disabled.' : `Slowmode set to **${seconds}** seconds.`)
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
