const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'banner',
  description: 'Get a user\'s banner',
  async execute(message, args, client) {
    const user = message.mentions.users.first() || message.author;
    const fetched = await client.users.fetch(user.id, { force: true });
    const banner = fetched.bannerURL({ dynamic: true, size: 1024 });

    if (!banner) return message.reply({ content: `${user.tag} doesn't have a banner.` });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${user.tag}'s Banner`)
      .setImage(banner)
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
