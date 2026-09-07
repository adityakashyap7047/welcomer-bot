const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false)),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    const target = interaction.options.getUser('user') || interaction.user;
    const warnings = db.prepare('SELECT * FROM warnings WHERE guildId = ? AND userId = ? ORDER BY timestamp DESC').all(interaction.guild.id, target.id);

    if (warnings.length === 0) {
      return interaction.reply({ content: `${target.tag} has no warnings.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Warnings for ${target.tag}`)
      .setColor(0xFEE75C)
      .setTimestamp();

    warnings.forEach((w, i) => {
      embed.addFields({
        name: `Warning #${i + 1}`,
        value: `**Reason:** ${w.reason}\n**Moderator:** <@${w.moderatorId}>\n**Date:** <t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>`,
        inline: false
      });
    });

    embed.setFooter({ text: `Total: ${warnings.length} warning(s)` });

    await interaction.reply({ embeds: [embed] });
  }
};
