const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.ChannelUpdate,
    once: false,
    async execute(oldChannel, newChannel) {
        // Skip if the channel is not from a guild
        if (!oldChannel.guild) return;
        
        // Skip if the only change is the last message ID (happens frequently)
        if (oldChannel.name === newChannel.name && 
            oldChannel.topic === newChannel.topic &&
            oldChannel.nsfw === newChannel.nsfw &&
            oldChannel.parentId === newChannel.parentId &&
            oldChannel.rateLimitPerUser === newChannel.rateLimitPerUser) {
            return;
        }
        
        // Log the channel update event
        await modlogCommand.logAction(
            oldChannel.client,
            oldChannel.guild.id,
            'channel_update',
            { before: oldChannel, after: newChannel }
        );
    }
};