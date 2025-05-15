const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'clear');
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
        
        if (!player || !player.queue || player.queue.tracks.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Empty Queue')
                .setDescription('There are no tracks in the queue to clear.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        const trackCount = player.queue.tracks.length;
        player.queue.clear();
        
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🧹 Queue Cleared')
            .setDescription(`Removed ${trackCount} track${trackCount !== 1 ? 's' : ''} from the queue.`)
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
};