const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(opt => opt.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: 'You need the Moderate Members permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    db.prepare('INSERT INTO warnings (guildId, userId, moderatorId, reason) VALUES (?, ?, ?, ?)').run(interaction.guild.id, target.id, interaction.user.id, reason);

    const count = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guildId = ? AND userId = ?').get(interaction.guild.id, target.id);

    const embed = new EmbedBuilder()
      .setTitle('Member Warned')
      .setDescription(`**${target.tag}** has been warned.`)
      .addFields(
        { name: 'Reason', value: reason, inline: false },
        { name: 'Total Warnings', value: `${count.count}`, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setColor(0xFEE75C)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    try {
      await target.send({ content: `You have been warned in **${interaction.guild.name}** for: ${reason}` });
    } catch {}
  }
};
