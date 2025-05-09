const { EmbedBuilder } = require('discord.js');
const musicModel = require('../../models/musicModel');

// DJ role management functions
async function setDJ(interaction, client) {
    // Check for admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Permission Denied')
            .setDescription('You need administrator permissions to set DJ roles.')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;
    
    try {
        // Use musicModel to save DJ role
        await musicModel.setDJRole(guildId, role.id);
        
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🎧 DJ Role Set')
            .setDescription(`Set <@&${role.id}> as the DJ role.`)
            .setFooter({ text: 'Only users with this role (or admins) can use music commands now.' })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error setting DJ role:', error);
        return interaction.reply({ content: 'Failed to set DJ role.', ephemeral: true });
    }
}

async function clearDJ(interaction, client) {
    // Check for admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Permission Denied')
            .setDescription('You need administrator permissions to clear DJ roles.')
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    const guildId = interaction.guildId;
    
    try {
        // Use musicModel to clear DJ role
        await musicModel.clearDJRole(guildId);
        
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🎧 DJ Role Cleared')
            .setDescription('Anyone can now use music commands in this server.')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error clearing DJ role:', error);
        return interaction.reply({ content: 'Failed to clear DJ role.', ephemeral: true });
    }
}

module.exports = {
    setDJ,
    clearDJ
};