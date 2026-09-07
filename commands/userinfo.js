const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Shows user information')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false)),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    const target = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(target.id) || await interaction.guild?.members.fetch(target.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(`${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .setColor(member?.displayColor || 0x5865F2)
      .addFields(
        { name: 'Username', value: target.username, inline: true },
        { name: 'ID', value: target.id, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    if (member) {
      embed.addFields(
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Roles', value: member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'None', inline: false }
      );
    }

    if (target.banner) embed.setImage(target.bannerURL({ size: 512 }));

    await interaction.reply({ embeds: [embed] });
  }
};
