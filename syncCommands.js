// Command to sync slash commands and clean up old/stale commands
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
    console.error('Missing DISCORD_TOKEN in .env file');
    process.exit(1);
}

if (!clientId) {
    console.error('Missing CLIENT_ID in .env file');
    process.exit(1);
}

// Create REST instance
const rest = new REST({ version: '10' }).setToken(token);

// Process command line arguments
const args = process.argv.slice(2);
const isGlobal = args.includes('--global');
const wipeOnly = args.includes('--wipe-only');
const listOnly = args.includes('--list');

// Function to collect all commands from the file system
async function getCommandsToRegister() {
    const commands = [];
    const registeredCommands = new Set();
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    // Load top-level command files
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                if (Array.isArray(command.data)) {
                    for (const cmdData of command.data) {
                        if (typeof cmdData.toJSON === "function" && !registeredCommands.has(cmdData.name)) {
                            commands.push(cmdData.toJSON());
                            registeredCommands.add(cmdData.name);
                            console.log(`Loaded command: ${cmdData.name} from ${file}`);
                        }
                    }
                } else if (typeof command.data.toJSON === "function" && !registeredCommands.has(command.data.name)) {
                    commands.push(command.data.toJSON());
                    registeredCommands.add(command.data.name);
                    console.log(`Loaded command: ${command.data.name} from ${file}`);
                }
            }
        } catch (error) {
            console.error(`[ERROR] Failed to load command at ${filePath}:`, error);
        }
    }
    
    return commands;
}

// Function to list all registered commands
async function listCommands() {
    try {
        console.log('Fetching registered commands...');
        
        let commands;
        if (guildId && !isGlobal) {
            // Guild-specific commands
            commands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
            console.log(`\nGuild Commands (Guild ID: ${guildId}):`);
        } else {
            // Global commands
            commands = await rest.get(Routes.applicationCommands(clientId));
            console.log('\nGlobal Commands:');
        }
        
        if (commands.length === 0) {
            console.log('  No commands found.');
        } else {
            commands.forEach(cmd => {
                console.log(`  - ${cmd.name} (ID: ${cmd.id})`);
                if (cmd.options && cmd.options.length > 0) {
                    console.log('    Subcommands:');
                    cmd.options.forEach(option => {
                        if (option.type === 1) { // Subcommand
                            console.log(`      - ${option.name}`);
                        }
                    });
                }
            });
        }
        
        console.log(`\nTotal: ${commands.length} commands`);
    } catch (error) {
        console.error('Error fetching commands:', error);
    }
}

// Function to wipe all commands
async function wipeCommands() {
    try {
        console.log('Wiping all registered commands...');
        
        let data;
        if (guildId && !isGlobal) {
            // Guild-specific commands
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: [] }
            );
            console.log(`Successfully wiped all guild commands for guild ID: ${guildId}`);
        } else {
            // Global commands
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: [] }
            );
            console.log('Successfully wiped all global commands');
        }
    } catch (error) {
        console.error('Error wiping commands:', error);
    }
}

// Function to register commands
async function registerCommands() {
    try {
        const commandsToRegister = await getCommandsToRegister();
        
        console.log(`Registering ${commandsToRegister.length} commands...`);
        
        let data;
        if (guildId && !isGlobal) {
            // Guild-specific registration
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commandsToRegister }
            );
            console.log(`Successfully registered ${data.length} guild commands for guild ID: ${guildId}`);
        } else {
            // Global registration
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commandsToRegister }
            );
            console.log(`Successfully registered ${data.length} global commands`);
        }
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Main function
async function main() {
    // Print a header with info about the operation
    console.log('\n========== COMMAND SYNCHRONIZATION ==========');
    if (isGlobal) {
        console.log('Mode: GLOBAL (changes apply to all servers)');
    } else if (guildId) {
        console.log(`Mode: GUILD (changes apply only to guild ID: ${guildId})`);
    } else {
        console.log('Mode: GLOBAL (changes apply to all servers) - no guild ID provided');
    }
    
    if (listOnly) {
        await listCommands();
    } else if (wipeOnly) {
        await wipeCommands();
    } else {
        console.log('Action: Wiping all commands and registering current ones');
        await wipeCommands();
        await registerCommands();
    }
    
    console.log('============================================\n');
}

// Execute the script
main().catch(error => {
    console.error('Failed to execute command synchronization:', error);
    process.exit(1);
});
