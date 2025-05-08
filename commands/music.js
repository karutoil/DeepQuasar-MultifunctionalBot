const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('play')
            .setDescription('Play a song from YouTube or a URL')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('Song name or URL')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('skip')
            .setDescription('Skip the current song'),
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stop playback and clear the queue'),
        new SlashCommandBuilder()
            .setName('queue')
            .setDescription('Show the current music queue'),
    ],
    async execute(interaction, client) {
        const manager = client.musicManager;
        const guildId = interaction.guildId;
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        const command = interaction.commandName;

        if (!voiceChannel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Voice Channel Required')
                .setDescription('You must be in a voice channel to use music commands.')
                .setTimestamp();
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        let player = manager.players.get(guildId);
        if (!player && command === 'play') {
            player = manager.createPlayer({
                guildId: guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                selfDeaf: true,
            });
            await player.connect();
        }
        if (!player) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ No Active Player')
                .setDescription('No music player is active in this server.')
                .setTimestamp();
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        if (command === 'play') {
            const query = interaction.options.getString('query');
            await interaction.deferReply();
            
            try {
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
                
                const track = res.tracks[0];
                player.queue.add(track);
                
                if (!player.playing) {
                    await player.play();
                }
                
                const trackTitle = track.title || track.info?.title || track.name || 'Unknown title';
                const trackAuthor = track.author || track.uploader || track.info?.author || 'Unknown artist';
                const trackDuration = formatDuration(track.duration || track.info?.length || 0);
                const trackThumbnail = track.thumbnail || track.info?.thumbnail || track.artwork_url || 
                                       (track.info?.uri?.includes('youtube') ? 
                                           `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg` : null);

                const embed = new EmbedBuilder()
                    .setColor('#9B59B6')
                    .setTitle('🎵 Added to Queue')
                    .setDescription(`**[${trackTitle}](${track.uri || track.url || track.info?.uri || '#'})**`)
                    .addFields(
                        { name: 'Artist', value: trackAuthor, inline: true },
                        { name: 'Duration', value: trackDuration, inline: true },
                        { name: 'Requested By', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setTimestamp();
                
                if (trackThumbnail) {
                    embed.setThumbnail(trackThumbnail);
                }
                
                return interaction.editReply({ embeds: [embed] });
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
        
        if (command === 'skip') {
            if (!player.playing) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Nothing Playing')
                    .setDescription('There is nothing currently playing to skip.')
                    .setTimestamp();
                return interaction.reply({ embeds: [errorEmbed] });
            }
            
            const currentTrack = player.queue.current;
            const trackTitle = currentTrack ? (currentTrack.title || currentTrack.info?.title || 'the current song') : 'the current song';
            
            await player.skip();
            
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('⏭️ Skipped')
                .setDescription(`Skipped **${trackTitle}**`)
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        }
        
        if (command === 'stop') {
            player.queue.clear();
            await player.destroy();
            
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('⏹️ Stopped')
                .setDescription('Playback stopped and queue cleared.')
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        }
        
        if (command === 'queue') {
            if (!player.queue.current) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('📋 Queue Empty')
                    .setDescription('There are no songs in the queue.')
                    .setTimestamp();
                return interaction.reply({ embeds: [errorEmbed] });
            }
            
            const currentTrack = player.queue.current;
            const currentTrackTitle = currentTrack.title || currentTrack.info?.title || currentTrack.name || 'Unknown track';
            const currentTrackAuthor = currentTrack.author || currentTrack.uploader || currentTrack.info?.author || 'Unknown artist';
            const currentTrackDuration = formatDuration(currentTrack.duration || currentTrack.info?.length || 0);
            
            let queueDescription = '';
            
            if (player.queue.tracks.length === 0) {
                queueDescription = 'No more songs in queue.';
            } else {
                const tracks = player.queue.tracks
                    .slice(0, 10)
                    .map((t, i) => {
                        const trackTitle = t.title || t.info?.title || t.name || `Track ${i+1}`;
                        const trackDuration = formatDuration(t.duration || t.info?.length || 0);
                        return `**${i + 1}.** [${trackTitle}](${t.uri || t.url || t.info?.uri || '#'}) - ${trackDuration}`;
                    })
                    .join('\n');
                
                queueDescription = tracks;
                
                if (player.queue.tracks.length > 10) {
                    queueDescription += `\n\n*and ${player.queue.tracks.length - 10} more...*`;
                }
            }
            
            const totalDuration = formatDuration(
                player.queue.tracks.reduce((acc, track) => acc + (track.duration || track.info?.length || 0), 0) + 
                (currentTrack.duration || currentTrack.info?.length || 0)
            );
            
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('🎵 Music Queue')
                .setDescription(`**Now Playing:**\n[${currentTrackTitle}](${currentTrack.uri || currentTrack.url || currentTrack.info?.uri || '#'}) - ${currentTrackDuration}\nby ${currentTrackAuthor}`)
                .addFields(
                    { name: `Up Next (${player.queue.tracks.length} songs)`, value: queueDescription || 'No songs in queue' },
                    { name: 'Total Queue Duration', value: totalDuration, inline: true },
                    { name: 'Requested By', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: `Use /play to add more songs • ${new Date().toLocaleDateString()}` })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        }
    },
};

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
