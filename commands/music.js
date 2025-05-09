// Import music commands from the split files
const musicCommands = require('./music/index');

// Forward commands to the modular implementation
module.exports = {
    // Use the command data from the index file
    data: musicCommands.data,
    
    // Forward execution to the appropriate command handler
    async execute(interaction, client) {
        return musicCommands.execute(interaction, client);
    },
    
    // Initialize music functionality
    init(client) {
        musicCommands.init(client);
    }
};