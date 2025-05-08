# Local Deployment (Node.js)

This guide covers how to set up DeepQuasar directly on your host machine without Docker.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18.x or higher recommended)
- [npm](https://www.npmjs.com/) (included with Node.js)
- [MongoDB](https://www.mongodb.com/try/download/community) (installed locally or accessible via URI)
- [Lavalink](https://github.com/lavalink-devs/Lavalink) (for music functionality)

## Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/DeepQuasar-MultifunctionalBot.git
   cd DeepQuasar-MultifunctionalBot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit the .env file with your Discord token and other settings
   ```

4. **Set up MongoDB:**
   
   You need a running MongoDB instance. You can:
   - Install MongoDB locally on your machine
   - Use a managed MongoDB service (e.g., MongoDB Atlas)
   
   Configure the MongoDB connection string in your `.env` file:
   ```
   MONGODB_URI=mongodb://localhost:27017/musicbot
   ```

5. **Set up Lavalink:**
   
   Lavalink is required for music functionality. You can run it locally:
   
   a. Download the Lavalink.jar file:
   ```bash
   mkdir -p lavalink
   cd lavalink
   wget https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar
   cp ../lavalink/application.yml .
   ```
   
   b. Start Lavalink (requires Java 17+):
   ```bash
   java -jar Lavalink.jar
   ```
   
   c. Update your `.env` file to point to your Lavalink instance:
   ```
   LAVALINK_HOST=localhost
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   ```

6. **Register Slash Commands:**
   ```bash
   npm run deploy
   ```

7. **Run the bot:**
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## Keeping the Bot Running

For long-term deployments, you may want to use a process manager like [PM2](https://pm2.keymetrics.io/):

```bash
# Install PM2
npm install -g pm2

# Start the bot with PM2
pm2 start index.js --name deepquasar

# Set up PM2 to start on boot
pm2 startup
pm2 save
```

## YouTube OAuth (Optional)

If you want enhanced YouTube functionality, follow the [Lavalink YouTube OAuth Setup](../python/lavalink_oauth_setup.md) guide.

## Troubleshooting

- **Connection issues:** Make sure your MongoDB and Lavalink instances are running and accessible.
- **Permission errors:** Ensure your bot token is correct and the bot has the necessary Discord permissions.
- **Command registration errors:** Try rerunning the `npm run deploy` command.

For more help, refer to the [Discord.js Guide](https://discordjs.guide/) or join our support server.