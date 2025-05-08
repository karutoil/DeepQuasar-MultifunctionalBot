const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        const level = interaction.options.getInteger('level');
        
        // Check if user is in a voice channel when setting volume
        if (level !== null) {
            const check = voiceChannelCheck(interaction, 'volume');
            if (!check.pass) {
                return interaction.reply({ embeds: [check.embed], ephemeral: true });
            }
        }
        
        const manager = client.musicManager;
        const player = manager.players.get(guildId);
        
        // If no level is provided, show current volume
        if (level === null) {
            try {
                // Get volume from our model
                const volumeNormalized = await musicModel.getVolume(guildId);
                const currentVolume = Math.floor(volumeNormalized * 100);
                
                const embed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🔊 Current Volume')
                    .setDescription(`${currentVolume}%`)
                    .setTimestamp();
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('Error getting volume:', error);
                return interaction.reply({ 
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#3498DB')
                            .setTitle('🔊 Current Volume')
                            .setDescription('100%')
                            .setTimestamp()
                    ], 
                    ephemeral: true 
                });
            }
        }
        
        // Set volume in database and player
        try {
            if (!player) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Not Playing')
                    .setDescription('There is no active player to set volume for.')
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            
            const normalizedVolume = level / 100;
            
            // Save volume using our model
            await musicModel.setVolume(guildId, normalizedVolume);
            
            await player.setVolume(level);
            
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🔊 Volume Updated')
                .setDescription(`Set to ${level}%.`)
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error setting volume:', error);
            return interaction.reply({ content: 'Failed to set volume.', ephemeral: true });
        }
    }
};