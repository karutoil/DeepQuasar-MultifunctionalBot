const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck, getGuildState } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'loop');
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
        const player = manager.players.get(guildId);
        
        if (!player || !player.playing) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Nothing Playing')
                .setDescription('There is nothing currently playing to loop.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Toggle the loop state
        const guildState = getGuildState(client, guildId);
        guildState.looping = !guildState.looping;
        
        const embed = new EmbedBuilder()
            .setColor(guildState.looping ? '#2ECC71' : '#E74C3C')
            .setTitle(guildState.looping ? '🔁 Loop Enabled' : '↩️ Loop Disabled')
            .setDescription(guildState.looping ? 'Now looping the current song.' : 'No longer looping the current song.')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
};