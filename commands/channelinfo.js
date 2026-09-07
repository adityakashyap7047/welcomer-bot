const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('channelinfo').setDescription('Get information about a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to inspect').addChannelTypes(ChannelType.GuildText).setRequired(false)),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Channel: ${channel.name}`)
      .addFields(
        { name: 'ID', value: channel.id, inline: true },
        { name: 'Type', value: `${channel.type}`, inline: true },
        { name: 'Category', value: channel.parent?.name || 'None', inline: true },
        { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true },
        { name: 'Slowmode', value: `${channel.rateLimitPerUser || 0}s`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
