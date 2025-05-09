const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.ChannelCreate,
    once: false,
    async execute(channel) {
        // Skip if it's not a guild channel
        if (!channel.guild) return;
        
        // Log the channel creation event
        await modlogCommand.logAction(
            channel.client,
            channel.guild.id,
            'channel_create',
            { channel }
        );
    }
};