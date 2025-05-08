# DeepQuasar Multi-Functional Discord Bot

A powerful Discord bot featuring music playback, moderation, ticketing, AI chat, reaction roles, embeds, and more.

---

## How to Use

The recommended way to run this bot is via Docker. No manual setup or dependencies required.

**Docker Hub Repository:**  
[https://hub.docker.com/r/karutoil/deepquasar-multifunctionalbot](https://hub.docker.com/r/karutoil/deepquasar-multifunctionalbot)

### Quick Start with Docker Compose

#### ⚡️ MongoDB Requirement

This bot now requires a running MongoDB instance. You must provide a valid MongoDB connection URI via the `MONGODB_URI` environment variable. The default Docker Compose setup will automatically provision a MongoDB container and set the correct URI.

> **See: [MongoDB Setup & Migration Instructions](./mongodb_setup_instructions.md)**

1. **Copy the provided `.env.example` file to `.env` and fill in your Discord bot token and any other environment variables:**

```
cp .env.example .env
# Then edit .env and set:
# DISCORD_TOKEN=your-bot-token-here
# MONGODB_URI=mongodb://mongodb:27017/musicbot
```

2. **Use the included `docker-compose.yml` file in the repository.** It is pre-configured to run both the bot and MongoDB containers.

3. **Start the bot with Docker Compose:**

```bash
docker-compose up -d
```

This will pull the latest image, create the containers, and start your bot automatically.

---

### Lavalink YouTube OAuth Setup

If you want to enable YouTube OAuth for Lavalink (recommended for better playback and bypassing restrictions), follow this guide:

[How to Obtain a YouTube OAuth Refresh Token for Lavalink](./lavalink_oauth_setup.md)

---

## Bot Commands

### 🎵 Music

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/join` | Join your voice channel | None |
| `/play <query>` | Play a song from YouTube | None |
| `/pause` | Pause playback | None |
| `/resume` | Resume playback | None |
| `/stop` | Stop playback and clear the queue | None |
| `/skip` | Skip the current song | None |
| `/queue` | Show the current queue | None |
| `/nowplaying` | Show the currently playing song | None |
| `/volume [level]` | Set or show playback volume (0-200%) | None |
| `/seek <seconds>` | Seek to a position in the current song | None |
| `/move <from> <to>` | Move a song in the queue | None |
| `/remove <position>` | Remove a song from the queue | None |
| `/clear` | Clear the entire queue | None |
| `/shuffle` | Shuffle the queue | None |
| `/loop` | Toggle looping the current song | None |
| `/replay` | Replay the current song | None |
| `/history` | Show recently played songs | None |
| `/autoplay` | Toggle autoplay related songs | None |
| `/setdj <role>` | Set the DJ role | Admin |
| `/cleardj` | Clear the DJ role | Admin |

---

### 🎫 Ticket System

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/tickets setup <ticket_category> <archive_category> <support_roles> <log_channel>` | Configure ticket system categories, roles, logs | Admin |
| `/tickets panel <channel> <title> <description>` | Send the ticket creation panel | Admin |

---

### 🎭 Reaction Roles

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/reactionroles create <title> [color]` | Start creating a reaction role message | Admin |
| `/reactionroles add <emoji> <role> [description]` | Add a role to the current reaction role message | Admin |
| `/reactionroles finish` | Post the reaction role message | Admin |
| `/reactionroles edit <message_id>` | Add more roles to an existing reaction role message | Admin |
| `/reactionroles remove <message_id> <emoji>` | Remove a reaction role from a message | Admin |

---

### 👋 Welcome & Leave

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/welcome setwelcome <channel>` | Set the welcome message channel | Admin |
| `/welcome setleave <channel>` | Set the leave message channel | Admin |

---

### 🛡️ Moderation & Logging

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/modlog setchannel <channel>` | Set the moderation log channel | Admin |
| `/modlog toggle <event>` | Enable or disable a specific log event | Admin |
| `/modlog toggleall` | Enable or disable all moderation log events | Admin |

---

### 🤖 AI Chatbot

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/chatbot configure <api_base> [api_key] [model_name]` | Configure your local AI endpoint | Admin |
| `/chatbot prompt [prompt]` | Set or clear a custom system prompt | Admin |
| `/chatbot toggle <enabled>` | Enable or disable AI responses | Admin |
| `/chatbot channel <channel> <add/remove>` | Add or remove a whitelisted channel | Admin |
| `/chatbot listchannels` | List all whitelisted channels | None |
| `/chatbot chance <chance>` | Set AI response chance percentage (0-100) | Admin |

---

### 📝 Embed Creator

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/embed create <json_input> [channel]` | Create an embed from JSON | Manage Messages |
| `/embed edit <message_id> <new_json>` | Edit an existing embed by message ID | Manage Messages |
| `/embed get <message_id>` | Get the JSON of an existing embed | Manage Messages |
| `/embed builder` | Interactively build an embed with buttons | Manage Messages |

---

### 🧹 Cleanup

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/cleanup messages <amount>` | Delete the last X messages in this channel | Manage Messages |
| `/cleanup all` | Delete all messages in this channel | Manage Messages |
| `/cleanup user <user> <amount>` | Delete a number of messages from a specific user | Manage Messages |

---

### 👥 Auto Role

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/autorole set <role>` | Set role for new members | Admin |
| `/autorole remove` | Remove auto-role | Admin |
| `/autorole status` | Check auto-role status | Admin |

---

### 🏆 Invites

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/invites leaderboard` | Show the top invites leaderboard | None |

---

### 🛠️ Utilities

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/about` | Learn more about this bot's creators | None |
| `/list_cogs` | List all currently loaded cogs | Owner Only |

---

### ⚙️ Owner Cog Management

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/load_cog <cog_name>` | Load a cog by name | Owner Only |
| `/unload_cog <cog_name>` | Unload a cog by name | Owner Only |
| `/reload_cog <cog_name>` | Reload a cog by name | Owner Only |

---

## License

This project is licensed under the MIT License.
