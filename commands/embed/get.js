// Get embed JSON from existing messages
const embedCreatorModel = require('../../models/embedCreatorModel');
const { checkPermissions, findEmbedMessage } = require('./utils');

/**
 * Get the JSON for an existing embed
 * @param {Interaction} interaction - The Discord interaction object
 */
async function getEmbedJson(interaction) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    const messageId = interaction.options.getString('message_id');
    
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
        
        const { embedJson } = result;
        
        await interaction.reply({ 
            content: `\`\`\`json\n${embedJson}\n\`\`\``, 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error getting embed JSON:', error);
        await interaction.reply({ 
            content: "An error occurred while trying to get the embed JSON.", 
            ephemeral: true 
        });
    }
}

module.exports = { getEmbedJson };