const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'resume');
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
        
        if (!player || !player.paused) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Not Paused')
                .setDescription('Playback is not currently paused.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        await player.resume();
        
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('▶️ Resumed')
            .setDescription('Playback resumed.')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
};