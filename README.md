# Ultimate Welcomer Bot with 3D Animated Dashboard

A feature-rich Discord welcomer bot with an animated 3D dashboard, moderation, leveling, tickets, reaction roles, and more.

## Features

- **Welcome System** - Custom welcome messages with images, embeds, and auto roles
- **Goodbye System** - Custom goodbye messages when members leave
- **Moderation** - Kick, ban, mute, warn, and audit logging
- **Leveling** - XP-based leveling with leaderboards
- **Tickets** - Support ticket system with one-click creation
- **Reaction Roles** - Easy reaction role setup
- **Giveaways** - Built-in giveaway system
- **Polls** - Interactive polls
- **Tags** - Custom command tags
- **Reminders** - Set reminders
- **Fun Commands** - 8ball, dice, coinflip, memes
- **Utilities** - Weather, calculator, avatar, banner
- **3D Dashboard** - Animated dashboard with live stats
- **OAuth2 Login** - Discord authentication

## Setup

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to Bot tab and create a bot
4. Enable all Privileged Gateway Intents:
   - PRESENCE INTENT
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
5. Copy the bot token

### 2. Create OAuth2 Application

1. Go to OAuth2 tab
2. Copy Client ID and Client Secret
3. Add redirect URL: `http://localhost:3000/auth/callback`

### 3. Invite Bot

Use this URL (replace CLIENT_ID):
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

### 4. Configure Environment

Copy `.env.example` to `.env` and fill in your values:
```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
CALLBACK_URL=http://localhost:3000/auth/callback
DASHBOARD_URL=http://localhost:3000
OWNER_ID=your_discord_user_id
```

### 5. Install and Run

```bash
npm install
npm run dev
```

### 6. Deploy Commands

```bash
npm run deploy-commands
```

## Deploy to Render

1. Push to GitHub
2. Connect to Render
3. Use `render.yaml` for auto-configuration
4. Set environment variables in Render dashboard

## Commands

| Command | Description | Category |
|---------|-------------|----------|
| !help | Show all commands | General |
| !setwelcome | Configure welcome | Configuration |
| !setgoodbye | Configure goodbye | Configuration |
| !autorole | Set auto role | Configuration |
| !kick | Kick member | Moderation |
| !ban | Ban member | Moderation |
| !mute | Timeout member | Moderation |
| !unmute | Remove timeout | Moderation |
| !warn | Warn member | Moderation |
| !warnings | View warnings | Moderation |
| !ticket | Ticket system | Tickets |
| !reactionrole | Reaction roles | Configuration |
| !giveaway | Create giveaway | Fun |
| !poll | Create poll | Utility |
| !level | View level | Leveling |
| !leaderboard | XP leaderboard | Leveling |
| !tag | Custom tags | Utility |
| !embed | Create embed | Utility |
| !remind | Set reminder | Utility |
| !avatar | User avatar | Utility |
| !banner | User banner | Utility |
| !serverinfo | Server info | Information |
| !userinfo | User info | Information |
| !botinfo | Bot info | Information |
| !ping | Latency | Information |
| !uptime | Bot uptime | Information |
| !8ball | Magic 8ball | Fun |
| !flip | Coin flip | Fun |
| !dice | Roll dice | Fun |
| !meme | Random meme | Fun |
| !weather | Weather info | Utility |
| !calc | Calculator | Utility |

## License

MIT
