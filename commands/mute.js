const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .addUserOption(opt => opt.setName('user').setDescription('Member to mute').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: 'You need the Moderate Members permission.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: 'I cannot timeout this user. They may have a higher role.', ephemeral: true });

    await member.timeout(minutes * 60 * 1000, reason);

    const embed = new EmbedBuilder()
      .setTitle('Member Muted')
      .setDescription(`**${target.tag}** has been timed out.`)
      .addFields(
        { name: 'Duration', value: `${minutes} minute(s)`, inline: true },
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setColor(0xFEE75C)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
