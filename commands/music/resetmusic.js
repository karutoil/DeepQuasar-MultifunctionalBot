const { EmbedBuilder } = require('discord.js');
const { voiceChannelCheck } = require('./utils');
const musicModel = require('../../models/musicModel');
const { isBotOwner } = require('../../utils/common');
const fs = require('fs');
const path = require('path');

// Check if user has admin or bot owner permissions
async function checkAdminPermission(interaction) {
    // Check if user is a bot owner
    if (isBotOwner(interaction.user.id)) {
        return true;
    }
    
    // Check if user has admin permissions
    if (!interaction.member.permissions.has('Administrator')) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Permission Denied')
            .setDescription('You need Administrator permission to use this command.')
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return false;
    }
    return true;
}

// Reset the Lavalink connection
async function execute(interaction, client) {
    // Check for admin permissions
    if (!await checkAdminPermission(interaction)) return;
    
    await interaction.deferReply();
    
    try {
        const manager = client.musicManager;
        
        // Check if there's any active players
        if (manager.players.size > 0) {
            const playersInfo = Array.from(manager.players.values()).map(player => {
                return `• Server: ${player.guild?.name || player.guildId} (${player.playing ? 'Playing' : 'Paused'})`;
            }).join('\n');
            
            const warningEmbed = new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle('⚠️ Active Players Detected')
                .setDescription(`There are currently ${manager.players.size} active music players. Resetting will stop all playback.\n\n${playersInfo}`)
                .setFooter({ text: 'Use /resetmusic confirm:true to proceed anyway' })
                .setTimestamp();
            
            const confirmOption = interaction.options.getBoolean('confirm');
            if (!confirmOption) {
                return interaction.editReply({ embeds: [warningEmbed] });
            }
        }
        
        // Destroy all players
        const playerCount = manager.players.size;
        manager.players.forEach(player => {
            player.destroy();
        });
        
        // Reset the manager's connection to Lavalink
        if (manager.nodeManager) {
            const nodes = manager.nodeManager.nodes;
            for (const [, node] of nodes) {
                try {
                    if (node.connected) {
                        await node.disconnect();
                    }
                } catch (err) {
                    console.error('Error disconnecting node:', err);
                }
            }
        }
        
        // Reinitialize the connection
        await manager.init(client.user.id);
        
        const successEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🔄 Music System Reset')
            .setDescription(`Successfully reset the music system.${playerCount > 0 ? ` Stopped ${playerCount} active players.` : ''}`)
            .setFooter({ text: 'You may need to rejoin voice channels to continue playing music' })
            .setTimestamp();
        
        return interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
        console.error('Error resetting music system:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error')
            .setDescription(`An error occurred while resetting the music system: ${error.message}`)
            .setTimestamp();
        
        return interaction.editReply({ embeds: [errorEmbed] });
    }
}

module.exports = {
    execute
};
