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
        const searchType = interaction.options.getString('type') || 'song'; // Default to song search
        
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
            
            // Apply a loading message for playlist searches since they might take longer
            if (searchType === 'playlist') {
                const loadingEmbed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🔍 Searching for Playlists...')
                    .setDescription(`Searching for playlists matching "${query}".\nThis may take a moment as we search multiple sources.`)
                    .setFooter({ text: 'Please wait...' })
                    .setTimestamp();
                    
                await interaction.editReply({ embeds: [loadingEmbed] });
                
                // Direct search without caching
                /* console.log(`Performing playlist search for: "${query}"`) */;
                // No caching, continue with direct search
            }
            
            // For playlists, we'll try multiple approaches to find YouTube playlists
            let searchQuery;
            
            if (query.startsWith('http')) {
                // Direct URL handling
                searchQuery = query;
            } else if (searchType === 'playlist') {
                // If explicitly searching for a playlist, try searching with playlist keyword
                if (!query.toLowerCase().includes('playlist')) {
                    searchQuery = `${query} playlist`;
                } else {
                    searchQuery = query;
                }
            } else {
                // Default song search
                searchQuery = `ytsearch:${query}`;
            }
            
            const res = await player.search({
                query: searchQuery,
                source: query.startsWith('http') ? 'youtube' : undefined,
                requester: interaction.user
            });
            
            // Log search results for debugging
            /* console.log(`Search results for "${query}" (type: ${searchType}):`, {
                hasPlaylist: !!res.playlist,
                playlistName: res.playlist?.name || 'none',
                trackCount: res.tracks?.length || 0,
                firstTrackHasPlaylist: res.tracks?.[0]?.playlist ? true : false
            }) */;
            
            if (!res.tracks || res.tracks.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Search Failed')
                    .setDescription('No results found for your query.')
                    .setTimestamp();
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            // Handle different result types based on search type
            if (searchType === 'playlist' || 
                (res.playlist && query.toLowerCase().includes('playlist') && searchType !== 'song')) {
                // For playlist search, we want to show available playlists
                return handlePlaylistResults(interaction, player, res, query);
            } else {
                // For track search, show individual tracks (existing functionality)
                return handleTrackResults(interaction, player, res, query);
            }
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

// Function to handle playlist search results
async function handlePlaylistResults(interaction, player, res, query) {
    // Check if we have playlist results
    let playlists = [];
    
    // If the search directly returned a playlist
    if (res.playlist) {
        playlists = [res.playlist];
    } 
    // If we have multiple tracks, check if any are from playlists
    else if (res.tracks && res.tracks.length > 0) {
        // Try to extract playlist info from tracks if available
        const playlistsMap = new Map();
        
        // Check if any tracks have playlist info
        let foundPlaylist = false;
        res.tracks.forEach(track => {
            if (track.playlist) {
                foundPlaylist = true;
                if (!playlistsMap.has(track.playlist.name)) {
                    playlistsMap.set(track.playlist.name, {
                        name: track.playlist.name,
                        url: track.playlist.url || track.uri,
                        tracks: [track],
                        thumbnail: track.thumbnail || track.artworkUrl
                    });
                } else {
                    playlistsMap.get(track.playlist.name).tracks.push(track);
                }
            }
        });
        
        // If no playlist found in tracks, try to query directly for a playlist in parallel
        if (!foundPlaylist) {
            try {
                /* console.log('No playlist found in initial results, trying parallel playlist searches') */;
                
                // Define all search strategies to run in parallel
                const parallelSearches = [];
                
                // Strategy 1: Direct URL search if it looks like a playlist URL
                if (query.includes('list=') || query.includes('playlist')) {
                    parallelSearches.push({
                        name: 'direct-url',
                        search: player.search({
                            query: query,
                            source: 'youtube',
                            requester: interaction.user
                        })
                    });
                }
                
                // Strategy 2: SoundCloud playlist search
                if (!query.toLowerCase().includes('soundcloud')) {
                    parallelSearches.push({
                        name: 'soundcloud',
                        search: player.search({
                            query: `scsearch:${query} playlist`,
                            requester: interaction.user
                        })
                    });
                }
                
                // Strategy 3: Direct YouTube playlist search URL
                parallelSearches.push({
                    name: 'youtube-playlist-url',
                    search: player.search({
                        query: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw%253D%253D`,
                        source: 'youtube',
                        requester: interaction.user
                    })
                });
                
                // Strategy 4: "playlist" keyword if not already in query
                if (!query.toLowerCase().includes('playlist')) {
                    parallelSearches.push({
                        name: 'playlist-keyword',
                        search: player.search({
                            query: `${query} playlist`,
                            source: 'youtube',
                            requester: interaction.user
                        })
                    });
                }
                
                // Execute all search strategies in parallel with a timeout
                const searchPromises = parallelSearches.map(({ name, search }) => {
                    // Wrap each search in a promise that times out after 5 seconds
                    return Promise.race([
                        search.then(result => ({ name, result }))
                            .catch(error => {
                                console.error(`Error in parallel search strategy "${name}":`, error);
                                return null;
                            }),
                        new Promise(resolve => setTimeout(() => {
                            /* console.log(`Search "${name}" timed out`) */;
                            resolve(null);
                        }, 5000)) // 5 second timeout
                    ]);
                });
                
                /* console.log(`Starting ${searchPromises.length} parallel playlist searches`) */;
                const searchResults = await Promise.all(searchPromises);
                /* console.log('All parallel searches completed') */;
                
                // Process results - prioritize those with playlists
                for (const result of searchResults) {
                    if (!result) continue; // Skip null results (errors or timeouts)
                    
                    /* console.log(`Checking results from search strategy "${result.name}"`) */;
                    if (result.result.playlist) {
                        /* console.log(`Found playlist in strategy "${result.name}"`) */;
                        playlists = [result.result.playlist];
                        foundPlaylist = true;
                        break;
                    }
                    
                    // Check for playlist info in tracks
                    if (result.result.tracks && result.result.tracks.some(track => track.playlist)) {
                        /* console.log(`Found tracks with playlist info in strategy "${result.name}"`) */;
                        result.result.tracks.forEach(track => {
                            if (track.playlist) {
                                if (!playlistsMap.has(track.playlist.name)) {
                                    playlistsMap.set(track.playlist.name, {
                                        name: track.playlist.name,
                                        url: track.playlist.url || track.uri,
                                        tracks: [track],
                                        thumbnail: track.thumbnail || track.artworkUrl
                                    });
                                } else {
                                    playlistsMap.get(track.playlist.name).tracks.push(track);
                                }
                            }
                        });
                        
                        if (playlistsMap.size > 0) {
                            playlists = Array.from(playlistsMap.values());
                            foundPlaylist = true;
                            break;
                        }
                    }
                }
                
                // Try extensive playlist search strategies
                if (!foundPlaylist) {
                    const extensiveSearchRes = await tryExtensivePlaylistSearch(player, query, interaction);
                    if (extensiveSearchRes?.playlist) {
                        playlists = [extensiveSearchRes.playlist];
                        foundPlaylist = true;
                    }
                }
            } catch (error) {
                console.error('Error in additional playlist search:', error);
            }
        }
        
        // If we found playlists in the tracks
        if (playlistsMap.size > 0) {
            playlists = Array.from(playlistsMap.values());
        }
    }
    
    // Last resort - try extensive search strategies for albums and playlists
    if (playlists.length === 0) {
        try {
            const extensiveResult = await tryExtensivePlaylistSearch(player, query, interaction);
            if (extensiveResult && extensiveResult.playlist) {
                playlists = [extensiveResult.playlist];
            } else if (extensiveResult && extensiveResult.tracks) {
                // Check if any tracks have playlist info
                const playlistsMap = new Map();
                extensiveResult.tracks.forEach(track => {
                    if (track.playlist) {
                        if (!playlistsMap.has(track.playlist.name)) {
                            playlistsMap.set(track.playlist.name, {
                                name: track.playlist.name,
                                url: track.playlist.url || track.uri,
                                tracks: [track],
                                thumbnail: track.thumbnail || track.artworkUrl
                            });
                        } else {
                            playlistsMap.get(track.playlist.name).tracks.push(track);
                        }
                    }
                });
                
                if (playlistsMap.size > 0) {
                    playlists = Array.from(playlistsMap.values());
                }
            }
        } catch (error) {
            console.error('Error in extensive playlist search:', error);
        }
    }
    
    if (playlists.length === 0) {
        // No playlists found, try regular track search as fallback
        const fallbackEmbed = new EmbedBuilder()
            .setColor('#FF9900')
            .setTitle('⚠️ No Playlists Found')
            .setDescription(`No playlists found for "${query}". Showing individual tracks instead.\n\nFor best results, try:\n• Using the exact playlist name\n• Including the artist name\n• Adding "playlist" or "album" to your search\n• Using a direct YouTube playlist URL`)
            .setFooter({ 
                text: 'Try searching with the album name or artist + "full album"'
            })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [fallbackEmbed] });
        return handleTrackResults(interaction, player, res, query);
    }
    
    // Get up to 10 playlists
    const allPlaylists = playlists.slice(0, 10);
    
    // No caching since URLs may expire
    /* console.log(`Found ${allPlaylists.length} playlists for "${query}" (not cached)`) */;
    
    // Handle the display of playlists
    return displayPlaylistResults(interaction, player, allPlaylists, query);
}

// No cached playlist handling needed since we removed caching

// Function to display playlist results (extracted for reuse)
async function displayPlaylistResults(interaction, player, allPlaylists, query) {
    // Track the current page (0-indexed)
    let currentPage = 0;
    const playlistsPerPage = 5;
    const totalPages = Math.ceil(allPlaylists.length / playlistsPerPage);
    
    // Function to get playlists for the current page
    const getPagePlaylists = (page) => {
        const startIdx = page * playlistsPerPage;
        return allPlaylists.slice(startIdx, startIdx + playlistsPerPage);
    };
    
    // Function to generate embed for current page
    const generateEmbed = (page) => {
        const pagePlaylists = getPagePlaylists(page);
        let description = `**Playlist results for:** ${query}\n\n`;
        
        pagePlaylists.forEach((playlist, index) => {
            const trackCount = playlist.tracks?.length || 'Unknown';
            const playlistSource = playlist.url?.includes('youtube') ? 'YouTube' : 
                                 playlist.url?.includes('soundcloud') ? 'SoundCloud' : 'Music';
            description += `${index + 1}. [${playlist.name}](${playlist.url || '#'}) - ${trackCount} tracks (${playlistSource})\n`;
        });
        
        description += '\n*Use the buttons below to select a playlist or navigate pages*';
        if (totalPages > 1) {
            description += `\n\nPage ${page + 1}/${totalPages}`;
        }
        
        // Add tips for finding more playlists
        if (pagePlaylists.length < 3) {
            description += '\n\n**Tip:** For better playlist results, try adding "official playlist" or "full album" to your search term.';
        }
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('🔎 Playlist Search Results')
            .setDescription(description)
            .setFooter({ 
                text: `Requested by ${interaction.user.tag} • Selection menu will expire in 2 minutes`, 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();
        
        // Add source info
        const sources = ['YouTube', 'SoundCloud', 'Spotify']; // Available sources
        const detectedSources = [];
        
        // Detect which sources we found playlists from
        for (const playlist of pagePlaylists) {
            if (playlist.url?.includes('youtube') && !detectedSources.includes('YouTube')) {
                detectedSources.push('YouTube');
            } else if (playlist.url?.includes('soundcloud') && !detectedSources.includes('SoundCloud')) {
                detectedSources.push('SoundCloud');
            }
        }
        
        if (detectedSources.length > 0) {
            embed.addFields({ 
                name: 'Sources', 
                value: detectedSources.join(', '), 
                inline: true 
            });
        }
        
        // Add thumbnail of the first result
        if (pagePlaylists[0]?.thumbnail) {
            embed.setThumbnail(pagePlaylists[0].thumbnail);
        }
        
        return embed;
    };
    
    // Create buttons for pagination, playlist selection, and cancellation
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
        
        // Create selection buttons for playlists
        const currentPlaylists = getPagePlaylists(currentPage);
        const selectionRow = new ActionRowBuilder();
        
        for (let i = 0; i < Math.min(5, currentPlaylists.length); i++) {
            selectionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`select_${i}`)
                    .setLabel(`${i + 1}`)
                    .setStyle(ButtonStyle.Success)
            );
        }
        
        // Return all button rows with navigation and selection
        return [navRow, selectionRow];
    };
    
    // Send initial message with buttons for both navigation and playlist selection
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
    
    // Handle all button interactions (playlist selection, pagination, and cancel)
    buttonCollector.on('collect', async (i) => {
        // Handle cancel button
        if (i.customId === 'cancel') {
            buttonCollector.stop();
            
            const cancelEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('🚫 Search Cancelled')
                .setDescription('Playlist search cancelled.')
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
        
        // Handle playlist selection
        else if (i.customId.startsWith('select_')) {
            // Extract the playlist index from the button ID
            const index = parseInt(i.customId.split('_')[1]);
            const currentPagePlaylists = getPagePlaylists(currentPage);
            
            if (index >= 0 && index < currentPagePlaylists.length) {
                // Stop collector
                buttonCollector.stop();
                
                const selectedPlaylist = currentPagePlaylists[index];
                const tracksToQueue = selectedPlaylist.tracks;
                const playlistName = selectedPlaylist.name;
                
                // Process loading message
                const loadingEmbed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('⏳ Loading Playlist')
                    .setDescription(`Loading tracks from playlist **${playlistName}**...`)
                    .setTimestamp();
                
                await i.update({ 
                    embeds: [loadingEmbed],
                    components: []
                });
                
                if (tracksToQueue && tracksToQueue.length > 0) {
                    // Add all tracks to queue
                    player.queue.add(tracksToQueue);
                    
                    // Play if not already playing
                    let nowPlaying = false;
                    if (!player.playing) {
                        await player.play();
                        nowPlaying = true;
                        
                        // Restore saved volume
                        try {
                            const volumeNormalized = await musicModel.getVolume(interaction.guildId);
                            await player.setVolume(Math.floor(volumeNormalized * 100));
                        } catch (error) {
                            console.error('Error setting volume:', error);
                        }
                    }
                    
                    // Create success embed
                    const successEmbed = new EmbedBuilder()
                        .setColor(nowPlaying ? '#2ECC71' : '#3498DB')
                        .setTitle(nowPlaying ? '🎵 Now Playing Playlist' : '➕ Playlist Added to Queue')
                        .setDescription(`**${playlistName}**`)
                        .addFields(
                            { name: 'Track Count', value: `${tracksToQueue.length} songs`, inline: true },
                            { name: 'Requested By', value: `<@${interaction.user.id}>`, inline: true }
                        );
                    
                    // Add first few track names if available
                    if (tracksToQueue.length > 0) {
                        const firstFewTracks = tracksToQueue.slice(0, 3).map((track, i) => {
                            const trackInfo = {
                                title: track.title || track.info?.title || 'Unknown track',
                                author: track.author || track.info?.author || track.artist || 'Unknown artist'
                            };
                            return `${i+1}. ${trackInfo.title} - ${trackInfo.author}`;
                        }).join('\n');
                        
                        successEmbed.addFields({
                            name: 'First Tracks',
                            value: firstFewTracks + (tracksToQueue.length > 3 ? `\n*...and ${tracksToQueue.length - 3} more*` : ''),
                            inline: false
                        });
                    }
                    
                    successEmbed.setTimestamp();
                    
                    if (selectedPlaylist.thumbnail) {
                        successEmbed.setThumbnail(selectedPlaylist.thumbnail);
                    }
                    
                    await interaction.editReply({ 
                        embeds: [successEmbed],
                        components: []
                    });
                } else {
                    // No tracks found in playlist
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('❌ Empty Playlist')
                        .setDescription('This playlist contains no playable tracks.')
                        .setTimestamp();
                    
                    await interaction.editReply({ 
                        embeds: [errorEmbed],
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
                .setDescription('Playlist selection timed out.')
                .setTimestamp();
            
            await message.edit({ 
                embeds: [timeoutEmbed],
                components: []
            });
        }
    });
}

// Function to handle track search results (original functionality renamed)
async function handleTrackResults(interaction, player, res, query) {
    // Check if we found a playlist but are in track mode - add a note to the user
    let playlistNote = '';
    if (res.playlist) {
        playlistNote = `\n\n**Note:** Found playlist "${res.playlist.name}". Use \`/search query:${query} type:playlist\` to view it as a playlist.`;
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
        });                description += '\n*Use the buttons below to select a track or navigate pages*';
                if (totalPages > 1) {
                    description += `\n\nPage ${page + 1}/${totalPages}`;
                }
                
                // Add note about playlist if detected
                if (playlistNote) {
                    description += playlistNote;
                }
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('🔎 Song Search Results')
            .setDescription(description)
            .setFooter({ 
                text: `Requested by ${interaction.user.tag} • Selection menu will expire in 2 minutes`, 
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
                        const volumeNormalized = await musicModel.getVolume(interaction.guildId);
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
}

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

// Helper function for extensive playlist searching with parallel execution
async function tryExtensivePlaylistSearch(player, query, interaction) {
    const searchStrategies = [
        { query: `${query} full album`, source: 'youtube' },
        { query: `${query} album playlist`, source: 'youtube' },
        { query: `${query} official playlist`, source: 'youtube' },
        { query: `${query} all songs`, source: 'youtube' }
    ];
    
    // If query contains "album", add more specific search strategies
    if (query.toLowerCase().includes('album')) {
        searchStrategies.push(
            { query: query.replace(/album/i, 'full album'), source: 'youtube' },
            { query: query.replace(/album/i, 'complete album'), source: 'youtube' }
        );
    }
    
    // Add artist-specific strategies if the query might be an artist
    if (!query.toLowerCase().includes('playlist') && !query.toLowerCase().includes('album')) {
        searchStrategies.push(
            { query: `${query} artist playlist`, source: 'youtube' },
            { query: `${query} greatest hits`, source: 'youtube' }
        );
    }
    
    /* console.log(`Starting parallel search with ${searchStrategies.length} strategies`) */;
    
    // Execute all search strategies in parallel
    const searchPromises = searchStrategies.map(strategy => {
        return new Promise(async (resolve) => {
            try {
                /* console.log(`Trying playlist search with query: ${strategy.query}`) */;
                const result = await player.search({
                    query: strategy.query,
                    source: strategy.source,
                    requester: interaction.user
                });
                resolve({ result, strategy });
            } catch (error) {
                console.error(`Error with search strategy "${strategy.query}":`, error);
                resolve(null); // Resolve with null on error to not break Promise.all
            }
        });
    });
    
    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);
    
    // Process results in priority order
    for (const item of results) {
        if (!item) continue;
        
        const { result, strategy } = item;
        
        // Check if result has a playlist
        if (result.playlist) {
            /* console.log(`Found playlist with strategy: ${strategy.query}`) */;
            return result;
        }
        
        // Check if any tracks have playlist info
        if (result.tracks && result.tracks.some(track => track.playlist)) {
            /* console.log(`Found tracks with playlist info using strategy: ${strategy.query}`) */;
            return result;
        }
    }
    
    return null;
}
