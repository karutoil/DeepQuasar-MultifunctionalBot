const { EmbedBuilder } = require('discord.js');
const { formatDuration } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        const manager = client.musicManager;
        const player = manager.players.get(guildId);
        
        if (!player || !player.queue || !player.queue.current) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('📋 Queue Empty')
                .setDescription('There are no songs in the queue.')
                .setTimestamp();
            return interaction.reply({ embeds: [errorEmbed] });
        }
        
        const currentTrack = player.queue.current;
        
        // Get track details with fallbacks
        const getTrackInfo = (track) => {
            return {
                title: track.title || track.info?.title || 'Unknown title',
                author: track.author || track.info?.author || track.artist || 'Unknown artist',
                uri: track.uri || track.info?.uri || '#',
                duration: parseDuration(track),
                identifier: track.identifier || track.info?.identifier || ''
            };
        };
        
        const currentInfo = getTrackInfo(currentTrack);
        const currentTrackTitle = currentInfo.title;
        const currentTrackAuthor = currentInfo.author;
        const currentTrackDuration = formatDuration(currentInfo.duration);
        
        let queueDescription = '';
        
        if (player.queue.tracks.length === 0) {
            queueDescription = 'No more songs in queue.';
        } else {
            const tracks = player.queue.tracks
                .slice(0, 10)
                .map((t, i) => {
                    const info = getTrackInfo(t);
                    const trackTitle = info.title;
                    const trackDuration = formatDuration(info.duration);
                    return `**${i + 1}.** [${trackTitle}](${info.uri || '#'}) - ${trackDuration}`;
                })
                .join('\n');
            
            queueDescription = tracks;
            
            if (player.queue.tracks.length > 10) {
                queueDescription += `\n\n*and ${player.queue.tracks.length - 10} more...*`;
            }
        }
        
        const totalDuration = formatDuration(
            player.queue.tracks.reduce((acc, track) => acc + parseDuration(track), 0) + 
            currentInfo.duration
        );
        
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('🎵 Music Queue')
            .setDescription(`**Now Playing:**\n[${currentTrackTitle}](${currentInfo.uri || '#'}) - ${currentTrackDuration}\nby ${currentTrackAuthor}`)
            .addFields(
                { name: `Up Next (${player.queue.tracks.length} songs)`, value: queueDescription || 'No songs in queue' },
                { name: 'Total Queue Duration', value: totalDuration, inline: true },
                { name: 'Requested By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setFooter({ text: `Use /play to add more songs • ${new Date().toLocaleDateString()}` })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
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