const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck, formatDuration } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'nowplaying');
        if (!check.pass) {
            return interaction.reply({ embeds: [check.embed], ephemeral: true });
        }
        
        // No DJ check needed for read-only commands
        
        const manager = client.musicManager;
        const player = manager.players.get(guildId);
        
        if (!player || !player.playing) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚠️ Nothing Playing')
                .setDescription('There is no track currently playing.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        const current = player.queue.current;
        if (!current) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚠️ Nothing Playing')
                .setDescription('There is no track currently playing.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            // Get track details with fallbacks
            const trackInfo = {
                title: current.title || current.info?.title || 'Unknown title',
                author: current.author || current.info?.author || current.artist || 'Unknown artist',
                uri: current.uri || current.info?.uri || '#',
                // Parse duration from multiple possible sources
                duration: parseDuration(current),
                identifier: current.identifier || current.info?.identifier || '',
                thumbnail: current.thumbnail || current.artworkUrl || current.info?.thumbnail ||
                    (current.uri?.includes('youtube') || current.info?.uri?.includes('youtube')
                        ? `https://img.youtube.com/vi/${current.identifier || current.info?.identifier}/maxresdefault.jpg`
                        : null)
            };
            
            const position = player.position || 0;
            const duration = trackInfo.duration;
            
            // Generate a text-based progress bar
            const barLength = 12;
            const progressRatio = duration > 0 ? position / duration : 0;
            const filledLength = Math.round(barLength * progressRatio);
            
            let bar = '';
            for (let i = 0; i < barLength; i++) {
                if (i === filledLength) {
                    bar += '▇'; // Current position marker
                } else {
                    bar += '▬'; // Progress bar line
                }
            }
            
            const posFormatted = formatDuration(position);
            const durFormatted = formatDuration(duration);
            
            // Create a nice embed with progress bar
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setAuthor({ name: 'Now playing 🎵' })
                .setTitle(`${trackInfo.title} - ${trackInfo.author}`)
                .setDescription(`${bar}\n\`${posFormatted} / ${durFormatted}\``)
                .setFooter({ text: `Requested by ${interaction.user.tag} 🎧🎶 #${interaction.channel.name}` })
                .setTimestamp();
            
            if (trackInfo.thumbnail) {
                embed.setThumbnail(trackInfo.thumbnail);
            }
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error displaying now playing:', error);
            return interaction.reply({ content: 'Failed to display currently playing track.', ephemeral: true });
        }
    }
};

// Helper function to parse duration from multiple possible sources
function parseDuration(track) {
    // Try to find duration in various possible locations and formats
    if (track.duration && !isNaN(track.duration)) {
        return track.duration;
    }
    
    if (track.info?.length && !isNaN(track.info.length)) {
        return track.info.length;
    }

    if (track.info?.duration && !isNaN(track.info.duration)) {
        return track.info.duration;
    }
    
    // For some Lavalink implementations, the duration might be in seconds
    // so we convert to milliseconds if it seems too small
    if (track.length && !isNaN(track.length)) {
        return track.length < 1000 ? track.length * 1000 : track.length;
    }
    
    // Check for raw numeric property
    if (track.rawDuration && !isNaN(track.rawDuration)) {
        return track.rawDuration;
    }
    
    // Default fallback
    return 0;
}