const { EmbedBuilder } = require('discord.js');
const { getGuildState, voiceChannelCheck, formatDuration } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'play');
        if (!check.pass) {
            return interaction.reply({ embeds: [check.embed], flags: 64 });
        }
        
        const voiceChannel = check.voiceChannel;
        const manager = client.musicManager;
        const query = interaction.options.getString('query');
        
        // Get guild state for music features
        const guildState = getGuildState(client, guildId);
        
        await interaction.deferReply();
        
        try {
            // Get or create player
            let player = manager.players.get(guildId);
            if (!player) {
                player = manager.createPlayer({
                    guildId: guildId,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channelId,
                    selfDeaf: true,
                });
                await player.connect();
            }
            
            // Search for the track
            const searchQuery = query.startsWith('http') ? query : `ytsearch:${query}`;
            const res = await player.search({
                query: searchQuery,
                source: query.startsWith('http') ? 'youtube' : undefined,
                requester: interaction.user
            });
            
            if (!res.tracks || res.tracks.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Search Failed')
                    .setDescription('No results found for your query.')
                    .setTimestamp();
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Handle playlist vs. single track
            let tracksToAdd = [];
            let isPlaylist = false;
            let playlistName = '';
            
            if (res.playlist) {
                isPlaylist = true;
                playlistName = res.playlist.name || 'Playlist';
                tracksToAdd = res.tracks.slice(0, 100); // Limit to 100 tracks
            } else {
                tracksToAdd = [res.tracks[0]];
            }
            
            // Add tracks to queue
            player.queue.add(tracksToAdd);
            
            // Helper function to get track properties with fallbacks
            const getTrackInfo = (track) => {
                return {
                    title: track.title || track.info?.title || 'Unknown title',
                    author: track.author || track.info?.author || track.artist || 'Unknown artist',
                    uri: track.uri || track.info?.uri || '#',
                    duration: parseDuration(track),
                    identifier: track.identifier || track.info?.identifier || '',
                    thumbnail: track.thumbnail || track.artworkUrl || track.info?.thumbnail ||
                        (track.uri?.includes('youtube') || track.info?.uri?.includes('youtube')
                            ? `https://img.youtube.com/vi/${track.identifier || track.info?.identifier}/maxresdefault.jpg`
                            : null)
                };
            };
            
            // Save track to history when it starts playing
            if (tracksToAdd[0]) {
                const info = getTrackInfo(tracksToAdd[0]);
                const trackInfo = {
                    title: info.title,
                    url: info.uri,
                    thumbnail: info.thumbnail
                };
                
                // Add to start of history array and limit size
                guildState.history.unshift(trackInfo);
                if (guildState.history.length > 20) {
                    guildState.history = guildState.history.slice(0, 20);
                }
            }
            
            // Start playing if not already
            if (!player.playing) {
                await player.play();
                
                // Restore saved volume using the musicModel
                try {
                    const volumeNormalized = await musicModel.getVolume(guildId);
                    await player.setVolume(Math.floor(volumeNormalized * 100));
                } catch (error) {
                    console.error('Error setting volume:', error);
                }
                
                const info = getTrackInfo(tracksToAdd[0]);
                
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🎵 Now Playing')
                    .setDescription(`**[${info.title}](${info.uri})**`)
                    .addFields(
                        { name: 'Artist', value: info.author, inline: true },
                        { name: 'Duration', value: formatDuration(info.duration), inline: true },
                        { name: 'Requested By', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setTimestamp();
                
                if (info.thumbnail) {
                    embed.setThumbnail(info.thumbnail);
                }
                
                return interaction.editReply({ embeds: [embed] });
            } else {
                // Queue info for already playing
                let embed;
                
                if (isPlaylist) {
                    embed = new EmbedBuilder()
                        .setColor('#3498DB')
                        .setTitle('➕ Playlist Queued')
                        .setDescription(`Added **${tracksToAdd.length}** tracks from playlist **${playlistName}**`)
                        .setFooter({ text: `Requested by ${interaction.user.tag}` })
                        .setTimestamp();
                } else {
                    const info = getTrackInfo(tracksToAdd[0]);

                    embed = new EmbedBuilder()
                        .setColor('#3498DB')
                        .setTitle('➕ Added to Queue')
                        .setDescription(`**[${info.title}](${info.uri})**`)
                        .addFields(
                            { name: 'Artist', value: info.author, inline: true },
                            { name: 'Duration', value: formatDuration(info.duration), inline: true },
                            { name: 'Position', value: `${player.queue.tracks.length}`, inline: true }
                        )
                        .setFooter({ text: `Requested by ${interaction.user.tag}` })
                        .setTimestamp();
                    
                    if (info.thumbnail) {
                        embed.setThumbnail(info.thumbnail);
                    }
                }
                
                return interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error during music playback:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing your music request.')
                .setTimestamp();
            return interaction.editReply({ embeds: [errorEmbed] });
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