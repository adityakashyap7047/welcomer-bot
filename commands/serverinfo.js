const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Shows detailed server information'),
  async execute(interaction, client, db, botStats) {
    botStats.commandsUsed++;
    db.prepare('INSERT INTO stats (guildId, event, userId) VALUES (?, ?, ?)').run(interaction.guild?.id, 'command', interaction.user.id);

    const { guild } = interaction;
    if (!guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

    await guild.members.fetch();
    const owner = await guild.fetchOwner();

    const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    const categories = guild.channels.cache.filter(c => c.type === 4).size;
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .setColor(0x5865F2)
      .addFields(
        { name: 'Owner', value: `<@${owner.user.id}>`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Members', value: `${guild.memberCount}`, inline: true },
        { name: 'Online', value: `${onlineMembers}`, inline: true },
        { name: 'Text Channels', value: `${textChannels}`, inline: true },
        { name: 'Voice Channels', value: `${voiceChannels}`, inline: true },
        { name: 'Categories', value: `${categories}`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Boost Level', value: `${guild.premiumTier}`, inline: true },
        { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
        { name: 'Verification Level', value: `${guild.verificationLevel}`, inline: true },
        { name: 'Server ID', value: guild.id, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `${guild.name} Info`, iconURL: guild.iconURL() });

    if (guild.description) embed.setDescription(guild.description);

    await interaction.reply({ embeds: [embed] });
  }
};
