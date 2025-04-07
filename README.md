# DeepQuasar Multi-Functional Discord Bot

A powerful Discord bot featuring music playback, moderation, ticketing, AI chat, reaction roles, embeds, and more.

---

## How to Use

The recommended way to run this bot is via Docker. No manual setup or dependencies required.

**Docker Hub Repository:**  
[https://hub.docker.com/r/karutoil/deepquasar-multifunctionalbot](https://hub.docker.com/r/karutoil/deepquasar-multifunctionalbot)

### Quick Start with Docker Compose

1. Create a `.env` file with your Discord bot token and any other environment variables:

```
DISCORD_TOKEN=your-bot-token-here
```

2. Use the provided `docker-compose.yml` or create your own:

```yaml
version: '3'
services:
  bot:
    image: karutoil/deepquasar-multifunctionalbot:latest
    env_file: .env
```

3. Start the bot:

```bash
docker-compose up -d
```

---

## Bot Commands

### 🎵 Music

| Command | Description |
|---------|-------------|
| `/join` | Join your voice channel |
| `/play <query>` | Play a song from YouTube |
| `/pause` | Pause playback |
| `/resume` | Resume playback |
| `/stop` | Stop playback and disconnect |
| `/skip` | Skip the current song |
| `/queue` | Show the current queue |
| `/nowplaying` | Show the currently playing song |
| `/volume [level]` | Set or show playback volume (0-200%) |
| `/seek <seconds>` | Seek to a position in the current song |
| `/move <from> <to>` | Move a song in the queue |
| `/remove <position>` | Remove a song from the queue |
| `/clear` | Clear the entire queue |
| `/shuffle` | Shuffle the queue |
| `/loop` | Toggle looping the current song |
| `/replay` | Replay the current song |
| `/history` | Show recently played songs |
| `/setdj <role>` | Set the DJ role |
| `/cleardj` | Clear the DJ role |
| `/autoplay` | Toggle autoplay related songs |

---

### 🎫 Ticket System

| Command | Description |
|---------|-------------|
| `/tickets setup` | Configure ticket system categories, roles, logs |
| `/tickets panel` | Send the ticket creation panel |

---

### 🎭 Reaction Roles

| Command | Description |
|---------|-------------|
| `/reaction create` | Start creating a reaction role message |
| `/reaction add` | Add a role to the current reaction role message |
| `/reaction finish` | Post the reaction role message |
| `/reaction edit` | Add more roles to an existing reaction role message |
| `/reaction remove` | Remove a reaction role from a message |

---

### 👋 Welcome & Leave

| Command | Description |
|---------|-------------|
| `/welcome setwelcome` | Set the welcome message channel |
| `/welcome setleave` | Set the leave message channel |

---

### 🛡️ Moderation & Logging

| Command | Description |
|---------|-------------|
| `/modlog setchannel` | Set the moderation log channel |
| `/modlog toggle <event>` | Enable or disable a specific log event |
| `/modlog toggleall` | Enable or disable all moderation log events |

---

### 🤖 AI Chatbot

| Command | Description |
|---------|-------------|
| `/chatbot configure` | Configure your local AI endpoint |
| `/chatbot prompt` | Set a custom system prompt |
| `/chatbot toggle` | Enable or disable AI responses |
| `/chatbot channel` | Add or remove a whitelisted channel |
| `/chatbot listchannels` | List all whitelisted channels |

---

### 📝 Embed Creator

| Command | Description |
|---------|-------------|
| `/embed create` | Create an embed message |
| `/embed edit` | Edit an existing embed message |
| `/embed get` | Get an embed message as JSON |
| `/embed builder` | Interactively build an embed with buttons |

---

### 🧹 Cleanup

| Command | Description |
|---------|-------------|
| `/cleanup messages <amount>` | Delete the last X messages in this channel |
| `/cleanup all` | Delete all messages in this channel |
| `/cleanup user <user> <amount>` | Delete a number of messages from a specific user |

---

### 👥 Auto Role

| Command | Description |
|---------|-------------|
| `/autorole set <role>` | Set role for new members |
| `/autorole remove` | Remove auto-role |
| `/autorole status` | Check auto-role status |

---

### 🏆 Invites

| Command | Description |
|---------|-------------|
| `/invites leaderboard` | Show the top invites leaderboard |

---

### 🛠️ Utilities

| Command | Description |
|---------|-------------|
| `/about` | Learn more about this bot's creators |
| `/list_cogs` | List all currently loaded cogs |

---

## License

This project is licensed under the MIT License.
