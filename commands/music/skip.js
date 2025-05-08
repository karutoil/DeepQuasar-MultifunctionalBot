const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        
        // Check if user is in a voice channel
        const check = voiceChannelCheck(interaction, 'skip');
        if (!check.pass) {
            return interaction.reply({ embeds: [check.embed], ephemeral: true });
        }
        
        // Check if user has DJ permissions
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
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Nothing Playing')
                .setDescription('There is nothing currently playing to skip.')
                .setTimestamp();
            return interaction.reply({ embeds: [errorEmbed] });
        }
        
        const currentTrack = player.queue.current;
        const trackTitle = currentTrack ? (currentTrack.title || 'the current song') : 'the current song';
        
        await player.skip();
        
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('⏭️ Skipped')
            .setDescription(`Skipped **${trackTitle}**`)
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
};