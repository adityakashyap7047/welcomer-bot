const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'avatar',
  description: 'Get a user\'s avatar',
  async execute(message, args, client) {
    const user = message.mentions.users.first() || message.author;
    const avatar = user.displayAvatarURL({ dynamic: true, size: 1024 });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${user.tag}'s Avatar`)
      .setImage(avatar)
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
