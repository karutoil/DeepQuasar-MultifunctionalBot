# MusicBot

A Discord bot with music, moderation, and utility features.

## Setup Instructions

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd MusicBot
```

2. **Create and activate a virtual environment (optional but recommended)**

On **Windows**:
```bash
python -m venv venv
venv\Scripts\activate
```

On **macOS/Linux**:
```bash
python3 -m venv venv
source venv/bin/activate
```

3. **Install dependencies**

```bash
pip install -r requirements.txt
```

4. **Configure environment variables**

Create a `.env` file in the project root with your Discord bot token:

```
DISCORD_TOKEN=your-bot-token-here
```

## Running the Bot

```bash
python main.py
```

## Notes

- Do **NOT** share your `.env` file or bot token publicly.
- The `.env` file is excluded from git via `.gitignore`.
- Make sure your bot has the necessary permissions and intents enabled in the Discord Developer Portal.

## Additional Dependencies

The music features require [**FFmpeg**](https://ffmpeg.org/) to be installed on your system.

### Windows
- Download the latest static build from [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
- Extract the zip file
- Add the `bin` folder path (containing `ffmpeg.exe`) to your **System PATH** environment variable

### macOS
```bash
brew install ffmpeg
```

### Linux (Debian/Ubuntu)
```bash
sudo apt update
sudo apt install ffmpeg
```

## Docker Usage

### Build Docker Image

```bash
docker build -t musicbot .
```

### Run Docker Container

```bash
docker run --name musicbot-container --env-file .env musicbot
```

### Using Docker Compose

You can also use Docker Compose to build and run the bot easily.

```bash
docker-compose up --build
```

This will:
- Build the Docker image
- Start the container named `musicbot-container`
- Load environment variables from your `.env` file

To stop the bot:

```bash
docker-compose down
```

**Note:** Make sure your `.env` file is present in the project root before running Docker or Docker Compose.

## Bot Commands

### User Commands

| Command | Description |
|---------|-------------|
| `/join` | Joins the voice channel |
| `/play <query>` | Plays a song from YouTube |
| `/pause` | Pauses the current song |
| `/resume` | Resumes the current song |
| `/stop` | Stops the current song and clears the queue |
| `/skip` | Skips the current song |
| `/queue` | Shows the current queue |
| `/nowplaying` | Shows the currently playing song |
| `/volume <level>` | Adjust or view the player volume (0-200%) |
| `/invite_leaderboard` | Show the top invites leaderboard |
| `/listchannels` | List whitelisted AI channels |
| `/autorole_status` | Check auto-role status |

### Administrator / Moderator Commands

| Command | Description |
|---------|-------------|
| `/setwelcomechannel` | Set the welcome message channel |
| `/setleavechannel` | Set the leave message channel |
| `/setticket` | Configure ticketing system |
| `/createpanel` | Create a ticket panel |
| `/createreactionroles` | Start creating a reaction role message |
| `/addreactionrole` | Add a role to the current reaction role message |
| `/finishreactionroles` | Post the reaction role message |
| `/editreactionroles` | Add more roles to an existing reaction role message |
| `/removereactionrole` | Remove a reaction role from a message |
| `/setmodlog` | Set the moderation log channel |
| `/togglemodlog` | Toggle specific moderation log events |
| `/toggleallmodlog` | Toggle all moderation log events |
| `/ailocal` | Configure local AI settings |
| `/aiprompt` | Set AI prompt |
| `/toggleai` | Enable or disable AI features |
| `/aichannel` | Set AI channel |
| `/embedcreate` | Create an embed message |
| `/embededit` | Edit an existing embed message |
| `/embedget` | Get an embed message |
| `/embedbuilder` | Interactively build an embed with buttons |
| `/cleanup` | Delete the last X messages in this channel |
| `/cleanup_all` | Delete all messages in this channel |
| `/cleanup_user` | Delete a number of messages from a specific user |
| `/set_autorole` | Set role for new members |
| `/remove_autorole` | Remove auto-role |
