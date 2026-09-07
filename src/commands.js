const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../utils/database');
const { replaceVariables } = require('../utils/helpers');

const commands = [
  // ═══════════════════════════════════════════════════════════════
  // WELCOME SYSTEM COMMANDS
  // ═══════════════════════════════════════════════════════════════
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
  // ═══════════════════════════════════════════════════════════════
  // OWNER ONLY COMMANDS
  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // UTILITY COMMANDS
  // ═══════════════════════════════════════════════════════════════
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
    data: new SlashCommandBuilder().setName('msg').setDescription('Send an embed message in this channel')
      .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Embed description').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('Embed color (hex)').setRequired(false))
      .addStringOption(o => o.setName('footer').setDescription('Embed footer').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
      const title = interaction.options.getString('title');
      const message = interaction.options.getString('message');
      const color = interaction.options.getString('color') || '#00ff88';
      const footer = interaction.options.getString('footer');
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(message).setTimestamp();
      if (footer) embed.setFooter({ text: footer });
      await interaction.channel.send({ embeds: [embed] });
      await interaction.reply({ content: 'Embed sent!', ephemeral: true });
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
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('Coin Flip').setDescription(`**${result}!**`).setTimestamp()] });
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
      const botChoice = choices[Math.floor(Math.random() * 3)];
      let result;
      if (player === botChoice) result = 'tie';
      else if ((player === 'rock' && botChoice === 'scissors') || (player === 'paper' && botChoice === 'rock') || (player === 'scissors' && botChoice === 'paper')) result = 'win';
      else result = 'lose';
      const color = result === 'win' ? 0x57F287 : result === 'tie' ? 0xFEE75C : 0xED4245;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Rock Paper Scissors').setDescription(`You: ${emojis[player]} **${player}**\nBot: ${emojis[botChoice]} **${botChoice}**\n\n**${result === 'tie' ? "It's a tie!" : result === 'win' ? 'You win!' : 'Bot wins!'}**`).setTimestamp()] });
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
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`Reminder set for **${timeStr}**!`).setTimestamp()] });
      setTimeout(async () => { try { await (await interaction.user.createDM()).send({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('Reminder!').setDescription(message).setTimestamp()] }); } catch {} }, ms);
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
        const safeExpr = expr.replace(/[^0-9+\-*/().%\s]/g, '');
        const result = Function('"use strict"; return (' + safeExpr + ')')();
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
      const msg = await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('Giveaway!').setDescription(`**${prize}**\nReact with 🎉 to enter!\nEnds: <t:${Math.floor(endAt / 1000)}:R>\nWinners: ${winners}`).setFooter({ text: `By ${interaction.user.tag}` }).setTimestamp()] }, { fetchReply: true });
      await msg.react('🎉');
      setTimeout(async () => {
        try {
          const fetched = await interaction.channel.messages.fetch(msg.id);
          const reacted = fetched.reactions.cache.get('🎉').users.cache.filter(u => !u.bot);
          const pool = reacted.map(u => u);
          const winnerCount = Math.min(winners, pool.length);
          const chosen = pool.sort(() => 0.5 - Math.random()).slice(0, winnerCount);
          await interaction.followUp({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle('Giveaway Ended!').setDescription(`**${prize}**\n${chosen.length ? chosen.map(u => `${u}`).join(', ') : 'No entries!'}`).setTimestamp()] });
        } catch { await interaction.followUp('Giveaway ended but could not fetch reactions.').catch(() => {}); }
      }, minutes * 60000);
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // MODERATION (unique to src)
  // ═══════════════════════════════════════════════════════════════
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
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('Member Timed Out').addFields({ name: 'User', value: `${target.tag}`, inline: true }, { name: 'Duration', value: `${minutes}m`, inline: true }, { name: 'Reason', value: reason, inline: true }).setTimestamp()] });
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
  // ═══════════════════════════════════════════════════════════════
  // SERVER PROTECTION COMMANDS
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('setup-antiraid').setDescription('Configure anti-raid protection')
      .addIntegerOption(o => o.setName('threshold').setDescription('Joins before trigger (default 5)').setMinValue(2).setMaxValue(50))
      .addIntegerOption(o => o.setName('window').setDescription('Time window in seconds (default 30)').setMinValue(10).setMaxValue(120))
      .addStringOption(o => o.setName('action').setDescription('Action against raiders')
        .addChoices({ name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }, { name: 'Timeout', value: 'timeout' }, { name: 'Lockdown Server', value: 'lockdown' }))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const threshold = interaction.options.getInteger('threshold') || 5;
      const window = interaction.options.getInteger('window') || 30;
      const action = interaction.options.getString('action') || 'kick';
      db.prepare("UPDATE guilds SET anti_raid_enabled = 1, raid_threshold = ?, raid_window = ?, raid_action = ?, updated_at = datetime('now') WHERE guild_id = ?")
        .run(threshold, window, action, interaction.guild.id);
      const embed = new EmbedBuilder().setColor(0x57F287).setTitle('Anti-Raid Enabled')
        .setDescription('Protection against mass joins activated')
        .addFields(
          { name: 'Threshold', value: `${threshold} joins`, inline: true },
          { name: 'Window', value: `${window}s`, inline: true },
          { name: 'Action', value: action, inline: true }
        ).setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-antiraid').setDescription('Disable anti-raid protection')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_raid_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Anti-raid protection disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-antispam').setDescription('Configure anti-spam protection')
      .addIntegerOption(o => o.setName('threshold').setDescription('Messages before action (default 5)').setMinValue(3).setMaxValue(20))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const threshold = interaction.options.getInteger('threshold') || 5;
      db.prepare("UPDATE guilds SET anti_spam_enabled = 1, spam_threshold = ?, updated_at = datetime('now') WHERE guild_id = ?")
        .run(threshold, interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Anti-Spam Enabled')
        .setDescription(`Members sending ${threshold}+ similar messages in 5s will be timed out`)
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-antispam').setDescription('Disable anti-spam')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_spam_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Anti-spam disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-badwords').setDescription('Configure bad words filter')
      .addStringOption(o => o.setName('words').setDescription('Comma-separated bad words').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const words = interaction.options.getString('words');
      db.prepare("UPDATE guilds SET anti_badwords_enabled = 1, bad_words = ?, updated_at = datetime('now') WHERE guild_id = ?")
        .run(words.toLowerCase(), interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Bad Words Filter Enabled')
        .setDescription(`Filtering ${words.split(',').length} words/phrases`)
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-badwords').setDescription('Disable bad words filter')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_badwords_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Bad words filter disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-caps').setDescription('Configure caps filter')
      .addIntegerOption(o => o.setName('threshold').setDescription('Caps percentage (default 70)').setMinValue(50).setMaxValue(95))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const threshold = interaction.options.getInteger('threshold') || 70;
      db.prepare("UPDATE guilds SET anti_caps_enabled = 1, caps_threshold = ?, updated_at = datetime('now') WHERE guild_id = ?")
        .run(threshold, interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Caps Filter Enabled')
        .setDescription(`Messages with ${threshold}%+ caps will be deleted`)
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-caps').setDescription('Disable caps filter')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_caps_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Caps filter disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-linkfilter').setDescription('Configure link filter')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_links_enabled = 1, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Link Filter Enabled')
        .setDescription('Unauthorized links will be deleted. Staff with Manage Messages permission are exempt.')
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-linkfilter').setDescription('Disable link filter')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_links_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Link filter disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-antinuke').setDescription('Configure anti-nuke protection (auto-lockdown on mass deletes)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_nuke_enabled = 1, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Anti-Nuke Enabled')
        .setDescription('Server will auto-lockdown if 3+ channels or roles are deleted within 10 seconds')
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-antinuke').setDescription('Disable anti-nuke')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_nuke_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Anti-nuke disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-mention-limit').setDescription('Limit mass mentions')
      .addIntegerOption(o => o.setName('threshold').setDescription('Max mentions allowed (default 5)').setMinValue(1).setMaxValue(20))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const threshold = interaction.options.getInteger('threshold') || 5;
      db.prepare("UPDATE guilds SET anti_mass_mention_enabled = 1, mass_mention_threshold = ?, updated_at = datetime('now') WHERE guild_id = ?")
        .run(threshold, interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Mention Limit Set')
        .setDescription(`Messages with ${threshold}+ mentions will be deleted`)
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-mention-limit').setDescription('Disable mention limit')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET anti_mass_mention_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Mention limit disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-auditlog').setDescription('Enable audit log monitoring')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog))
        return interaction.reply({ content: 'I need View Audit Log permission.', ephemeral: true });
      db.prepare("UPDATE guilds SET audit_log_enabled = 1, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Audit Log Monitoring Enabled')
        .setDescription('Suspicious activity will be logged to your log channel')
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('disable-auditlog').setDescription('Disable audit log monitoring')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare("UPDATE guilds SET audit_log_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ content: 'Audit log monitoring disabled.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('server-lockdown').setDescription('Emergency lockdown - disable all messages in the server')
      .addStringOption(o => o.setName('reason').setDescription('Reason for lockdown'))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const reason = interaction.options.getString('reason') || `Locked by ${interaction.user.tag}`;
      for (const [, channel] of interaction.guild.channels.cache) {
        if (channel.type === ChannelType.GuildText) {
          try {
            await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false, AddReactions: false }, reason);
          } catch {}
        }
      }
      db.prepare("UPDATE guilds SET lockdown_enabled = 1, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      const embed = new EmbedBuilder().setColor(0xED4245).setTitle('SERVER LOCKED DOWN')
        .setDescription(reason).setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('server-unlock').setDescription('Unlock the entire server')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      for (const [, channel] of interaction.guild.channels.cache) {
        if (channel.type === ChannelType.GuildText) {
          try {
            await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: true, AddReactions: true }, `Unlocked by ${interaction.user.tag}`);
          } catch {}
        }
      }
      db.prepare("UPDATE guilds SET lockdown_enabled = 0, updated_at = datetime('now') WHERE guild_id = ?").run(interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Server Unlocked').setDescription(`${interaction.user} unlocked the server`).setTimestamp()] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('set-punish').setDescription('Set auto-punish type')
      .addStringOption(o => o.setName('type').setDescription('Punishment type').setRequired(true)
        .addChoices({ name: 'Timeout (1 hour)', value: 'timeout' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }, { name: 'Mute Role', value: 'mute' }))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const type = interaction.options.getString('type');
      db.prepare("UPDATE guilds SET auto_punish = ?, updated_at = datetime('now') WHERE guild_id = ?").run(type, interaction.guild.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Auto-Punish Set')
        .setDescription(`Auto-punishment type: **${type}**`).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('protection-status').setDescription('View all protection settings'),
    async execute(interaction) {
      const config = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(interaction.guild.id) || {};
      const bool = v => v ? '✅ Enabled' : '❌ Disabled';
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('Protection Status')
        .addFields(
          { name: 'Anti-Raid', value: bool(config.anti_raid_enabled), inline: true },
          { name: '  Threshold', value: `${config.raid_threshold || 5} joins / ${config.raid_window || 30}s`, inline: true },
          { name: '  Action', value: config.raid_action || 'kick', inline: true },
          { name: 'Anti-Spam', value: bool(config.anti_spam_enabled), inline: true },
          { name: '  Threshold', value: `${config.spam_threshold || 5} msgs`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: 'Bad Words', value: bool(config.anti_badwords_enabled), inline: true },
          { name: '  Words', value: config.bad_words ? `${config.bad_words.split(',').length} configured` : 'None', inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: 'Caps Filter', value: bool(config.anti_caps_enabled), inline: true },
          { name: '  Threshold', value: `${config.caps_threshold || 70}%`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: 'Link Filter', value: bool(config.anti_links_enabled), inline: true },
          { name: 'Anti-Nuke', value: bool(config.anti_nuke_enabled), inline: true },
          { name: 'Mention Limit', value: bool(config.anti_mass_mention_enabled), inline: true },
          { name: 'Audit Log', value: bool(config.audit_log_enabled), inline: true },
          { name: 'Auto-Punish', value: config.auto_punish || 'timeout', inline: true },
          { name: 'Lockdown', value: bool(config.lockdown_enabled), inline: true }
        ).setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('setup-all-protections').setDescription('Enable all protection features at once')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      db.prepare(`UPDATE guilds SET
        anti_raid_enabled = 1, anti_spam_enabled = 1, anti_badwords_enabled = 1,
        anti_caps_enabled = 1, anti_links_enabled = 1, anti_nuke_enabled = 1,
        anti_mass_mention_enabled = 1, audit_log_enabled = 1,
        updated_at = datetime('now') WHERE guild_id = ?`).run(interaction.guild.id);
      const embed = new EmbedBuilder().setColor(0x57F287).setTitle('ALL PROTECTIONS ENABLED')
        .setDescription('The following protections are now active:')
        .addFields(
          { name: 'Anti-Raid', value: 'Mass join detection', inline: true },
          { name: 'Anti-Spam', value: 'Spam message detection', inline: true },
          { name: 'Bad Words', value: 'Profanity filter', inline: true },
          { name: 'Caps Filter', value: 'Excessive caps filter', inline: true },
          { name: 'Link Filter', value: 'Unauthorized link filter', inline: true },
          { name: 'Anti-Nuke', value: 'Mass deletion protection', inline: true },
          { name: 'Mention Limit', value: 'Mass mention protection', inline: true },
          { name: 'Audit Log', value: 'Activity monitoring', inline: true }
        )
        .setFooter({ text: 'Configure individual settings with their respective commands' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  // ═══════════════════════════════════════════════════════════════
  // WHITELIST COMMANDS (Owner Only)
  // ═══════════════════════════════════════════════════════════════
  {
    data: new SlashCommandBuilder().setName('whitelist-add').setDescription('Add a server to the whitelist')
      .addStringOption(o => o.setName('guild-id').setDescription('Server ID to whitelist').setRequired(true)),
    async execute(interaction) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }
      const guildId = interaction.options.getString('guild-id');
      const guild = interaction.client.guilds.cache.get(guildId);
      if (!guild) return interaction.reply({ content: 'Bot is not in that server.', ephemeral: true });

      const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
      if (existing) return interaction.reply({ content: 'Server is already whitelisted.', ephemeral: true });

      db.prepare('INSERT INTO whitelisted_servers (guild_id, guild_name, added_by, added_at, is_active) VALUES (?, ?, ?, datetime(\'now\'), 1)')
        .run(guildId, guild.name, interaction.user.id);

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Server Whitelisted')
        .setDescription(`**${guild.name}** has been added to the whitelist.`)
        .addFields({ name: 'Server ID', value: guildId, inline: true }, { name: 'Members', value: `${guild.memberCount}`, inline: true })
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('whitelist-remove').setDescription('Remove a server from the whitelist')
      .addStringOption(o => o.setName('guild-id').setDescription('Server ID to remove').setRequired(true)),
    async execute(interaction) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }
      const guildId = interaction.options.getString('guild-id');
      const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
      if (!existing) return interaction.reply({ content: 'Server is not whitelisted.', ephemeral: true });

      db.prepare('DELETE FROM whitelisted_servers WHERE guild_id = ?').run(guildId);

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('Server Removed')
        .setDescription(`**${existing.guild_name}** has been removed from the whitelist.`)
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('whitelist-list').setDescription('View all whitelisted servers'),
    async execute(interaction) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }
      const servers = db.prepare('SELECT * FROM whitelisted_servers ORDER BY added_at DESC').all();
      if (!servers.length) return interaction.reply({ content: 'No servers whitelisted.', ephemeral: true });

      const desc = servers.map((s, i) => {
        const online = interaction.client.guilds.cache.has(s.guild_id);
        return `\`${i + 1}.\` **${s.guild_name}** (${s.guild_id}) — ${online ? '🟢 Online' : '🔴 Offline'} — ${s.is_active ? '✅ Active' : '❌ Disabled'}`;
      }).join('\n');

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('Whitelisted Servers')
        .setDescription(desc).setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('whitelist-toggle').setDescription('Toggle a whitelisted server on/off')
      .addStringOption(o => o.setName('guild-id').setDescription('Server ID').setRequired(true)),
    async execute(interaction) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }
      const guildId = interaction.options.getString('guild-id');
      const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
      if (!existing) return interaction.reply({ content: 'Server is not whitelisted.', ephemeral: true });

      const newStatus = existing.is_active ? 0 : 1;
      db.prepare('UPDATE whitelisted_servers SET is_active = ? WHERE guild_id = ?').run(newStatus, guildId);

      await interaction.reply({ embeds: [new EmbedBuilder().setColor(newStatus ? 0x57F287 : 0xFEE75C)
        .setTitle('Whitelist Updated')
        .setDescription(`**${existing.guild_name}** is now ${newStatus ? 'enabled' : 'disabled'}.`)
        .setTimestamp()], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder().setName('whitelist-check').setDescription('Check if a server is whitelisted')
      .addStringOption(o => o.setName('guild-id').setDescription('Server ID to check').setRequired(true)),
    async execute(interaction) {
      if (interaction.user.id !== process.env.BOT_OWNER_ID) {
        return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      }
      const guildId = interaction.options.getString('guild-id');
      const existing = db.prepare('SELECT * FROM whitelisted_servers WHERE guild_id = ?').get(guildId);
      const guild = interaction.client.guilds.cache.get(guildId);

      if (existing) {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('Whitelist Check')
          .setDescription(`**${existing.guild_name}** is whitelisted.`)
          .addFields(
            { name: 'Status', value: existing.is_active ? '✅ Active' : '❌ Disabled', inline: true },
            { name: 'Bot Online', value: guild ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Added', value: `<t:${Math.floor(new Date(existing.added_at).getTime() / 1000)}:R>`, inline: true }
          ).setTimestamp()], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('Not Whitelisted')
          .setDescription(`Server \`${guildId}\` is not in the whitelist.`)
          .setTimestamp()], ephemeral: true });
      }
    }
  }
];

module.exports = commands;
