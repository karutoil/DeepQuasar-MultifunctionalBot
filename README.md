# DeepQuasar Multi-Functional Discord Bot

A powerful Discord bot featuring music playback, moderation, ticketing, AI chat, reaction roles, embeds, and more. This bot is built with Discord.js and designed to be feature-rich, customizable, and easy to use.

## About This Bot

DeepQuasar is a comprehensive Discord bot solution that combines multiple functionalities into a single bot, reducing the need for multiple specialized bots in your server. This bot was created with the assistance of advanced AI models including DeepSeek, ChatGPT 4.1, and Claude 3.7 Sonnet.

## Features

- 🎵 **Music System**: Full-featured music player with YouTube support, queue management, and DJ roles
- 🎫 **Ticket System**: Support ticket creation with customizable categories and staff roles
- 🎭 **Reaction Roles**: Create self-assign role messages with reactions
- 👋 **Welcome & Leave**: Customizable welcome messages for new members and goodbye messages
- 🛡️ **Moderation Logs**: Comprehensive logging of server events and admin actions
- 🤖 **AI Chatbot**: Connect to local AI models for chatbot functionality in specified channels
- 📝 **Embed Creator**: Create and edit custom embeds with an interactive builder
- 🧹 **Cleanup Tools**: Message purging with various filters
- 👥 **Auto Role**: Automatically assign roles to new members
- 🏆 **Invite Tracking**: Track and display invite leaderboards
- 🔔 **Update Notifier**: Get notifications about bot updates automatically
- 🔄 **Automatic Version Increment**: Patch version automatically increments with each commit

## Installation & Setup

There are multiple ways to deploy DeepQuasar based on your preferences and technical requirements:

### [🖥️ Local Deployment (Node.js)](./docs/local_deployment.md)
Deploy the bot directly on your host machine with Node.js.

### [🏗️ Local Docker Build](./docs/docker_build.md)
Build and run the Docker container locally from source.

### [☁️ Docker Hub Image](./docs/docker_hub.md)
Deploy using our pre-built Docker image from Docker Hub.

## Command Documentation

### 🎵 Music

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/join` | Join your voice channel | None |
| `/play <query>` | Play a song from YouTube | None |
| `/pause` | Pause playback | DJ/Admin |
| `/resume` | Resume playback | DJ/Admin |
| `/stop` | Stop playback and clear the queue | DJ/Admin |
| `/skip` | Skip the current song | DJ/Admin |
| `/queue` | Show the current queue | None |
| `/nowplaying` | Show the currently playing track | None |
| `/volume [level]` | Set or show playback volume (0-200%) | DJ/Admin |
| `/seek <seconds>` | Seek to a position in the current track | DJ/Admin |
| `/move <from_pos> <to_pos>` | Move a track in the queue | DJ/Admin |
| `/remove <position>` | Remove a track from the queue by position | DJ/Admin |
| `/clear` | Clear the entire queue | DJ/Admin |
| `/shuffle` | Shuffle the queue | DJ/Admin |
| `/loop` | Toggle looping the current track | DJ/Admin |
| `/replay` | Replay the current track from the beginning | DJ/Admin |
| `/history` | Show recently played tracks | None |
| `/autoplay` | Toggle autoplay related tracks | DJ/Admin |
| `/setdj <role>` | Set the DJ role | Admin |
| `/cleardj` | Clear the DJ role | Admin |
| `/search <query> [type]` | Search for songs or playlists to play | None |
| `/resetmusic [confirm]` | Reset music system if having issues with playlists or songs | Admin |

### 🎫 Ticket System

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/tickets setup <open_category> <archive_category> <support_role> <log_channel>` | Configure ticket system categories, roles, logs | Admin |
| `/tickets panel <channel> <title> <description>` | Send the ticket creation panel | Admin |
| `/tickets add <user>` | Add a user to the current ticket | Admin |
| `/tickets remove <user>` | Remove a user from the current ticket | Admin |

### 🎭 Reaction Roles

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/reactionroles create <title> [color]` | Start creating a reaction role message | Admin |
| `/reactionroles add <emoji> <role> [description]` | Add a role to the current reaction role message | Admin |
| `/reactionroles finish` | Post the reaction role message | Admin |
| `/reactionroles edit <message_id>` | Add more roles to an existing reaction role message | Admin |
| `/reactionroles remove <message_id> <emoji>` | Remove a reaction role from a message | Admin |

### 👋 Welcome & Leave

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/welcome setwelcome <channel>` | Set the welcome message channel | Admin |
| `/welcome setleave <channel>` | Set the leave message channel | Admin |

