const { Events } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    async execute(oldState, newState, client) {
        // Skip if no music manager or the bot is not involved
        if (!client.musicManager || (newState.id !== client.user.id && oldState.id !== client.user.id)) {
            return;
        }
        
        // Handle case where bot is disconnected from voice
        if (oldState.channelId && !newState.channelId && oldState.member.id === client.user.id) {
            // Bot was disconnected from a voice channel
            const guildId = oldState.guild.id;
            
            // Clean up music resources
            client.musicManager.destroy(guildId);
            console.log(`[Music] Cleaned up resources after bot disconnected from voice in guild ${guildId}`);
        }
        
        // Handle case where bot is the only one left in voice channel
        if (oldState.channelId && 
            oldState.channel && 
            oldState.channel.members.size === 1 && 
            oldState.channel.members.first().id === client.user.id) {
            
            // Bot is alone in voice channel, disconnect after delay
            const guildId = oldState.guild.id;
            console.log(`[Music] Bot is alone in voice channel in guild ${guildId}, disconnecting in 2 minutes if no one joins`);
            
            // Set a timeout to disconnect after 2 minutes if no one joins
            setTimeout(() => {
                const channel = client.channels.cache.get(oldState.channelId);
                if (channel && 
                    channel.members.size === 1 && 
                    channel.members.first().id === client.user.id) {
                    
                    console.log(`[Music] Disconnecting bot from empty voice channel in guild ${guildId}`);
                    client.musicManager.destroy(guildId);
                }
            }, 2 * 60 * 1000); // 2 minutes
        }
    },
};