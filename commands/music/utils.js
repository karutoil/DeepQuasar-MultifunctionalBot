// Helper functions for music commands
const { EmbedBuilder } = require('discord.js');

// Helper function to format duration in milliseconds to mm:ss or hh:mm:ss
function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '00:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Set up track end event to handle looping and autoplay
function setupTrackEndEvent(client) {
    client.musicManager.on('trackEnd', async (player, track) => {
        const guildId = player.guildId;
        const guildState = client.musicStates?.get(guildId);
        
        if (!guildState) return;
        
        // Handle looping
        if (guildState.looping && track) {
            try {
                player.queue.add(track);
                await player.play();
                return;
            } catch (error) {
                console.error('Error looping track:', error);
            }
        }
        
        // Handle autoplay if queue is empty
        if (guildState.autoplay && player.queue.size === 0 && track) {
            try {
                const res = await player.search({
                    query: `ytsearch:${track.title} ${track.author || ''}`,
                    source: 'youtube'
                });
                
                if (res.tracks?.length > 0) {
                    const nextTrack = res.tracks[1] || res.tracks[0]; // Try to avoid the same track
                    player.queue.add(nextTrack);
                    await player.play();
                }
            } catch (error) {
                console.error('Error with autoplay:', error);
            }
        }
    });
}

// Initialize guild state for music features
function getGuildState(client, guildId) {
    if (!client.musicStates) {
        client.musicStates = new Map();
    }
    
    if (!client.musicStates.has(guildId)) {
        client.musicStates.set(guildId, {
            looping: false,
            autoplay: false,
            history: [], // Array of {title, url, thumbnail} objects
        });
    }
    
    return client.musicStates.get(guildId);
}

// Ensure user is in voice channel for commands that require it
function voiceChannelCheck(interaction, command) {
    const voiceChannel = interaction.member.voice.channel;
    if (!['history', 'queue'].includes(command) && !voiceChannel) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Voice Channel Required')
            .setDescription('You must be in a voice channel to use music commands.')
            .setTimestamp();
        return { pass: false, embed: errorEmbed };
    }
    return { pass: true, voiceChannel };
}

module.exports = {
    formatDuration,
    setupTrackEndEvent,
    getGuildState,
    voiceChannelCheck
};