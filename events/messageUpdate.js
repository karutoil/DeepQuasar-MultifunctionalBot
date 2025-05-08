const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.MessageUpdate,
    once: false,
    async execute(oldMessage, newMessage) {
        // Skip if message is from a bot or content is the same
        if (oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
        
        // Skip if guild is not available
        if (!oldMessage.guild) return;
        
        // Log the event
        await modlogCommand.logAction(
            oldMessage.client, 
            oldMessage.guild.id, 
            'message_edit',
            { before: oldMessage, after: newMessage }
        );
    }
};