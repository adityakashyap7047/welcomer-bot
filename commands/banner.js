const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription("Get a user's banner")
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false)),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    const target = interaction.options.getUser('user') || interaction.user;
    const fetched = await client.users.fetch(target.id, { force: true });
    const banner = fetched.bannerURL({ dynamic: true, size: 1024 });

    if (!banner) return interaction.reply({ content: `${target.tag} doesn't have a banner.`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${target.tag}'s Banner`)
      .setImage(banner)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
