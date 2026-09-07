const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role-remove')
    .setDescription('Remove a role from a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: 'You need the Manage Roles permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ content: 'I cannot remove a role equal to or higher than my highest role.', ephemeral: true });
    }

    try {
      await member.roles.remove(role);

      const embed = new EmbedBuilder()
        .setTitle('Role Removed')
        .setDescription(`Removed <@&${role.id}> from **${target.tag}**.`)
        .setColor(0xED4245)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: 'Failed to remove role.', ephemeral: true });
    }
  }
};
