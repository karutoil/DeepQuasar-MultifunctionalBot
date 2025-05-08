const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.ChannelDelete,
    once: false,
    async execute(channel) {
        // Skip if it's not a guild channel
        if (!channel.guild) return;
        
        // Log the channel deletion event
        await modlogCommand.logAction(
            channel.client,
            channel.guild.id,
            'channel_delete',
            { channel }
        );
    }
};