### 🛡️ Moderation & Logging

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/modlog setchannel <channel>` | Set the channel for logging server events | Manage Guild |
| `/modlog toggle <event> <enabled>` | Enable or disable a specific log event | Manage Guild |
| `/modlog toggleall` | Enable or disable all moderation log events | Manage Guild |

### 🤖 AI Chatbot

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/chatbot configure <api_base> [api_key] [model_name]` | Configure your local AI endpoint | Administrator |
| `/chatbot prompt [prompt]` | Set or clear a custom system prompt | Administrator |
| `/chatbot toggle <enabled>` | Enable or disable AI responses | Administrator |
| `/chatbot channel <channel> <add/remove>` | Add or remove a whitelisted channel | Administrator |
| `/chatbot listchannels` | List all whitelisted channels | Administrator |
| `/chatbot chance <chance>` | Set AI response chance percentage (0-100) | Administrator |
| `/chatbot test <message>` | Test your AI connection with a message | Administrator |

### 📝 Embed Creator

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/embed create <json_input> [channel]` | Create an embed from JSON | Manage Messages |
| `/embed edit <message_id> <new_json> [content]` | Edit an existing embed by message ID | Manage Messages |
| `/embed get <message_id>` | Get the JSON of an existing embed | Manage Messages |
| `/embed builder` | Interactively build an embed with buttons | Manage Messages |
| `/embed template-save <message_id> <template_name>` | Save an embed as a template | Manage Messages |
| `/embed template-list` | List all available embed templates | Manage Messages |
| `/embed template-load <template_name>` | Load an embed template | Manage Messages |
| `/embed template-delete <template_name>` | Delete an embed template | Manage Messages |

### 🧹 Cleanup

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/cleanup messages <amount>` | Delete the last X messages in this channel | Manage Messages |
| `/cleanup all` | Delete all messages in this channel | Manage Messages |
| `/cleanup user <user> <amount>` | Delete a number of messages from a specific user | Manage Messages |

### 👥 Auto Role

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/autorole set <role>` | Set role for new members | Administrator |
| `/autorole remove` | Remove auto-role | Administrator |
| `/autorole status` | Check auto-role status | Administrator |

### 🏆 Invites

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/invites leaderboard` | Show the top invites leaderboard | None |

### 🔔 Update Notifier

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/updatenotifier status` | Check update notifier status | Administrator |
| `/updatenotifier enable` | Enable update notifications | Administrator |
| `/updatenotifier disable` | Disable update notifications | Administrator |
| `/updatenotifier setowner [user]` | Set user to receive update notifications | Administrator |
| `/updatenotifier settoken [token]` | Set GitHub API token for higher rate limits | Administrator |
| `/updatenotifier check` | Check for updates manually | Administrator |

## Environment Variables

The bot uses a `.env` file for configuration. Copy `.env.example` to `.env` and set the following variables:

```
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here_for_dev_mode  # Optional: for development only

# MongoDB Configuration
MONGODB_URI=mongodb://mongodb:27017/musicbot

# Lavalink Configuration
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false

# YouTube OAuth Configuration for Lavalink
YOUTUBE_REFRESH_TOKEN=your_youtube_refresh_token  # Optional: for YouTube features

# LocalAI Configuration (if using LocalAI)
LOCALAI_ENDPOINT=http://localhost:1234
LOCALAI_API_KEY=your_localai_api_key  # Optional: if your LocalAI instance requires authentication
LOCALAI_MODEL=your_model_name

# Update Notifier
GITHUB_API_TOKEN=your_github_token  # Optional: for higher API rate limits
```

## Git Hooks

This project uses Git hooks to automatically increment the version number with each commit. When you clone this repository, you'll need to set up the hooks:

```bash
# Tell Git to use the hooks in the .githooks directory
git config core.hooksPath .githooks
```

The hooks include:
- **pre-commit**: Automatically increments the patch version in package.json before each commit
- **post-commit**: Cleans up temporary files used by the version increment process

For more details about the automatic version increment system, see [docs/version-increment.md](docs/version-increment.md).

## Credits

This bot was created with the assistance of:
- DeepSeek V3
- ChatGPT 4.1
- Claude 3.7 Sonnet

Maintained by the DeepQuasar team.

## License

This project is licensed under the MIT License.