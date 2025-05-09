const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { voiceChannelCheck, formatDuration } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'search');
        if (!check.pass) {
            return interaction.reply({ embeds: [check.embed], ephemeral: true });
        }
        
        /* 
         * This command implements a fully button-based search interface:
         * - Buttons are used for both pagination (prev/next/cancel) and track selection
         * - This is faster and more reliable than using emoji reactions
         * - Provides a consistent UI experience for users
         */
        
        const voiceChannel = check.voiceChannel;
        const manager = client.musicManager;
        const query = interaction.options.getString('query');
        
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
            
            // Search for tracks
            const searchQuery = `ytsearch:${query}`;
            const res = await player.search({
                query: searchQuery,
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
            
            // Get up to 100 tracks (10 pages of 10 tracks)
            const allTracks = res.tracks.slice(0, 100);
            // Track the current page (0-indexed)
            let currentPage = 0;
            const tracksPerPage = 10;
            const totalPages = Math.ceil(allTracks.length / tracksPerPage);
            
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
            
            // Create description with numbered results (1-10)
            // Function to get tracks for the current page
            const getPageTracks = (page) => {
                const startIdx = page * tracksPerPage;
                return allTracks.slice(startIdx, startIdx + tracksPerPage);
            };
            
            // Function to generate embed for current page
            const generateEmbed = (page) => {
                const tracks = getPageTracks(page);
                let description = `**Search results for:** ${query}\n\n`;
                
                tracks.forEach((track, index) => {
                    const info = getTrackInfo(track);
                    description += `${index + 1}. [${info.title}](${info.uri}) - ${info.author} • ${formatDuration(info.duration)}\n`;
                });
                
                description += '\n*Use the buttons below to select a track or navigate pages*';
                if (totalPages > 1) {
                    description += `\n\nPage ${page + 1}/${totalPages}`;
                }
                
                // Create the embed
                const embed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🔎 Search Results')
                    .setDescription(description)
                    .setFooter({ 
                        text: `Requested by ${interaction.user.tag} • Results will expire in 2 minutes`, 
                        iconURL: interaction.user.displayAvatarURL() 
                    })
                    .setTimestamp();
                
                // Add thumbnail of the first result
                const firstTrackInfo = getTrackInfo(tracks[0]);
                if (firstTrackInfo.thumbnail) {
                    embed.setThumbnail(firstTrackInfo.thumbnail);
                }
                
                return embed;
            };
            
            // Create buttons for pagination, track selection, and cancellation
            const createButtons = (currentPage) => {
                // Navigation row
                const navRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('⏪ Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === 0),
                        new ButtonBuilder()
                            .setCustomId('cancel')
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('❌'),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next ⏩')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage >= totalPages - 1)
                    );
                
                // Create selection buttons for tracks (up to 5 per row, max 2 rows = 10 tracks)
                const currentTracks = getPageTracks(currentPage);
                const selectionRows = [];
                
                // First row (tracks 1-5)
                if (currentTracks.length > 0) {
                    const selectionRow1 = new ActionRowBuilder();
                    for (let i = 0; i < Math.min(5, currentTracks.length); i++) {
                        selectionRow1.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`select_${i}`)
                                .setLabel(`${i + 1}`)
                                .setStyle(ButtonStyle.Success)
                        );
                    }
                    selectionRows.push(selectionRow1);
                }
                
                // Second row (tracks 6-10) if needed
                if (currentTracks.length > 5) {
                    const selectionRow2 = new ActionRowBuilder();
                    for (let i = 5; i < Math.min(10, currentTracks.length); i++) {
                        selectionRow2.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`select_${i}`)
                                .setLabel(`${i + 1}`)
                                .setStyle(ButtonStyle.Success)
                        );
                    }
                    selectionRows.push(selectionRow2);
                }
                
                // Return all button rows with navigation and selection
                return [navRow, ...selectionRows];
            };
            
            // Send initial message with buttons for both navigation and track selection
            const message = await interaction.editReply({ 
                embeds: [generateEmbed(currentPage)],
                components: createButtons(currentPage)
            });
            
            // Only need a button collector since we're using buttons for everything now
            const buttonFilter = i => i.user.id === interaction.user.id;
            
            // Set a timeout (2 minutes)
            const collectorOptions = { 
                time: 120000  // 2 minutes
            };
            
            const buttonCollector = message.createMessageComponentCollector({ 
                filter: buttonFilter,
                componentType: ComponentType.Button,
                ...collectorOptions
            });
            
            // Handle all button interactions (track selection, pagination, and cancel)
            buttonCollector.on('collect', async (i) => {
                // Handle cancel button
                if (i.customId === 'cancel') {
                    buttonCollector.stop();
                    
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle('🚫 Search Cancelled')
                        .setDescription('Music search cancelled.')
                        .setTimestamp();
                    
                    await i.update({ 
                        embeds: [cancelEmbed], 
                        components: [] 
                    });
                    
                    return;
                }
                
                // Handle pagination - Previous page
                else if (i.customId === 'prev' && currentPage > 0) {
                    // Go to previous page
                    currentPage--;
                    
                    // Update message with new page and buttons
                    await i.update({
                        embeds: [generateEmbed(currentPage)],
                        components: createButtons(currentPage)
                    });
                    
                    return;
                }
                
                // Handle pagination - Next page
                else if (i.customId === 'next' && currentPage < totalPages - 1) {
                    // Go to next page
                    currentPage++;
                    
                    // Update message with new page and buttons
                    await i.update({
                        embeds: [generateEmbed(currentPage)],
                        components: createButtons(currentPage)
                    });
                    
                    return;
                }
                
                // Handle track selection
                else if (i.customId.startsWith('select_')) {
                    // Extract the track index from the button ID
                    const index = parseInt(i.customId.split('_')[1]);
                    const currentPageTracks = getPageTracks(currentPage);
                    
                    if (index >= 0 && index < currentPageTracks.length) {
                        // Stop collector
                        buttonCollector.stop();
                        
                        const selectedTrack = currentPageTracks[index];
                        
                        // Add track to queue
                        player.queue.add(selectedTrack);
                        
                        // Play if not already playing
                        if (!player.playing) {
                            await player.play();
                            
                            // Restore saved volume
                            try {
                                const volumeNormalized = await musicModel.getVolume(guildId);
                                await player.setVolume(Math.floor(volumeNormalized * 100));
                            } catch (error) {
                                console.error('Error setting volume:', error);
                            }
                            
                            const info = getTrackInfo(selectedTrack);
                            
                            const playingEmbed = new EmbedBuilder()
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
                                playingEmbed.setThumbnail(info.thumbnail);
                            }
                            
                            await i.update({ 
                                embeds: [playingEmbed],
                                components: []
                            });
                        } else {
                            const info = getTrackInfo(selectedTrack);
                            
                            const queuedEmbed = new EmbedBuilder()
                                .setColor('#3498DB')
                                .setTitle('➕ Added to Queue')
                                .setDescription(`**[${info.title}](${info.uri})**`)
                                .addFields(
                                    { name: 'Artist', value: info.author, inline: true },
                                    { name: 'Duration', value: formatDuration(info.duration), inline: true },
                                    { name: 'Position', value: `${player.queue.tracks.length}`, inline: true }
                                )
                                .setTimestamp();
                            
                            if (info.thumbnail) {
                                queuedEmbed.setThumbnail(info.thumbnail);
                            }
                            
                            await i.update({ 
                                embeds: [queuedEmbed],
                                components: []
                            });
                        }
                    }
                }
            });
            
            // Handle timeout
            buttonCollector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle('⏰ Timed Out')
                        .setDescription('Search selection timed out.')
                        .setTimestamp();
                    
                    await message.edit({ 
                        embeds: [timeoutEmbed],
                        components: []
                    });
                }
            });
            
        } catch (error) {
            console.error('Error during music search:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing your search request.')
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
