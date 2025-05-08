const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.MessageDelete,
    once: false,
    async execute(message) {
        // Skip if message is from a bot
        if (message.author?.bot) return;
        
        // Skip if guild is not available
        if (!message.guild) return;
        
        // Log the event
        await modlogCommand.logAction(
            message.client, 
            message.guild.id, 
            'message_delete',
            { message }
        );
    }
};