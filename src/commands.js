const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../utils/database');
const { replaceVariables } = require('../utils/helpers');

const commands = [
  {
    data: new SlashCommandBuilder().setName('setup-welcome').setDescription('Configure the welcome system')
      .addChannelOption(o => o.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Welcome message. Vars: {user}, {server}, {count}, {tag}').setRequired(false))
      .addStringOption(o => o.setName('color').setDescription('Embed color (hex)').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message') || 'Welcome to {server}, {user}! You are member #{count}!';
      const color = interaction.options.getString('color') || '#00ff88';
      db.prepare("INSERT OR REPLACE INTO guilds (guild_id, guild_name, welcome_enabled, welcome_channel, welcome_message, welcome_color, updated_at) VALUES (?, ?, 1, ?, ?, ?, datetime('now'))")
        .run(interaction.guild.id, interaction.guild.name, channel.id, message, color);
      db.prepare("INSERT OR REPLACE INTO guild_stats (guild_id, total_members, last_updated) VALUES (?, ?, datetime('now'))")
        .run(interaction.guild.id, interaction.guild.memberCount);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Welcome System Configured').setDescription(`Enabled in <#${channel.id}>`).addFields({name:'Color',value:color,inline:true},{name:'Message',value:message.substring(0,1024)}).setFooter({text:'Use /test-welcome to test!'})], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('test-welcome').setDescription('Test the welcome system'),
    async execute(interaction) {
      const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(interaction.guild.id);
      if (!config?.welcome_enabled) return interaction.reply({ content: 'Welcome system not configured.', ephemeral: true });
      const channel = interaction.guild.channels.cache.get(config.welcome_channel);
      if (!channel) return interaction.reply({ content: 'Welcome channel not found.', ephemeral: true });
      const { createWelcomeEmbed } = require('../utils/helpers');
      await channel.send({ embeds: [createWelcomeEmbed(interaction.member, interaction.guild, config)] });
      await interaction.reply({ content: `Test welcome sent to <#${channel.id}>!`, ephemeral: true });
      db.prepare("INSERT INTO welcome_logs (guild_id, user_id, user_tag, channel_id, type) VALUES (?, ?, ?, ?, 'test')")
        .run(interaction.guild.id, interaction.user.id, interaction.user.tag, channel.id);
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-welcome').setDescription('Disable the welcome system').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET welcome_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Welcome system disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-goodbye').setDescription('Configure the goodbye system')
      .addChannelOption(o => o.setName('channel').setDescription('Goodbye channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Goodbye message').setRequired(false))
      .addStringOption(o => o.setName('color').setDescription('Embed color').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message') || 'Goodbye {user}, we will miss you!';
      const color = interaction.options.getString('color') || '#ff4444';
      db.prepare("UPDATE guilds SET goodbye_enabled = 1, goodbye_channel = ?, goodbye_message = ?, goodbye_color = ?, updated_at = datetime('now') WHERE guild_id = ?")
        .run(channel.id, message, color, interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Goodbye System Configured').setDescription(`Goodbye messages in <#${channel.id}>`)], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-goodbye').setDescription('Disable goodbye system').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET goodbye_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Goodbye system disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-autorole').setDescription('Auto-assign roles to new members')
      .addRoleOption(o => o.setName('role').setDescription('Role to auto-assign').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const role = interaction.options.getRole('role');
      if (role.position >= interaction.guild.members.me.roles.highest.position)
        return interaction.reply({ content: 'Cannot assign a role higher than my highest role.', ephemeral: true });
      db.prepare("UPDATE guilds SET autorole_enabled = 1, autorole_id = ?, updated_at = datetime('now') WHERE guild_id = ?").run(role.id, interaction.guild.id);
      await interaction.reply({ content: `Auto-role configured: ${role}`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-autorole').setDescription('Disable auto-role').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET autorole_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Auto-role disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-boost').setDescription('Configure boost announcements')
      .addChannelOption(o => o.setName('channel').setDescription('Boost channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Boost message').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message') || '{user} just boosted {server}! Thank you!';
      db.prepare("UPDATE guilds SET boost_channel = ?, boost_message = ?, updated_at = datetime('now') WHERE guild_id = ?").run(channel.id, message, interaction.guild.id);
      await interaction.reply({ content: `Boost system configured in <#${channel.id}>!`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-logs').setDescription('Set up logging channel')
      .addChannelOption(o => o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET log_channel = ?, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.options.getChannel('channel').id, interaction.guild.id);
      await interaction.reply({ content: `Logging enabled in <#${interaction.options.getChannel('channel').id}>`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('set-prefix').setDescription('Set custom prefix')
      .addStringOption(o => o.setName('prefix').setDescription('New prefix (max 5)').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const prefix = interaction.options.getString('prefix').slice(0, 5);
      db.prepare("UPDATE guilds SET prefix = ?, updated_at = datetime('now') WHERE guild_id = ?").run(prefix, interaction.guild.id);
      await interaction.reply({ content: `Prefix set to \`${prefix}\``, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('serverinfo').setDescription('Display server information'),
    async execute(interaction) {
      const guild = interaction.guild;
      const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(config?.welcome_color || '#00ff88').setTitle(guild.name).setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: 'Members', value: `${guild.memberCount}`, inline: true },
          { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: 'Boost Level', value: `${guild.premiumTier}`, inline: true },
          { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'Welcome', value: config?.welcome_enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Goodbye', value: config?.goodbye_enabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Auto-Role', value: config?.autorole_enabled ? 'Enabled' : 'Disabled', inline: true }
        ).setFooter({ text: `Requested by ${interaction.user.tag}` }).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('userinfo').setDescription('Display user information')
      .addUserOption(o => o.setName('user').setDescription('User to inspect').setRequired(false)),
    async execute(interaction) {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild.members.cache.get(user.id);
      const embed = new EmbedBuilder().setColor('#00ff88').setTitle(user.tag).setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields({ name: 'ID', value: user.id, inline: true }, { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true }, { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }).setTimestamp();
      if (member) embed.addFields({ name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true });
      await interaction.reply({ embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('botinfo').setDescription('Display bot information'),
    async execute(interaction) {
      const { client } = interaction;
      const uptime = formatUptime(client.uptime);
      const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const active = db.prepare('SELECT COUNT(*) as count FROM guilds WHERE welcome_enabled = 1').get().count;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff88').setTitle('Nexus Welcomer Bot').setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
          { name: 'Users', value: `${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`, inline: true },
          { name: 'Uptime', value: uptime, inline: true },
          { name: 'Memory', value: `${mem} MB`, inline: true },
          { name: 'Active Welcomes', value: `${active}`, inline: true },
          { name: 'Node.js', value: process.version, inline: true }
        ).setFooter({ text: 'Nexus Welcomer' }).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('welcome-logs').setDescription('View welcome logs')
      .addIntegerOption(o => o.setName('count').setDescription('Number of logs (1-25)').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const count = Math.min(interaction.options.getInteger('count') || 10, 25);
      const logs = db.prepare('SELECT * FROM welcome_logs WHERE guild_id = ? ORDER BY id DESC LIMIT ?').all(interaction.guild.id, count);
      if (!logs.length) return interaction.reply({ content: 'No logs found.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff88').setTitle('Welcome Logs')
        .setDescription(logs.map(l => `\`${l.timestamp}\` — ${l.user_tag} — ${l.type}`).join('\n')).setFooter({ text: `${logs.length} logs` })], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('stats').setDescription('View bot statistics'),
    async execute(interaction) {
      const w = db.prepare('SELECT COUNT(*) as count FROM welcome_logs WHERE guild_id = ?').get(interaction.guild.id).count;
      const c = db.prepare('SELECT COUNT(*) as count FROM commands_used WHERE guild_id = ?').get(interaction.guild.id).count;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff88').setTitle(`${interaction.guild.name} Statistics`)
        .addFields({ name: 'Welcomes', value: `${w}`, inline: true }, { name: 'Commands', value: `${c}`, inline: true }, { name: 'Members', value: `${interaction.guild.memberCount}`, inline: true }).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('clean-welcomes').setDescription('Clean old bot messages')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to clean').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Messages to check (1-100)').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel');
      const amount = Math.min(interaction.options.getInteger('amount') || 50, 100);
      await interaction.deferReply({ ephemeral: true });
      try {
        const messages = await channel.messages.fetch({ limit: amount });
        const deleted = await channel.bulkDelete(messages.filter(m => m.author.bot), true);
        await interaction.editReply(`Deleted ${deleted.size} bot messages.`);
      } catch { await interaction.editReply('Failed — messages may be older than 14 days.'); }
    }
  },
  {
    data: new SlashCommandBuilder().setName('pause-welcome').setDescription('Pause welcome messages').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET welcome_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Welcome messages paused. Use /resume-welcome to restart.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('resume-welcome').setDescription('Resume welcome messages').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET welcome_enabled = 1, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Welcome messages resumed!', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('broadcast').setDescription('DM all server members')
      .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const message = interaction.options.getString('message');
      await interaction.deferReply({ ephemeral: true });
      const members = await interaction.guild.members.fetch();
      let sent = 0, failed = 0;
      for (const [, m] of members) { if (!m.user.bot) try { await m.send(message); sent++; } catch { failed++; } }
      await interaction.editReply(`Broadcast: ${sent} sent, ${failed} failed.`);
    }
  },
  {
    data: new SlashCommandBuilder().setName('migrate-server').setDescription('Create invite + notify members to join a new server')
      .addChannelOption(o => o.setName('target-channel').setDescription('Channel in the NEW server to create invite for (bot must be in new server)').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Custom message to send to members').setRequired(false))
      .addIntegerOption(o => o.setName('max-uses').setDescription('Invite max uses (0 = unlimited)').setMinValue(0).setMaxValue(100).setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const targetChannel = interaction.options.getChannel('target-channel');
      const customMsg = interaction.options.getString('message') || '';
      const maxUses = interaction.options.getInteger('max-uses') || 0;
      const guild = interaction.guild;

      if (targetChannel.guild.id === guild.id) {
        return interaction.reply({ content: 'Target channel must be in a DIFFERENT server (the new server).', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      let invite;
      try {
        invite = await targetChannel.createInvite({
          maxAge: maxUses === 0 ? 0 : 604800,
          maxUses: maxUses === 0 ? 0 : maxUses,
          reason: `Server migration from ${guild.name}`
        });
      } catch (e) {
        return interaction.editReply('Failed to create invite. Make sure the bot has "Create Invite" permission in the target channel.');
      }

      const inviteURL = `https://discord.gg/${invite.code}`;
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📢 Server Migration: ${guild.name}`)
        .setDescription(
          (customMsg ? customMsg + '\n\n' : '') +
          `The server **${guild.name}** is moving to a new home!\n\n` +
          `**Click below to join the new server:**\n${inviteURL}\n\n` +
          `This is a one-time opportunity. Join now before the invite expires!`
        )
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'This message was sent by a server administrator' })
        .setTimestamp();

      await interaction.editReply({
        content: `Invite created: ${inviteURL}\nNow sending DMs to all members...`,
        embeds: []
      });

      const members = await interaction.guild.members.fetch({ withUser: true });
      let sent = 0, failed = 0, bots = 0;

      for (const [, member] of members) {
        if (member.user.bot) { bots++; continue; }
        try {
          await member.send({ embeds: [embed] });
          sent++;
        } catch {
          failed++;
        }
      }

      const report = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Migration Report')
        .addFields(
          { name: 'Invite URL', value: inviteURL, inline: false },
          { name: 'DMs Sent', value: `${sent}`, inline: true },
          { name: 'DMs Failed', value: `${failed}`, inline: true },
          { name: 'Bots Skipped', value: `${bots}`, inline: true },
          { name: 'Total Members', value: `${guild.memberCount}`, inline: true }
        )
        .setFooter({ text: 'Share this link in announcements as backup' })
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [report] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('join-all').setDescription('Add all authorized users to a server using their OAuth tokens')
      .addStringOption(o => o.setName('guild-id').setDescription('Target server ID to join users to').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }

      const targetGuildId = interaction.options.getString('guild-id');
      const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
      if (!targetGuild) return interaction.reply({ content: 'Bot is not in that server.', ephemeral: true });

      const authorized = db.prepare('SELECT * FROM authorized_users').all();
      if (!authorized.length) return interaction.reply({ content: 'No users have authorized with `guilds.join` yet. Share the login link first.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });

      let joined = 0, failed = 0, alreadyIn = 0;
      const axios = require('axios');

      for (const user of authorized) {
        try {
          const member = targetGuild.members.cache.get(user.user_id);
          if (member) { alreadyIn++; continue; }

          await axios.put(
            `https://discord.com/api/v10/guilds/${targetGuildId}/members/${user.user_id}`,
            { access_token: user.access_token },
            { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' } }
          );
          joined++;
        } catch (e) {
          failed++;
        }
      }

      const report = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Join All Report')
        .setDescription(`Attempted to add all authorized users to **${targetGuild.name}**`)
        .addFields(
          { name: 'Joined', value: `${joined}`, inline: true },
          { name: 'Already In', value: `${alreadyIn}`, inline: true },
          { name: 'Failed', value: `${failed}`, inline: true },
          { name: 'Total Authorized', value: `${authorized.length}`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [report] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('mass-dm').setDescription('DM all members (slow speed to avoid rate limits)')
      .addStringOption(o => o.setName('message').setDescription('Message to send ({user} = mention, {server} = server name)').setRequired(true))
      .addIntegerOption(o => o.setName('delay').setDescription('Delay in seconds between each DM (min 3)').setRequired(false))
      .addBooleanOption(o => o.setName('bots').setDescription('Also DM bots?').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }

      const msgTemplate = interaction.options.getString('message');
      const delaySec = Math.max(interaction.options.getInteger('delay') || 5, 3);
      const includeBots = interaction.options.getBoolean('bots') || false;
      const guild = interaction.guild;

      await interaction.deferReply({ ephemeral: true });

      const members = await guild.members.fetch();
      const targets = includeBots ? members.array() : members.array().filter(m => !m.user.bot);
      const total = targets.length;
      let sent = 0, failed = 0, dmBlocked = 0;

      // Send initial progress embed
      const progEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('Mass DM — Running')
        .setDescription(`Sending to **${total}** members with **${delaySec}s** delay between each.`)
        .addFields({ name: 'Progress', value: `0 / ${total} (0%)` })
        .setFooter({ text: 'This will take a while...' })
        .setTimestamp();
      const progMsg = await interaction.editReply({ embeds: [progEmbed] });

      for (let i = 0; i < targets.length; i++) {
        const member = targets[i];
        const personalized = msgTemplate
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{server}/g, guild.name);

        try {
          await member.send({ content: personalized });
          sent++;
        } catch (e) {
          failed++;
          if (e.code === 50007) dmBlocked++; // Cannot send messages to this user
        }

        // Update progress every 10 members
        if ((i + 1) % 10 === 0 || i === targets.length - 1) {
          const percent = Math.round(((i + 1) / total) * 100);
          const elapsed = ((i + 1) * delaySec);
          const eta = Math.round(((total - i - 1) * delaySec));
          const etaMin = Math.floor(eta / 60);
          const etaSec = eta % 60;

          const updatedEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('Mass DM — Running')
            .setDescription(`Sending to **${total}** members with **${delaySec}s** delay between each.`)
            .addFields(
              { name: 'Progress', value: `${i + 1} / ${total} (${percent}%)`, inline: true },
              { name: 'Sent', value: `${sent}`, inline: true },
              { name: 'Failed', value: `${failed}`, inline: true },
              { name: 'DM Blocked', value: `${dmBlocked}`, inline: true },
              { name: 'Elapsed', value: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`, inline: true },
              { name: 'ETA', value: `${etaMin}m ${etaSec}s`, inline: true }
            )
            .setTimestamp();
          await interaction.editReply({ embeds: [updatedEmbed] }).catch(() => {});
        }

        // Wait between DMs (skip wait on last one)
        if (i < targets.length - 1) {
          await new Promise(r => setTimeout(r, delaySec * 1000));
        }
      }

      const finalReport = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Mass DM — Complete')
        .setDescription(`Finished DMing all members in **${guild.name}**`)
        .addFields(
          { name: 'Total', value: `${total}`, inline: true },
          { name: 'Sent', value: `${sent}`, inline: true },
          { name: 'Failed', value: `${failed}`, inline: true },
          { name: 'DM Blocked', value: `${dmBlocked}`, inline: true },
          { name: 'Delay', value: `${delaySec}s per DM`, inline: true },
          { name: 'Total Time', value: `${Math.floor((total * delaySec) / 60)}m ${(total * delaySec) % 60}s`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [finalReport] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('widget').setDescription('Get server widget info'),
    async execute(interaction) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff88').setTitle('Server Widget')
        .addFields({ name: 'Vanity URL', value: interaction.guild.vanityURLCode || 'None', inline: true }, { name: 'Widget', value: interaction.guild.widgetEnabled ? 'Enabled' : 'Disabled', inline: true })], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('top-commands').setDescription('View most used commands').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const top = db.prepare('SELECT command, COUNT(*) as count FROM commands_used WHERE guild_id = ? GROUP BY command ORDER BY count DESC LIMIT 10').all(interaction.guild.id);
      if (!top.length) return interaction.reply({ content: 'No commands used yet.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff88').setTitle('Top Commands')
        .setDescription(top.map((c, i) => `\`${i + 1}.\` **${c.command}** — ${c.count} uses`).join('\n'))], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-reaction-role').setDescription('Create reaction role message')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addRoleOption(o => o.setName('role1').setDescription('Role 1').setRequired(true))
      .addRoleOption(o => o.setName('role2').setDescription('Role 2').setRequired(false))
      .addRoleOption(o => o.setName('role3').setDescription('Role 3').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const roles = [interaction.options.getRole('role1'), interaction.options.getRole('role2'), interaction.options.getRole('role3')].filter(Boolean);
      const emojis = ['1️⃣', '2️⃣', '3️⃣'];
      const msg = await interaction.options.getChannel('channel').send({ embeds: [new EmbedBuilder().setColor('#00ff88').setTitle('Choose your roles!').setDescription(roles.map((r, i) => `${emojis[i]} — ${r}`).join('\n'))] });
      for (let i = 0; i < roles.length; i++) await msg.react(emojis[i]);
      await interaction.reply({ content: 'Reaction role message created!', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('welcome-preview').setDescription('Preview welcome message')
      .addStringOption(o => o.setName('color').setDescription('Color').setRequired(false)),
    async execute(interaction) {
      const color = interaction.options.getString('color') || '#00ff88';
      const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(interaction.guild.id) || {};
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle(`Welcome to ${interaction.guild.name}!`)
        .setDescription(replaceVariables(config.welcome_message || 'Welcome to {server}, {user}!', interaction.member, interaction.guild))
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields({ name: 'Member Count', value: `${interaction.guild.memberCount}`, inline: true }).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-verification').setDescription('Set up member verification with role reward')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send verification message').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to give after verification').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Embed description').setRequired(false))
      .addStringOption(o => o.setName('color').setDescription('Embed color hex').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const title = interaction.options.getString('title') || 'Verify Yourself';
      const desc = interaction.options.getString('description') || 'Click the button below to verify and gain access to the server.';
      const color = interaction.options.getString('color') || '#00ff88';
      const guildId = interaction.guild.id;
      const baseUrl = process.env.DISCORD_CALLBACK_URL ? process.env.DISCORD_CALLBACK_URL.replace('/auth/callback', '') : `http://localhost:${process.env.PORT || 3000}`;
      const verifyUrl = `${baseUrl}/verify/${guildId}/${role.id}`;

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Verify').setURL(verifyUrl).setStyle(ButtonStyle.Link).setEmoji('✅')
      );

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(desc)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `Verification message sent to ${channel}! Role: ${role}`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('verify-stats').setDescription('View verification statistics')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const verified = db.prepare('SELECT COUNT(*) as count FROM verified_users WHERE guild_id = ?').get(interaction.guild.id);
      const total = interaction.guild.memberCount;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Verification Stats')
        .addFields(
          { name: 'Verified', value: `${verified.count}`, inline: true },
          { name: 'Total Members', value: `${total}`, inline: true },
          { name: 'Unverified', value: `${total - verified.count}`, inline: true }
        ).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('msg').setDescription('Send an embed message to a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Embed description').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('Embed color (hex)').setRequired(false))
      .addStringOption(o => o.setName('footer').setDescription('Embed footer').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const message = interaction.options.getString('message');
      const color = interaction.options.getString('color') || '#00ff88';
      const footer = interaction.options.getString('footer');
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(message).setTimestamp();
      if (footer) embed.setFooter({ text: footer });
      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: `Embed sent to ${channel}!`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('say').setDescription('Make the bot say something')
      .addStringOption(o => o.setName('message').setDescription('Message to say').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const message = interaction.options.getString('message');
      await interaction.reply({ content: message });
    }
  },
  {
    data: new SlashCommandBuilder().setName('help').setDescription('List all commands'),
    async execute(interaction) {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#00ff88').setTitle('Nexus Welcomer — Commands')
        .addFields(
          { name: 'Setup', value: '`/setup-welcome` `/setup-goodbye` `/setup-autorole` `/setup-boost` `/setup-logs` `/setup-reaction-role` `/setup-verification`', inline: false },
          { name: 'Control', value: '`/disable-welcome` `/disable-goodbye` `/disable-autorole` `/pause-welcome` `/resume-welcome` `/set-prefix`', inline: false },
          { name: 'Test', value: '`/test-welcome` `/welcome-preview`', inline: false },
          { name: 'Info', value: '`/serverinfo` `/userinfo` `/botinfo` `/stats` `/welcome-logs` `/top-commands`', inline: false },
          { name: 'Management', value: '`/clean-welcomes` `/broadcast` `/migrate-server` `/join-all` `/mass-dm` `/widget` `/msg` `/say`', inline: false },
          { name: 'Fun', value: '`/8ball` `/coinflip` `/dice` `/rps` `/joke` `/poll` `/remind` `/random` `/calc` `/giveaway`', inline: false },
          { name: 'Moderation', value: '`/kick` `/ban` `/unban` `/timeout` `/untimeout` `/purge` `/slowmode` `/lock` `/unlock`', inline: false },
          { name: 'Roles', value: '`/nick` `/role-add` `/role-remove` `/avatar` `/banner`', inline: false },
          { name: 'Leveling', value: '`/level` `/leaderboard`', inline: false }
        ).setTimestamp()], ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // FUN COMMANDS
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball')
      .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
    async execute(interaction) {
      const responses = ['It is certain.','It is decidedly so.','Without a doubt.','Yes - definitely.','You may rely on it.','As I see it, yes.','Most likely.','Outlook good.','Yes.','Signs point to yes.','Reply hazy, try again.','Ask again later.','Better not tell you now.','Cannot predict now.','Concentrate and ask again.','Don\'t count on it.','My reply is no.','My sources say no.','Outlook not so good.','Very doubtful.'];
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8B00FF).setTitle('Magic 8-Ball').addFields({ name: 'Question', value: interaction.options.getString('question') }, { name: 'Answer', value: responses[Math.floor(Math.random() * responses.length)] }).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
    async execute(interaction) {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('Coin Flip').setDescription(`**${result}!** ${result === 'Heads' ? '🪙' : '💰'}`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('dice').setDescription('Roll a dice')
      .addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setMinValue(2).setMaxValue(100)),
    async execute(interaction) {
      const sides = interaction.options.getInteger('sides') || 6;
      const result = Math.floor(Math.random() * sides) + 1;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF6B6B).setTitle('Dice Roll').setDescription(`You rolled a **${result}** (d${sides})`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('rps').setDescription('Rock Paper Scissors')
      .addStringOption(o => o.setName('choice').setDescription('Your choice').setRequired(true).addChoices({ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' })),
    async execute(interaction) {
      const choices = ['rock','paper','scissors'];
      const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
      const player = interaction.options.getString('choice');
      const bot = choices[Math.floor(Math.random() * 3)];
      let result;
      if (player === bot) result = 'tie';
      else if ((player === 'rock' && bot === 'scissors') || (player === 'paper' && bot === 'rock') || (player === 'scissors' && bot === 'paper')) result = 'win';
      else result = 'lose';
      const color = result === 'win' ? 0x57F287 : result === 'tie' ? 0xFEE75C : 0xED4245;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Rock Paper Scissors').setDescription(`You: ${emojis[player]} **${player}**\nBot: ${emojis[bot]} **${bot}**\n\n**${result === 'tie' ? "It's a tie!" : result === 'win' ? 'You win!' : 'Bot wins!'}**`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('joke').setDescription('Get a random joke'),
    async execute(interaction) {
      const jokes = ['Why don\'t scientists trust atoms? Because they make up everything!','Why did the scarecrow win an award? He was outstanding in his field!','What do you call a fake noodle? An impasta!','Why don\'t eggs tell jokes? They\'d crack each other up!','I told my wife she was drawing her eyebrows too high. She looked surprised.','Parallel lines have so much in common. It\'s a shame they\'ll never meet.','Why did the bicycle fall over? Because it was two-tired!','What do you call a bear with no teeth? A gummy bear!','Why don\'t skeletons fight each other? They don\'t have the guts!','What did the ocean say to the beach? Nothing, it just waved.'];
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF69B4).setTitle('Joke').setDescription(jokes[Math.floor(Math.random() * jokes.length)]).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('poll').setDescription('Create a poll')
      .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
      .addStringOption(o => o.setName('options').setDescription('Options separated by commas (max 4)').setRequired(false)),
    async execute(interaction) {
      const question = interaction.options.getString('question');
      const optionsRaw = interaction.options.getString('options');
      const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣'];
      const options = optionsRaw ? optionsRaw.split(',').map(o => o.trim()).slice(0, 4) : ['Yes', 'No'];
      const msg = await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle(`Poll: ${question}`).setDescription(options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n\n')).setFooter({ text: `Poll by ${interaction.user.tag}` }).setTimestamp()], fetchReply: true });
      for (let i = 0; i < options.length; i++) await msg.react(emojis[i]);
    }
  },
  {
    data: new SlashCommandBuilder().setName('remind').setDescription('Set a reminder')
      .addStringOption(o => o.setName('time').setDescription('Time (e.g. 10m, 1h, 1d)').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Reminder message').setRequired(true).setMaxLength(200)),
    async execute(interaction) {
      const timeStr = interaction.options.getString('time');
      const message = interaction.options.getString('message');
      const match = timeStr.match(/^(\d+)(m|h|d)$/);
      if (!match) return interaction.reply({ content: 'Invalid time format. Use: 10m, 2h, 1d', ephemeral: true });
      const ms = parseInt(match[1]) * { m: 60000, h: 3600000, d: 86400000 }[match[2]];
      if (ms < 60000 || ms > 604800000) return interaction.reply({ content: 'Time must be between 1m and 7d.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`⏰ Reminder set for **${timeStr}**!`).setTimestamp()] });
      setTimeout(async () => { try { await (await interaction.user.createDM()).send({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('⏰ Reminder!').setDescription(message).setTimestamp()] }); } catch {} }, ms);
    }
  },
  {
    data: new SlashCommandBuilder().setName('random').setDescription('Generate a random number')
      .addIntegerOption(o => o.setName('min').setDescription('Minimum').setRequired(false))
      .addIntegerOption(o => o.setName('max').setDescription('Maximum').setRequired(false)),
    async execute(interaction) {
      const min = interaction.options.getInteger('min') || 1;
      const max = interaction.options.getInteger('max') || 100;
      if (min >= max) return interaction.reply({ content: 'Min must be less than max.', ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Random Number').setDescription(`Between **${min}** and **${max}**: **${Math.floor(Math.random() * (max - min + 1)) + min}**`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('calc').setDescription('Calculate a math expression')
      .addStringOption(o => o.setName('expression').setDescription('Math expression (e.g. 2+2*3)').setRequired(true)),
    async execute(interaction) {
      const expr = interaction.options.getString('expression');
      if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) return interaction.reply({ content: 'Invalid expression.', ephemeral: true });
      try {
        const result = Function('"use strict"; return (' + expr + ')')();
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Calculator').addFields({ name: 'Expression', value: `\`${expr}\``, inline: true }, { name: 'Result', value: `\`${result}\``, inline: true }).setTimestamp()] });
      } catch { await interaction.reply({ content: 'Invalid expression.', ephemeral: true }); }
    }
  },
  {
    data: new SlashCommandBuilder().setName('giveaway').setDescription('Create a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(10080))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const prize = interaction.options.getString('prize');
      const minutes = interaction.options.getInteger('minutes');
      const winners = interaction.options.getInteger('winners') || 1;
      const endAt = Date.now() + minutes * 60000;
      const msg = await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('Giveaway!').setDescription(`**${prize}**\nReact with \uD83C\uDF89 to enter!\nEnds: <t:${Math.floor(endAt / 1000)}:R>\nWinners: ${winners}`).setFooter({ text: `By ${interaction.user.tag}` }).setTimestamp()] }, { fetchReply: true });
      await msg.react('🎉');
      setTimeout(async () => {
        try {
          const fetched = await interaction.channel.messages.fetch(msg.id);
          const reacted = fetched.reactions.cache.get('🎉').users.cache.filter(u => !u.bot);
          const pool = reacted.map(u => u);
          const winnerCount = Math.min(winners, pool.length);
          const chosen = pool.sort(() => 0.5 - Math.random()).slice(0, winnerCount);
          await interaction.followUp({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('🎉 Giveaway Ended!').setDescription(`**${prize}**\n${chosen.length ? chosen.map(u => `${u}`).join(', ') : 'No entries!'}`).setTimestamp()] });
        } catch { await interaction.followUp('Giveaway ended but could not fetch reactions.').catch(() => {}); }
      }, minutes * 60000);
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // MODERATION COMMANDS
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
      .addUserOption(o => o.setName('target').setDescription('Member to kick').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('target');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
      if (!member.kickable) return interaction.reply({ content: 'Cannot kick this user.', ephemeral: true });
      const reason = interaction.options.getString('reason') || 'No reason';
      await member.kick(reason);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('Member Kicked').addFields({ name: 'User', value: `${target.tag}`, inline: true }, { name: 'Reason', value: reason, inline: true }).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('ban').setDescription('Ban a member')
      .addUserOption(o => o.setName('target').setDescription('Member to ban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('target');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
      if (!member.bannable) return interaction.reply({ content: 'Cannot ban this user.', ephemeral: true });
      const reason = interaction.options.getString('reason') || 'No reason';
      await member.ban({ reason });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('Member Banned').addFields({ name: 'User', value: `${target.tag}`, inline: true }, { name: 'Reason', value: reason, inline: true }).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID')
      .addStringOption(o => o.setName('userid').setDescription('User ID to unban').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
      const userId = interaction.options.getString('userid');
      try { await interaction.guild.members.unban(userId); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`User <@${userId}> unbanned!`).setTimestamp()] }); }
      catch { await interaction.reply({ content: 'Could not unban that user.', ephemeral: true }); }
    }
  },
  {
    data: new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member')
      .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('target');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
      if (!member.moderatable) return interaction.reply({ content: 'Cannot timeout this user.', ephemeral: true });
      const minutes = interaction.options.getInteger('minutes');
      const reason = interaction.options.getString('reason') || 'No reason';
      await member.timeout(minutes * 60000, reason);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('Member Timed Out').addFields({ name: 'User', value: `${target.tag}`, inline: true }, { name: 'Duration', value: `${minutes}m`, inline: true }).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('untimeout').setDescription('Remove timeout')
      .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
      const target = interaction.options.getUser('target');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
      await member.timeout(null);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`Timeout removed from ${target}`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('purge').setDescription('Delete messages')
      .addIntegerOption(o => o.setName('amount').setDescription('Number of messages').setRequired(true).setMinValue(1).setMaxValue(100))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const amount = interaction.options.getInteger('amount');
      await interaction.deferReply({ ephemeral: true });
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.editReply(`Deleted ${deleted.size} messages.`);
    }
  },
  {
    data: new SlashCommandBuilder().setName('slowmode').setDescription('Set slowmode')
      .addIntegerOption(o => o.setName('seconds').setDescription('Duration (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
      const seconds = interaction.options.getInteger('seconds');
      await interaction.channel.setRateLimitPerUser(seconds);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(seconds > 0 ? `Slowmode set to **${seconds}s**` : 'Slowmode disabled').setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('lock').setDescription('Lock a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`🔒 ${channel} locked`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('unlock').setDescription('Unlock a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`🔓 ${channel} unlocked`).setTimestamp()] });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // ROLE & UTILITY COMMANDS
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('nick').setDescription('Change member nickname')
      .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
      .addStringOption(o => o.setName('nickname').setDescription('New nickname').setRequired(true).setMaxLength(32))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    async execute(interaction) {
      const target = interaction.options.getUser('target');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
      if (!member.manageable) return interaction.reply({ content: 'Cannot change this nickname.', ephemeral: true });
      await member.setNickname(interaction.options.getString('nickname'));
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`Nickname changed for ${target}`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('role-add').setDescription('Add a role to a member')
      .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
      const target = interaction.options.getUser('target');
      const role = interaction.options.getRole('role');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
      if (role.position >= interaction.guild.members.me.roles.highest.position) return interaction.reply({ content: 'Role too high.', ephemeral: true });
      await member.roles.add(role);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`Added ${role} to ${target}`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('role-remove').setDescription('Remove a role from a member')
      .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
      const target = interaction.options.getUser('target');
      const role = interaction.options.getRole('role');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
      await member.roles.remove(role);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`Removed ${role} from ${target}`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('avatar').setDescription('Get user avatar')
      .addUserOption(o => o.setName('target').setDescription('User')),
    async execute(interaction) {
      const user = interaction.options.getUser('target') || interaction.user;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`${user.tag}'s Avatar`).setImage(user.displayAvatarURL({ dynamic: true, size: 1024 })).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('banner').setDescription('Get user banner')
      .addUserOption(o => o.setName('target').setDescription('User')),
    async execute(interaction) {
      const user = interaction.options.getUser('target') || interaction.user;
      const fetched = await interaction.client.users.fetch(user.id, { force: true });
      const banner = fetched.bannerURL({ dynamic: true, size: 1024 });
      if (!banner) return interaction.reply({ content: `${user.tag} has no banner.`, ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`${user.tag}'s Banner`).setImage(banner).setTimestamp()] });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // LEVELING COMMANDS
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('level').setDescription('Check your level')
      .addUserOption(o => o.setName('target').setDescription('User')),
    async execute(interaction) {
      const user = interaction.options.getUser('target') || interaction.user;
      const row = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(interaction.guild.id, user.id);
      if (!row) return interaction.reply({ content: 'No leveling data found for this user.', ephemeral: true });
      const xpNeeded = Math.floor(100 * Math.pow(1.5, row.level));
      const bar = '█'.repeat(Math.min(Math.floor((row.xp / xpNeeded) * 10), 10)) + '░'.repeat(Math.max(10 - Math.floor((row.xp / xpNeeded) * 10), 0));
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle(`${user.tag}'s Level`).setThumbnail(user.displayAvatarURL({ dynamic: true })).addFields({ name: 'Level', value: `${row.level}`, inline: true }, { name: 'XP', value: `${row.xp}/${xpNeeded}`, inline: true }, { name: 'Messages', value: `${row.messages}`, inline: true }, { name: 'Progress', value: `\`${bar}\`` }).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('leaderboard').setDescription('Server XP leaderboard'),
    async execute(interaction) {
      const rows = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10').all(interaction.guild.id);
      if (!rows.length) return interaction.reply({ content: 'No leveling data yet.', ephemeral: true });
      const medals = ['🥇','🥈','🥉'];
      const desc = rows.map((r, i) => `${medals[i] || `**${i+1}.**`} <@${r.user_id}> — Level **${r.level}** (${r.xp} XP)`).join('\n');
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('Leaderboard').setDescription(desc).setTimestamp()] });
    }
  }
];

function formatUptime(ms) {
  const s = Math.floor((ms / 1000) % 60), m = Math.floor((ms / 1000 / 60) % 60), h = Math.floor((ms / 1000 / 60 / 60) % 24), d = Math.floor(ms / 1000 / 60 / 60 / 24);
  return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = commands;
