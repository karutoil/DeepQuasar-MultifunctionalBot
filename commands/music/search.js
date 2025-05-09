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
            
            // Create description with numbered results (0-9)
            const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
            const navigationEmojis = ['⏪', '⏩'];
            
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
                    description += `${emojis[index]} [${info.title}](${info.uri}) - ${info.author} • ${formatDuration(info.duration)}\n`;
                });
                
                description += '\n*Use the reactions below to select a track to play*';
                if (totalPages > 1) {
                    description += `\n\nPage ${page + 1}/${totalPages} • Use ⏪ and ⏩ to navigate`;
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
            
            // Create buttons for pagination and cancellation
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('cancel')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );
            
            const message = await interaction.editReply({ 
                embeds: [generateEmbed(currentPage)],
                components: [row]
            });
            
            // Add reactions for the first page in parallel
            const currentTracks = getPageTracks(currentPage);
            
            // Create an array of reaction promises
            const reactionPromises = [];
            
            // Add number reactions
            for (let i = 0; i < currentTracks.length; i++) {
                reactionPromises.push(message.react(emojis[i]));
            }
            
            // Add navigation reactions if multiple pages
            if (totalPages > 1) {
                reactionPromises.push(message.react(navigationEmojis[0])); // ⏪
                reactionPromises.push(message.react(navigationEmojis[1])); // ⏩
            }
            
            // Execute all reaction promises in parallel
            // This significantly improves the speed of adding initial reactions (from 5-10s to <1s)
            await Promise.all(reactionPromises);
            
            // Create collectors
            const filter = (reaction, user) => {
                return (emojis.includes(reaction.emoji.name) || navigationEmojis.includes(reaction.emoji.name)) 
                    && user.id === interaction.user.id;
            };
            
            const buttonFilter = i => i.user.id === interaction.user.id;
            
            // Set a longer timeout (2 minutes)
            const collectorOptions = { 
                time: 120000  // 2 minutes
            };
            
            const reactionCollector = message.createReactionCollector({ 
                filter, 
                ...collectorOptions 
            });
            
            const buttonCollector = message.createMessageComponentCollector({ 
                filter: buttonFilter,
                componentType: ComponentType.Button,
                ...collectorOptions
            });
            
            // Handle reaction selection
            reactionCollector.on('collect', async (reaction, user) => {
                const emojiName = reaction.emoji.name;
                
                // Handle navigation reactions
                if (navigationEmojis.includes(emojiName)) {
                    // Remove user's reaction
                    await reaction.users.remove(user.id).catch(console.error);
                    
                    // Update current page
                    if (emojiName === navigationEmojis[0] && currentPage > 0) {
                        // Previous page
                        currentPage--;
                    } else if (emojiName === navigationEmojis[1] && currentPage < totalPages - 1) {
                        // Next page
                        currentPage++;
                    } else {
                        return; // Invalid navigation
                    }
                    
                    // Update message with new page content only
                    await message.edit({ embeds: [generateEmbed(currentPage)] });
                    
                    return;
                }
                
                // Handle track selection
                const emojiIndex = emojis.indexOf(emojiName);
                const currentPageTracks = getPageTracks(currentPage);
                
                if (emojiIndex >= 0 && emojiIndex < currentPageTracks.length) {
                    // Stop collectors
                    reactionCollector.stop();
                    buttonCollector.stop();
                    
                    const selectedTrack = currentPageTracks[emojiIndex];
                    
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
                        
                        await message.edit({ 
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
                        
                        await message.edit({ 
                            embeds: [queuedEmbed],
                            components: []
                        });
                    }
                }
                
                // Try to remove all reactions
                try {
                    await message.reactions.removeAll();
                } catch (error) {
                    console.error('Failed to remove reactions:', error);
                }
            });
            
            // Handle button interaction (cancel)
            buttonCollector.on('collect', async (i) => {
                if (i.customId === 'cancel') {
                    reactionCollector.stop();
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
                    
                    // Try to remove all reactions
                    try {
                        await message.reactions.removeAll();
                    } catch (error) {
                        console.error('Failed to remove reactions:', error);
                    }
                }
            });
            
            // Handle timeout
            reactionCollector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle('⏰ Timed Out')
                        .setDescription('Search selection timed out.')
                        .setTimestamp();
                    
                    await message.edit({ 
                        embeds: [timeoutEmbed],
                        components: []
                    });
                    
                    // Try to remove all reactions
                    try {
                        await message.reactions.removeAll();
                    } catch (error) {
                        console.error('Failed to remove reactions:', error);
                    }
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
