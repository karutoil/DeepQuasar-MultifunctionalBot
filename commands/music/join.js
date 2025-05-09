const { EmbedBuilder } = require('discord.js');
const { getGuildState, voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        const member = interaction.member;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'join');
        if (!check.pass) {
            return interaction.reply({ embeds: [check.embed], ephemeral: true });
        }
        
        // Everyone can use the join command (no DJ check needed)
        
        const voiceChannel = check.voiceChannel;
        const manager = client.musicManager;
        
        // Initialize guild state
        getGuildState(client, guildId);
        
        if (interaction.guild.members.me.voice.channel) {
            const currentChannel = interaction.guild.members.me.voice.channel;
            if (currentChannel.id === voiceChannel.id) {
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🎶 Already Connected')
                    .setDescription(`I'm already in ${voiceChannel.name}!`)
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            
            // Move to user's channel
            try {
                let player = manager.players.get(guildId);
                if (player) {
                    await player.destroy();
                }
                player = manager.createPlayer({
                    guildId: guildId,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channelId,
                    selfDeaf: true,
                });
                await player.connect();
                
                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🎶 Moved')
                    .setDescription(`Moved to ${voiceChannel.name}!`)
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error joining voice channel:', error);
                return interaction.editReply('Failed to join voice channel.');
            }
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const player = manager.createPlayer({
                guildId: guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                selfDeaf: true,
            });
            await player.connect();
            
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🎶 Connected')
                .setDescription(`Joined ${voiceChannel.name}!`)
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error joining voice channel:', error);
            return interaction.editReply('Failed to join voice channel.');
        }
    }
};