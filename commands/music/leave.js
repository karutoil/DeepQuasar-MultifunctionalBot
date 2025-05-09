const { EmbedBuilder } = require('discord.js');
const { getGuildState, voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'leave');
        if (!check.pass) {
            return interaction.reply({ embeds: [check.embed], ephemeral: true });
        }
        
        // Check DJ permissions
        const hasDJPermission = await musicModel.hasDJPermission(guildId, interaction.member);
        if (!hasDJPermission) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ DJ Only')
                .setDescription('You need the DJ role to use this command.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        const manager = client.musicManager;
        let player = manager.players.get(guildId);
        
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚠️ Not Connected')
                .setDescription('I\'m not connected to a voice channel.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            await player.destroy(`${interaction.member} left the voice channel`);
            
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('👋 Disconnected')
                .setDescription('Left the voice channel.')
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error leaving voice channel:', error);
            return interaction.editReply('Failed to leave voice channel.');
        }
    }
};