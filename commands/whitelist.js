const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('whitelist-add')
      .setDescription('Add a server to the whitelist (Owner only)')
      .addStringOption(opt => opt.setName('guild-id').setDescription('Server ID to whitelist').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client, db, botStats) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }

      const guildId = interaction.options.getString('guild-id');
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return interaction.reply({ content: 'Bot is not in that server.', ephemeral: true });

      const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
      if (existing) return interaction.reply({ content: 'That server is already whitelisted.', ephemeral: true });

      db.prepare('INSERT INTO whitelisted_servers (guild_id, guild_name, added_by, is_active) VALUES (?, ?, ?, 1)')
        .run(guildId, guild.name, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Server Whitelisted')
        .addFields(
          { name: 'Server', value: guild.name, inline: true },
          { name: 'ID', value: guildId, inline: true },
          { name: 'Members', value: `${guild.memberCount}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('whitelist-remove')
      .setDescription('Remove a server from the whitelist (Owner only)')
      .addStringOption(opt => opt.setName('guild-id').setDescription('Server ID to remove').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client, db, botStats) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }

      const guildId = interaction.options.getString('guild-id');
      const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
      if (!existing) return interaction.reply({ content: 'That server is not whitelisted.', ephemeral: true });

      db.prepare('DELETE FROM whitelisted_servers WHERE guild_id = ?').run(guildId);

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('Server Removed from Whitelist').setDescription(`Removed **${existing.guild_name}** (${guildId})`).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('whitelist-list')
      .setDescription('List all whitelisted servers (Owner only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client, db, botStats) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }

      const servers = db.prepare('SELECT * FROM whitelisted_servers ORDER BY added_at DESC').all();
      if (!servers.length) return interaction.reply({ content: 'No servers whitelisted.', ephemeral: true });

      const desc = servers.map(s => {
        const online = client.guilds.cache.has(s.guild_id);
        return `**${s.guild_name}** (\`${s.guild_id}\`) — ${s.is_active ? '✅ Active' : '❌ Disabled'} — ${online ? '🟢 Online' : '🔴 Offline'}`;
      }).join('\n');

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Whitelisted Servers').setDescription(desc).setFooter({ text: `${servers.length} server(s)` }).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('whitelist-toggle')
      .setDescription('Toggle a whitelisted server on/off (Owner only)')
      .addStringOption(opt => opt.setName('guild-id').setDescription('Server ID').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client, db, botStats) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }

      const guildId = interaction.options.getString('guild-id');
      const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
      if (!existing) return interaction.reply({ content: 'That server is not whitelisted.', ephemeral: true });

      const newStatus = existing.is_active ? 0 : 1;
      db.prepare('UPDATE whitelisted_servers SET is_active = ? WHERE guild_id = ?').run(newStatus, guildId);

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('Whitelist Toggled').setDescription(`**${existing.guild_name}** is now ${newStatus ? '✅ Enabled' : '❌ Disabled'}`).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('whitelist-check')
      .setDescription('Check if a server is whitelisted (Owner only)')
      .addStringOption(opt => opt.setName('guild-id').setDescription('Server ID to check').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client, db, botStats) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }

      const guildId = interaction.options.getString('guild-id');
      const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
      const guild = client.guilds.cache.get(guildId);

      const embed = new EmbedBuilder()
        .setColor(existing ? 0x57F287 : 0xED4245)
        .setTitle('Whitelist Check')
        .addFields(
          { name: 'Guild ID', value: guildId, inline: true },
          { name: 'Whitelisted', value: existing ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Bot In Server', value: guild ? '✅ Yes' : '❌ No', inline: true }
        );

      if (existing) {
        embed.addFields(
          { name: 'Server Name', value: existing.guild_name, inline: true },
          { name: 'Active', value: existing.is_active ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Added At', value: existing.added_at, inline: true }
        );
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
];
