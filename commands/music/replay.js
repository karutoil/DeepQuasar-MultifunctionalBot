const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'replay');
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
                .setDescription('There is nothing currently playing to replay.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        const currentTrack = player.queue.current;
        if (!currentTrack) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ No Current Track')
                .setDescription('Failed to get current track information.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        // Seek to start of track
        await player.seek(0);
        
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🔄 Replaying')
            .setDescription(`Replaying **${currentTrack.title || 'current track'}** from the beginning.`)
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
};