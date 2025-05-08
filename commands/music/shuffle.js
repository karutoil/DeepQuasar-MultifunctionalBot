const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'shuffle');
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
        
        if (!player || !player.queue || player.queue.tracks.length < 2) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Not Enough Tracks')
                .setDescription('There are not enough tracks in the queue to shuffle.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        player.queue.shuffle();
        
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🔀 Queue Shuffled')
            .setDescription(`Shuffled ${player.queue.tracks.length} tracks in the queue.`)
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
};