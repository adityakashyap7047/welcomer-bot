const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('nick').setDescription('Change a member nickname')
    .addUserOption(o => o.setName('target').setDescription('Member to change nickname').setRequired(true))
    .addStringOption(o => o.setName('nickname').setDescription('New nickname').setRequired(true).setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
  async execute(interaction) {
    const target = interaction.options.getUser('target');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
    if (!member.manageable) return interaction.reply({ content: 'Cannot change this nickname.', ephemeral: true });
    await member.setNickname(interaction.options.getString('nickname'));
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`Nickname changed for ${target} to **${interaction.options.getString('nickname')}**`)
        .setTimestamp()]
    });
  }
};
