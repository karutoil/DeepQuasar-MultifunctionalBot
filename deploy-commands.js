require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load Bot Token from .env
const token = process.env.DISCORD_TOKEN;

// Create the rest commands array
const commands = [];
// Get all command files from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load all command data into the commands array
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        // Check if data is an array (like for music commands with multiple subcommands)
        if (Array.isArray(command.data)) {
            for (const cmd of command.data) {
                commands.push(cmd.toJSON());
                console.log(`Loaded command: ${cmd.name} from ${file}`);
            }
        } else {
            commands.push(command.data.toJSON());
            console.log(`Loaded command: ${command.data.name} from ${file}`);
        }
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Create and configure the REST instance
const rest = new REST().setToken(token);

// Function to deploy commands
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The commands can be registered globally or for specific guilds
        // For development, registering to a specific guild is faster
        // For production, use global registration
        
        // For development (guild-specific)
        if (process.env.GUILD_ID) {
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} guild (/) commands.`);
        } 
        // For production (global)
        else {
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} global (/) commands.`);
        }
    } catch (error) {
        // Catch and log any errors
        console.error(error);
    }
})();