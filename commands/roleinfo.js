const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('roleinfo').setDescription('Get information about a role')
    .addRoleOption(o => o.setName('role').setDescription('Role to inspect').setRequired(true)),
  async execute(interaction) {
    const role = interaction.options.getRole('role');
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
    await interaction.reply({ embeds: [embed] });
  }
};
