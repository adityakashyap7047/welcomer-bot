const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'nick',
  description: 'Change a member\'s nickname',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageNicknames))
      return message.reply({ content: 'You need ManageNicknames permission.' });

    const member = message.mentions.members.first();
    if (!member) return message.reply({ content: 'Please mention a member.' });

    const nickname = args.slice(1).join(' ');
    if (!nickname) return message.reply({ content: 'Please provide a nickname.' });

    await member.setNickname(nickname);
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Nickname Changed')
      .setDescription(`Changed **${member.user.tag}**'s nickname to **${nickname}**.`)
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
