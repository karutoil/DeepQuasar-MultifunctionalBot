// Main embed command file
const embedModule = require('./embed/index');

// Forward everything to the modular implementation
module.exports = {
    // Re-export the command data
    data: embedModule.data,
    
    // Forward execution to the modular implementation
    async execute(interaction) {
        return embedModule.execute(interaction);
    }
};