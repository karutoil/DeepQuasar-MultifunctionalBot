require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    Events,
    ActivityType,
    Routes
} = require('discord.js');
const { connect } = require('./models/database');
const UpdateNotifierService = require('./utils/updateNotifierService');
const fs = require('fs');
const path = require('path');
const { LavalinkManager } = require('lavalink-client');

// Set up intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Command collections
client.commands = new Collection();
client.slashCommands = new Collection();

// Debug log for Lavalink environment variables
console.log('Lavalink config:', {
    host: process.env.LAVALINK_HOST,
    port: process.env.LAVALINK_PORT,
    password: process.env.LAVALINK_PASSWORD,
    secure: process.env.LAVALINK_SECURE,
});

client.musicManager = new LavalinkManager({
    nodes: [
        {
            authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass",
            host: process.env.LAVALINK_HOST || "lavalink",
            port: parseInt(process.env.LAVALINK_PORT || "2333"),
            id: "main",
            secure: process.env.LAVALINK_SECURE === "true"
        }
    ],
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    autoSkip: true,
    client: {
        id: process.env.CLIENT_ID,
        username: "DeepQuasar"
    },
    defaultSearchPlatform: "youtube",
    playerOptions: {
        onEmptyQueue: {
            destroyAfterMs: 30000 // destroy player when queue remains empty for 30 seconds
        }
    }
});

// Bind Discord.js voice state updates to Lavalink
client.on('raw', d => client.musicManager.sendRawData(d));

// Lavalink event logging (optional, for debugging)
client.musicManager.on('nodeConnect', node => {
    console.log(`[Lavalink] Node ${node.options.id} connected`);
});
client.musicManager.on('nodeError', (node, error) => {
    console.error(`[Lavalink] Node ${node.options.id} error:`, error);
});

// Function to load slash commands
async function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // Handle both single and multiple command definitions
        if ('data' in command && 'execute' in command) {
            if (Array.isArray(command.data)) {
                // For multiple commands like music commands
                for (const cmdData of command.data) {
                    client.slashCommands.set(cmdData.name, command);
                    console.log(`Loaded slash command: ${cmdData.name}`);
                }
            } else {
                client.slashCommands.set(command.data.name, command);
                console.log(`Loaded slash command: ${command.data.name}`);
            }
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Function to load event handlers
function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        
        console.log(`Loaded event: ${event.name}`);
    }
}

// Initialize update notifier service
function initUpdateNotifier() {
    try {
        client.updateNotifier = new UpdateNotifierService(client);
        console.log('Update notifier service initialized!');
        
        // Start the service - this will check if it's enabled in the DB
        client.updateNotifier.start();
    } catch (error) {
        console.error('Failed to initialize update notifier service:', error);
    }
}

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    // Set watching status with server and member count
    const totalGuilds = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
    const activityText = `${totalGuilds} servers | ${totalMembers} members`;
    
    client.user.setActivity(activityText, { type: ActivityType.Watching });
    
    // Try to load commands and events
    try {
        await loadCommands();
        loadEvents();
        console.log('Commands and events loaded successfully!');
        
        // Register commands with Discord API
        await registerSlashCommands();
    } catch (error) {
        console.error('Error loading commands or events:', error);
    }
    
    // Connect Lavalink manager
    await client.musicManager.init(client.user.id);

    // Initialize services
    initUpdateNotifier();
});

// Function to register slash commands with Discord API
async function registerSlashCommands() {
    try {
        const commandsToRegister = [];
        const seenNames = new Set();
        // Add all slash commands to the array, skipping duplicates
        for (const [name, command] of client.slashCommands) {
            if (command.data) {
                if (Array.isArray(command.data)) {
                    for (const cmdData of command.data) {
                        if (typeof cmdData.toJSON === "function" && !seenNames.has(cmdData.name)) {
                            commandsToRegister.push(cmdData.toJSON());
                            seenNames.add(cmdData.name);
                        } else if (seenNames.has(cmdData.name)) {
                            console.warn(`Duplicate command name detected: ${cmdData.name}. Skipping.`);
                        }
                    }
                } else if (typeof command.data.toJSON === "function" && !seenNames.has(command.data.name)) {
                    commandsToRegister.push(command.data.toJSON());
                    seenNames.add(command.data.name);
                } else if (seenNames.has(command.data.name)) {
                    console.warn(`Duplicate command name detected: ${command.data.name}. Skipping.`);
                }
            }
        }
        console.log(`Registering ${commandsToRegister.length} unique slash commands with Discord API...`);
        
        // Create REST instance for API calls
        const { REST } = require('discord.js');
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        // Register commands - either globally or to a specific guild based on env var
        if (process.env.GUILD_ID) {
            // Guild-specific registration (faster for development)
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commandsToRegister }
            );
            console.log(`Successfully registered ${data.length} guild commands with Discord API`);
        } else {
            // Global registration (for production)
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commandsToRegister }
            );
            console.log(`Successfully registered ${data.length} global commands with Discord API`);
        }
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
}

// Handle interactions (commands and buttons)
client.on(Events.InteractionCreate, async interaction => {
    try {
        // Handle button interactions first
        if (interaction.isButton()) {
            // Find the command that might be handling this button
            for (const [_, command] of client.slashCommands) {
                if (command.handleButton && await command.handleButton(interaction, client)) {
                    // If a command handled this button, stop processing
                    return;
                }
            }
        }
        
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            
            await command.execute(interaction, client);
        }
    } catch (error) {
        console.error(`Error handling interaction: ${interaction.id}`);
        console.error(error);
        
        const errorReply = { 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
        };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorReply);
        } else {
            await interaction.reply(errorReply);
        }
    }
});

// Handle process shutdown to clean up resources
process.on('SIGINT', () => {
    console.log('Shutting down...');
    // Clean up update notifier
    if (client.updateNotifier) {
        client.updateNotifier.stop();
    }
    process.exit(0);
});

// Error handling for unhandled rejections
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Connect to MongoDB and then log in the bot
connect()
    .then(() => {
        console.log('Connected to MongoDB');
        
        // Login to Discord with app token
        client.login(process.env.DISCORD_TOKEN);
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    });

