const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');

// Move a track from one position to another in the queue
async function move(interaction, client) {
    const guildId = interaction.guildId;
    
    // Check if user is in a voice channel
    const check = voiceChannelCheck(interaction, 'move');
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
            .setDescription('There are no tracks in the queue to move.')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    const fromPos = interaction.options.getInteger('from_pos');
    const toPos = interaction.options.getInteger('to_pos');
    
    // Validate positions
    if (fromPos > player.queue.tracks.length || toPos > player.queue.tracks.length) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Invalid Position')
            .setDescription(`The queue only has ${player.queue.tracks.length} track${player.queue.tracks.length !== 1 ? 's' : ''}.`)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Get track at fromPos (convert from 1-based to 0-based)
    const track = player.queue.tracks[fromPos - 1];
    const trackTitle = track.title || `Track #${fromPos}`;
    
    // Remove track from original position
    player.queue.remove(fromPos - 1);
    
    // Add track at new position
    player.queue.add(track, toPos - 1);
    
    const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🔀 Track Moved')
        .setDescription(`Moved **${trackTitle}** from position ${fromPos} to ${toPos}.`)
        .setTimestamp();
    
    return interaction.reply({ embeds: [embed] });
}

// Remove a track from the queue by position
async function remove(interaction, client) {
    const guildId = interaction.guildId;
    
    // Check if user is in a voice channel
    const check = voiceChannelCheck(interaction, 'remove');
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
            .setDescription('There are no tracks in the queue to remove.')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    const position = interaction.options.getInteger('position');
    
    // Validate position
    if (position > player.queue.tracks.length) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Invalid Position')
            .setDescription(`The queue only has ${player.queue.tracks.length} track${player.queue.tracks.length !== 1 ? 's' : ''}.`)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
    
    // Get track info before removing (convert from 1-based to 0-based)
    const track = player.queue.tracks[position - 1];
    const trackTitle = track.title || `Track #${position}`;
    
    // Remove track from queue
    player.queue.remove(position - 1);
    
    const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🗑️ Track Removed')
        .setDescription(`Removed **${trackTitle}** from queue position ${position}.`)
        .setTimestamp();
    
    return interaction.reply({ embeds: [embed] });
}

module.exports = {
    move,
    remove
};