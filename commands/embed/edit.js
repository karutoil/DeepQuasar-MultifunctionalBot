// Edit existing embeds
const { PermissionFlagsBits } = require('discord.js');
const embedCreatorModel = require('../../models/embedCreatorModel');
const { parseEmbedJson, checkPermissions, findEmbedMessage } = require('./utils');

/**
 * Edit an existing embed
 * @param {Interaction} interaction - The Discord interaction object
 */
async function editEmbed(interaction) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    // Get options
    const messageId = interaction.options.getString('message_id');
    const newJson = interaction.options.getString('new_json');
    
    try {
        // Find the message
        const result = await findEmbedMessage(
            interaction.client,
            messageId,
            interaction.guildId,
            embedCreatorModel
        );
        
        if (!result) {
            return await interaction.reply({ 
                content: "Message not found or no embed.", 
                ephemeral: true 
            });
        }
        
        const { message, record } = result;
        
        // Check if user is allowed to edit
        if (record && interaction.user.id !== record.authorId && 
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: "You can only edit embeds you created unless you're an administrator.", 
                ephemeral: true 
            });
        }
        
        // Parse new embed
        const embed = parseEmbedJson(newJson);
        if (!embed) {
            return await interaction.reply({ 
                content: "Invalid embed JSON.", 
                ephemeral: true 
            });
        }
        
        // Edit the message
        await message.edit({ embeds: [embed] });
        
        // Update in database
        await embedCreatorModel.updateEmbed(parseInt(messageId), newJson);
        
        await interaction.reply({ 
            content: "Embed updated successfully!", 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error editing embed:', error);
        await interaction.reply({ 
            content: "An error occurred while editing the embed.", 
            ephemeral: true 
        });
    }
}

module.exports = { editEmbed };