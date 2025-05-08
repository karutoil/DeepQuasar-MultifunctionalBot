# Local Docker Build

This guide covers how to build and run DeepQuasar using Docker from the source code.

## Prerequisites

- [Docker](https://www.docker.com/get-started) installed on your system
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop on Windows/Mac)
- Git (optional, for cloning the repository)

## Installation Steps

1. **Get the DeepQuasar source code:**
   
   Either clone the repository:
   ```bash
   git clone https://github.com/yourusername/DeepQuasar-MultifunctionalBot.git
   cd DeepQuasar-MultifunctionalBot
   ```
   
   Or download and extract the source code.

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your Discord bot token and other settings:
   ```
   DISCORD_TOKEN=your_discord_token_here
   CLIENT_ID=your_client_id_here
   ```

3. **Create a simple docker-compose.yml file:**

   Create a file named `docker-compose.yml` with the following content:
   ```yaml
   version: '3.8'
   
   services:
     mongodb:
       image: mongo:latest
       restart: unless-stopped
       volumes:
         - mongodb_data:/data/db
       ports:
         - "27017:27017"
   
     lavalink:
       image: fredboat/lavalink:latest
       restart: unless-stopped
       volumes:
         - ./lavalink/application.yml:/opt/Lavalink/application.yml
         - ./lavalink/plugins:/opt/Lavalink/plugins
       ports:
         - "2333:2333"
   
     bot:
       build:
         context: .
         dockerfile: Dockerfile
       restart: unless-stopped
       depends_on:
         - mongodb
         - lavalink
       env_file:
         - .env
   
   volumes:
     mongodb_data:
   ```

4. **Build and start the containers:**
   ```bash
   docker-compose up -d --build
   ```

   This command will:
   - Build the bot container from your Dockerfile
   - Start MongoDB and Lavalink services
   - Start the DeepQuasar bot

5. **Check the logs:**
   ```bash
   docker-compose logs -f bot
   ```

## Configuration Options

You can customize the docker-compose.yml file to:

- Map different ports
- Add persistent volumes for other data
- Change the MongoDB or Lavalink versions
- Add additional services

## Updating the Bot

To update the bot after making changes to the code:

```bash
# Pull latest changes if using git
git pull

# Rebuild and restart the containers
docker-compose down
docker-compose up -d --build
```

## YouTube OAuth (Optional)

If you want to enable YouTube OAuth for Lavalink (recommended for better YouTube playback), follow the [Lavalink YouTube OAuth Setup](../python/lavalink_oauth_setup.md) guide and modify your environment variables accordingly.

## Troubleshooting

- **Container not starting:** Check the logs with `docker-compose logs -f bot`
- **Database connection issues:** Make sure the `MONGODB_URI` in your `.env` file is set to `mongodb://mongodb:27017/musicbot`
- **Lavalink connection issues:** Ensure `LAVALINK_HOST=lavalink` is set in your `.env` file

Remember that in a Docker Compose network, services refer to each other by their service name, not localhost.