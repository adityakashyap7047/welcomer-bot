const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel to prevent messages')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('Channel Locked')
      .setDescription(`${channel} has been locked.`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
