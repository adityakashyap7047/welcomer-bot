const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role-add')
    .setDescription('Add a role to a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
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
      return interaction.reply({ content: 'I cannot assign a role equal to or higher than my highest role.', ephemeral: true });
    }
    if (role.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: 'You cannot assign a role equal to or higher than your highest role.', ephemeral: true });
    }

    try {
      await member.roles.add(role);

      const embed = new EmbedBuilder()
        .setTitle('Role Added')
        .setDescription(`Added <@&${role.id}> to **${target.tag}**.`)
        .setColor(0x57F287)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: 'Failed to add role.', ephemeral: true });
    }
  }
};
