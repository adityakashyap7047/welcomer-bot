const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'purge',
  description: 'Delete multiple messages',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply({ content: 'You need ManageMessages permission.' });

    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100)
      return message.reply({ content: 'Please provide a number between 1 and 100.' });

    const deleted = await message.channel.bulkDelete(amount, true);
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Messages Purged')
      .setDescription(`Deleted **${deleted.size}** messages.`)
      .setTimestamp();
    const reply = await message.reply({ embeds: [embed] });
    setTimeout(() => reply.delete().catch(() => {}), 3000);
  }
};
