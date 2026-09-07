const { EmbedBuilder } = require('discord.js');

function replaceVariables(text, member, guild) {
  if (!text) return '';
  return text
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{displayname}/g, member.displayName)
    .replace(/{server}/g, guild.name)
    .replace(/{serverid}/g, guild.id)
    .replace(/{count}/g, guild.memberCount)
    .replace(/{online}/g, guild.members.cache.filter(m => m.presence?.status !== 'offline').size)
    .replace(/{membercount}/g, guild.memberCount)
    .replace(/{mention}/g, `<@${member.id}>`)
    .replace(/{tag}/g, member.user.tag)
    .replace(/{created}/g, `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
    .replace(/{id}/g, member.id);
}

function createWelcomeEmbed(member, guild, config) {
  const color = config.welcome_color || '#00ff88';
  const message = replaceVariables(config.welcome_message || 'Welcome to {server}, {user}! You are member #{count}!', member, guild);
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`Welcome to ${guild.name}!`)
    .setDescription(message)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Member Count', value: `${guild.memberCount}`, inline: true },
      { name: 'ID', value: member.id, inline: true }
    )
    .setFooter({ text: `${guild.name} • Welcome System` })
    .setTimestamp();
}

function createGoodbyeEmbed(member, guild, config) {
  const color = config.goodbye_color || '#ff4444';
  const message = replaceVariables(config.goodbye_message || 'Goodbye {user}, we will miss you!', member, guild);
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`Goodbye from ${guild.name}`)
    .setDescription(message)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields({ name: 'Member Count', value: `${guild.memberCount}`, inline: true })
    .setFooter({ text: `${guild.name} • Goodbye System` })
    .setTimestamp();
}

function createBoostEmbed(member, guild, config) {
  const message = replaceVariables(config.boost_message || '{user} just boosted {server}! Thank you!', member, guild);
  return new EmbedBuilder()
    .setColor('#f47fff')
    .setTitle('Server Boost!')
    .setDescription(message)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: `${guild.name} • Boost System` })
    .setTimestamp();
}

module.exports = { replaceVariables, createWelcomeEmbed, createGoodbyeEmbed, createBoostEmbed };
