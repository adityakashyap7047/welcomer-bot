const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .addStringOption(opt => opt.setName('userid').setDescription('User ID to unban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for unban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'You need the Ban Members permission.', ephemeral: true });
    }

    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const banList = await interaction.guild.bans.fetch();
      const banned = banList.get(userId);

      if (!banned) return interaction.reply({ content: 'User is not banned.', ephemeral: true });

      await interaction.guild.members.unban(userId, reason);

      const embed = new EmbedBuilder()
        .setTitle('Member Unbanned')
        .setDescription(`**${banned.user.tag}** has been unbanned.`)
        .addFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Moderator', value: interaction.user.tag, inline: true }
        )
        .setColor(0x57F287)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: 'Failed to unban user. Make sure the ID is correct.', ephemeral: true });
    }
  }
};
