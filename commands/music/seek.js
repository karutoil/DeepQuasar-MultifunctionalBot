const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck, formatDuration } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'seek');
        if (!check.pass) {
            return interaction.reply({ embeds: [check.embed], flags: 64 });
        }
        
        // Check DJ permissions
        const hasDJPermission = await musicModel.hasDJPermission(guildId, interaction.member);
        if (!hasDJPermission) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ DJ Only')
                .setDescription('You need the DJ role to use this command.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        const manager = client.musicManager;
        const player = manager.players.get(guildId);
        
        if (!player || !player.playing) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Nothing Playing')
                .setDescription('There is nothing currently playing to seek in.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        const currentTrack = player.queue.current;
        if (!currentTrack) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ No Current Track')
                .setDescription('Failed to get current track information.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        const seconds = interaction.options.getInteger('seconds');
        const milliseconds = seconds * 1000;
        
        if (milliseconds < 0 || (currentTrack.duration && milliseconds > currentTrack.duration)) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Invalid Position')
                .setDescription('The specified position is outside the track duration.')
                .setFooter({ text: `Track duration: ${formatDuration(currentTrack.duration || 0)}` })
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        await player.seek(milliseconds);
        
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('⏱️ Seeked')
            .setDescription(`Jumped to position **${formatDuration(milliseconds)}** in the current track.`)
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
};