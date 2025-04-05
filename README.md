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
