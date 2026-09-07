const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'invite',
  description: 'Get bot invite link',
  async execute(message, args, client) {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Invite Me!')
      .setDescription(`[Click here to invite ${client.user.username}](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands)`)
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
