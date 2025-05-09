# Docker Hub Deployment

This guide covers deploying DeepQuasar using the pre-built Docker image from Docker Hub, which is the easiest method to get started.

## Prerequisites

- [Docker](https://www.docker.com/get-started) installed on your system
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop on Windows/Mac)

## Quick Start Deployment

1. **Create a project directory:**
   ```bash
   mkdir deepquasar-bot
   cd deepquasar-bot
   ```

2. **Create a docker-compose.yml file:**
   ```bash
   nano docker-compose.yml  # or use any text editor
   ```

   Add the following content:
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
         - ./lavalink:/opt/Lavalink
       ports:
         - "2333:2333"
   
     bot:
       image: karutoil/deepquasar-multifunctionalbot:latest
       restart: unless-stopped
       depends_on:
         - mongodb
         - lavalink
       env_file:
         - .env
   
   volumes:
     mongodb_data:
   ```

3. **Create necessary directories:**
   ```bash
   mkdir -p lavalink/plugins
   ```

4. **Download Lavalink configuration:**
   ```bash
   curl -o lavalink/application.yml https://raw.githubusercontent.com/karutoil/DeepQuasar-MultifunctionalBot/main/lavalink/application.yml
   ```

5. **Create your .env file:**
   ```bash
   nano .env  # or use any text editor
   ```

   Add the required environment variables:
   ```
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_token_here
   CLIENT_ID=your_client_id_here
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://mongodb:27017/musicbot
   
   # Lavalink Configuration
   LAVALINK_HOST=lavalink
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   ```

6. **Start the services:**
   ```bash
   docker-compose up -d
   ```

7. **Check the logs to ensure everything is running correctly:**
   ```bash
   docker-compose logs -f bot
   ```

## YouTube OAuth (Optional)

For better YouTube integration, follow the [Lavalink YouTube OAuth Setup](./lavalink_oauth_setup.md) guide and add the refresh token to your `.env` file.

## Updating the Bot

To update to the latest version of DeepQuasar:

```bash
# Pull the latest image
docker-compose pull

# Restart the services
docker-compose down
docker-compose up -d
```

## Advanced Configuration

### Custom MongoDB Configuration

You can mount a custom MongoDB configuration file and add authentication:

```yaml
mongodb:
  image: mongo:latest
  restart: unless-stopped
  volumes:
    - mongodb_data:/data/db
    - ./mongo-config:/etc/mongo
  command: ["--config", "/etc/mongo/mongod.conf"]
  ports:
    - "27017:27017"
```

### Using External Services

If you already have MongoDB or Lavalink running elsewhere, you can remove those services from the docker-compose.yml and update your `.env` file with the appropriate connection details.

## Troubleshooting

- **Permission issues:** Ensure the mounted directories have the correct permissions
- **Container restart loop:** Check the logs for errors with `docker-compose logs -f bot`
- **Connection errors:** Make sure your `.env` file has the correct service names for MongoDB and Lavalink

For more help, refer to the project's support resources or open an issue on the GitHub repository.