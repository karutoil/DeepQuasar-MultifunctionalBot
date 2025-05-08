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

// Function to generate invite link
async function generateInviteLink() {
    try {
        // Required permissions for the bot based on its functionality
        const permissions = [
            // General permissions
            'ViewChannel',              // View channels
            'SendMessages',             // Send messages
            'EmbedLinks',               // Embed links (for rich embeds)
            'ReadMessageHistory',       // Read message history (for reactions)
            'UseExternalEmojis',        // Use external emojis
            'AttachFiles',              // Attach files
            'AddReactions',             // Add reactions
            
            // Moderation permissions
            'ManageMessages',           // For cleanup commands
            'ManageChannels',           // For ticket system
            'ManageRoles',              // For autorole and reaction roles
            
            // Voice permissions
            'Connect',                  // Connect to voice channels
            'Speak',                    // Speak in voice channels
            'UseVAD',                   // Use voice activity detection
            'PrioritySpeaker',          // Priority speaker (for music)
        ];
        
        // Create invite with formatted permissions
        const { PermissionsBitField } = require('discord.js');
        const permissionBits = new PermissionsBitField();
        
        // Add each permission
        for (const permission of permissions) {
            if (PermissionsBitField.Flags[permission]) {
                permissionBits.add(PermissionsBitField.Flags[permission]);
            }
        }
        
        // Generate the invite URL
        const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=${permissionBits.bitfield}&scope=bot%20applications.commands`;
        
        // Output the invite link
        console.log('\n======== BOT INVITE LINK ========');
        console.log(inviteLink);
        console.log('=================================\n');
        console.log('Use this link to add the bot to your server with the correct permissions.');
        
        return inviteLink;
    } catch (error) {
        console.error('Error generating invite link:', error);
        return null;
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
        
        // Generate invite link with required permissions
        await generateInviteLink();
    } catch (error) {
        console.error('Error loading commands or events:', error);
    }
    
    // Connect Lavalink manager
    try {
        await client.musicManager.init(client.user.id);
        
        // Give a small delay for connections to establish
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if we successfully connected to at least one node
        let hasConnectedNode = false;
        
        // Get all nodes
        const nodes = Array.from(client.musicManager.nodeManager.nodes.values());
        
        // Debug log to see actual node states
        console.log('[Lavalink] Node connection states:', nodes.map(node => ({
            id: node.options.id || 'default',
            connected: node.connected,
            state: node.state
        })));
        
        // Check if any node is connected
        hasConnectedNode = nodes.some(node => node.connected || node.state === 'CONNECTED');
        
        if (!hasConnectedNode) {
            console.warn('[Lavalink] No connected nodes found after initialization. Music functionality may not work.');
            console.warn('[Lavalink] Will attempt to reconnect nodes when needed.');
            
            // Create a timer to periodically attempt reconnection
            client.lavalinkReconnectInterval = setInterval(async () => {
                try {
                    let reconnected = false;
                    for (const node of client.musicManager.nodeManager.nodes.values()) {
                        if (!node.connected) {
                            try {
                                await node.connect();
                                console.log(`[Lavalink] Successfully reconnected node: ${node.options.id || 'default'}`);
                                reconnected = true;
                            } catch (nodeError) {
                                console.error(`[Lavalink] Failed to reconnect node ${node.options.id || 'default'}:`, nodeError.message);
                            }
                        }
                    }
                    
                    // If we have at least one connected node, we can stop the reconnection attempts
                    if (reconnected || client.musicManager.nodeManager.nodes.some(node => node.connected)) {
                        clearInterval(client.lavalinkReconnectInterval);
                        client.lavalinkReconnectInterval = null;
                        console.log('[Lavalink] Successfully established connection to at least one node.');
                    }
                } catch (error) {
                    console.error('[Lavalink] Error during node reconnection attempt:', error);
                }
            }, 30000); // Try to reconnect every 30 seconds
        } else {
            console.log('[Lavalink] Successfully connected to at least one node.');
        }
    } catch (error) {
        console.error('[Lavalink] Failed to initialize music manager:', error);
        
        // If no nodes were initialized, create a backup node
        if (client.musicManager.nodeManager.nodes.size === 0) {
            console.log('[Lavalink] Attempting to create backup node...');
            try {
                client.musicManager.createNode({
                    authorization: process.env.LAVALINK_PASSWORD || "youshallnotpass",
                    host: process.env.LAVALINK_HOST || "lavalink",
                    port: parseInt(process.env.LAVALINK_PORT || "2333"),
                    id: "backup",
                    secure: process.env.LAVALINK_SECURE === "true"
                });
                console.log('[Lavalink] Backup node created. Will attempt connection when needed.');
            } catch (nodeError) {
                console.error('[Lavalink] Failed to create backup node:', nodeError);
            }
        }
    }

    // Initialize services
    initUpdateNotifier();
});

// Function to register slash commands with Discord API
async function registerSlashCommands() {
    try {
        const commandsToRegister = [];
        const seenNames = new Set();
        
        // First, collect all command names to detect duplicates
        // This initial pass helps us identify which commands are coming from multiple files
        for (const [name, command] of client.slashCommands) {
            if (command.data) {
                if (Array.isArray(command.data)) {
                    for (const cmdData of command.data) {
                        seenNames.add(cmdData.name);
                    }
                } else {
                    seenNames.add(command.data.name);
                }
            }
        }
        
        // Now we clear the collection and keep track of what we've already added
        const registeredCommands = new Set();
        
        // Add all slash commands to the array, handling duplicates properly
        for (const [name, command] of client.slashCommands) {
            if (command.data) {
                if (Array.isArray(command.data)) {
                    for (const cmdData of command.data) {
                        if (typeof cmdData.toJSON === "function" && !registeredCommands.has(cmdData.name)) {
                            commandsToRegister.push(cmdData.toJSON());
                            registeredCommands.add(cmdData.name);
                        }
                    }
                } else if (typeof command.data.toJSON === "function" && !registeredCommands.has(command.data.name)) {
                    commandsToRegister.push(command.data.toJSON());
                    registeredCommands.add(command.data.name);
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
async function gracefulShutdown() {
    console.log('Shutting down the bot gracefully...');
    
    try {
        // Clean up update notifier
        if (client.updateNotifier) {
            client.updateNotifier.stop();
            console.log('Update notifier service stopped');
        }
        
        // Destroy all music players
        if (client.musicManager) {
            try {
                // Disconnect all players
                const players = client.musicManager.players.values();
                for (const player of players) {
                    console.log(`Destroying music player for guild: ${player.guildId}`);
                    await player.destroy();
                }
                console.log('All music players destroyed');
            } catch (err) {
                console.error('Error destroying music players:', err);
            }
        }
        
        // Log out from Discord
        if (client.isReady()) {
            console.log('Logging out from Discord...');
            await client.destroy();
            console.log('Successfully logged out from Discord');
        }
        
        console.log('Shutdown complete!');
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
    } finally {
        // Force exit after a short delay if anything is hanging
        setTimeout(() => {
            console.log('Forcing process exit');
            process.exit(0);
        }, 2000);
    }
}

// Listen for termination signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR1', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown);

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

