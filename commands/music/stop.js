const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck, getGuildState } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'stop');
        if (!check.pass) {
            return interaction.reply({ embeds: [check.embed], flags: 64 });
        }
        
        // Check if user has DJ permissions
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
        
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Not Playing')
                .setDescription('There is no active player to stop.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        // Directly destroy the player - this handles clearing the queue internally
        await player.destroy(`${interaction.member} stopped the Player`);
        
        // Clear guild music state
        const guildState = getGuildState(client, guildId);
        guildState.looping = false;
        guildState.autoplay = false;
        
        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('⏹️ Stopped')
            .setDescription('Playback stopped and queue cleared.')
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
};