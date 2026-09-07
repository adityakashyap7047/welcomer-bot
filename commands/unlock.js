const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a previously locked channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: true });

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('Channel Unlocked')
      .setDescription(`${channel} has been unlocked.`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
