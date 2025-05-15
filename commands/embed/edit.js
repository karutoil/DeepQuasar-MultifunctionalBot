// Edit existing embeds
const { PermissionFlagsBits } = require('discord.js');
const embedCreatorModel = require('../../models/embedCreatorModel');
const { parseEmbedJson, checkPermissions, findEmbedMessage } = require('./utils');
const { logContentDetails, ensureStringMessageId } = require('../../utils/embedContentDebug');

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
    const newContent = interaction.options.getString('content');
    
    // Ensure message ID is properly handled as a string
    const messageIdStr = ensureStringMessageId(messageId);
    
    try {
        // Find the message
        const result = await findEmbedMessage(
            interaction.client,
            messageIdStr,
            interaction.guildId,
            embedCreatorModel
        );
        
        if (!result) {
            return await interaction.reply({ 
                content: "Message not found or no embed.", 
                flags: 64 
            });
        }
        
        const { message, record } = result;
        
        // Check if user is allowed to edit
        if (record && interaction.user.id !== record.authorId && 
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: "You can only edit embeds you created unless you're an administrator.", 
                flags: 64 
            });
        }
        
        // Parse new embed
        const parsed = parseEmbedJson(newJson);
        if (!parsed) {
            return await interaction.reply({ 
                content: "Invalid embed JSON.", 
                flags: 64 
            });
        }
        
        // Extract embed and potentially content from JSON
        const { embed, content: jsonContent } = parsed;
        
        // Determine which content to use (priority: explicitly provided > from JSON > existing)
        let finalContent = result.content; // Default to existing content
        
        if (newContent !== undefined) {
            // Explicitly provided content takes highest priority
            finalContent = newContent;
        } else if (jsonContent) {
            // Content from JSON is next priority
            finalContent = jsonContent;
        }
        
        // Log detailed content information
        logContentDetails('edit.js (before edit)', messageIdStr, finalContent);
        
        // Edit the message
        await message.edit({ 
            content: finalContent, 
            embeds: [embed] 
        });
        
        // Update in database - use string messageId to preserve precision
        await embedCreatorModel.updateEmbed(
            messageId.toString(), 
            newJson, 
            finalContent
        );
        
        await interaction.reply({ 
            content: "Embed updated successfully!", 
            flags: 64 
        });
    } catch (error) {
        console.error('Error editing embed:', error);
        await interaction.reply({ 
            content: "An error occurred while editing the embed.", 
            flags: 64 
        });
    }
}

module.exports = { editEmbed };