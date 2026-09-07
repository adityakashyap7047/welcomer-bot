const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(opt => opt.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban').setRequired(false))
    .addIntegerOption(opt => opt.setName('days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'You need the Ban Members permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const days = interaction.options.getInteger('days') || 0;
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    if (!member.bannable) return interaction.reply({ content: 'I cannot ban this user. They may have a higher role.', ephemeral: true });

    await member.ban({ deleteMessageSeconds: days * 86400, reason });

    const embed = new EmbedBuilder()
      .setTitle('Member Banned')
      .setDescription(`**${target.tag}** has been banned from the server.`)
      .addFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true },
        { name: 'Messages Deleted', value: `${days} day(s)`, inline: true }
      )
      .setColor(0xED4245)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
