const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a user')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: 'You need the Moderate Members permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const count = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guildId = ? AND userId = ?').get(interaction.guild.id, target.id);
    db.prepare('DELETE FROM warnings WHERE guildId = ? AND userId = ?').run(interaction.guild.id, target.id);

    const embed = new EmbedBuilder()
      .setTitle('Warnings Cleared')
      .setDescription(`Cleared **${count.count}** warning(s) for **${target.tag}**.`)
      .setColor(0x57F287)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
