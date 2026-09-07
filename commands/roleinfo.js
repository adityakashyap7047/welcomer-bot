const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'roleinfo',
  description: 'Get information about a role',
  async execute(message, args, client) {
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
    if (!role) return message.reply({ content: 'Please mention a role or provide a role ID.' });

    const embed = new EmbedBuilder()
      .setColor(role.hexColor)
      .setTitle(`Role: ${role.name}`)
      .addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Position', value: `${role.position}`, inline: true },
        { name: 'Members', value: `${role.members.size}`, inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp();
    message.reply({ embeds: [embed] });
  }
};
