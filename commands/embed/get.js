// Get embed JSON from existing messages
const embedCreatorModel = require('../../models/embedCreatorModel');
const { checkPermissions, findEmbedMessage } = require('./utils');
const { logContentDetails, ensureStringMessageId } = require('../../utils/embedContentDebug');

/**
 * Get the JSON for an existing embed
 * @param {Interaction} interaction - The Discord interaction object
 */
async function getEmbedJson(interaction) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    const messageId = interaction.options.getString('message_id');
    
    // Add debug logging
    /* console.log(`[GET] Looking for message with ID: ${messageId} in guild: ${interaction.guildId}`) */;
    
    try {
        // Find the message
        const result = await findEmbedMessage(
            interaction.client,
            messageId,
            interaction.guildId,
            embedCreatorModel
        );
        
        if (!result) {
            /* console.log(`[GET] Message not found for ID: ${messageId}`) */;
            return await interaction.reply({ 
                content: "Message not found or no embed.", 
                ephemeral: true 
            });
        }
        
        /* console.log(`[GET] Found message for ID: ${messageId}, has content: ${!!result.content}`) */;
        
        const { embedJson, content } = result;
        
        // Log detailed content information
        logContentDetails('get.js', messageId, content);
        
        // Create a full JSON object that includes both the embed and content
        let fullJsonObject;
        try {
            // Try to parse the embed JSON to check if it already contains content
            const parsedEmbed = JSON.parse(embedJson);
            
            // Debug the parsed JSON
            /* console.log('[GET] Parsed embed JSON structure:', {
                hasEmbedProperty: 'embed' in parsedEmbed,
                hasContentProperty: 'content' in parsedEmbed,
                jsonKeysCount: Object.keys(parsedEmbed).length,
                jsonKeys: Object.keys(parsedEmbed)
            }) */;
            
            // If the embedJson already has content field, use it as is
            if ('content' in parsedEmbed) {
                fullJsonObject = parsedEmbed;
            } else if ('embed' in parsedEmbed) {
                // If it has an embed property but no content, add the content
                fullJsonObject = {
                    ...parsedEmbed,
                    content: content || undefined
                };
            } else {
                // If it's just a raw embed with no structure, wrap it
                fullJsonObject = {
                    embed: parsedEmbed,
                    content: content || undefined
                };
            }
        } catch (error) {
            console.error('Error parsing embed JSON in get command:', error);
            // Fallback to original JSON if parsing fails
            fullJsonObject = { 
                embed: JSON.parse(embedJson),
                content: content || undefined 
            };
        }
        
        // Convert to formatted JSON string
        const jsonStr = JSON.stringify(fullJsonObject, null, 2);
        
        await interaction.reply({ 
            content: `\`\`\`json\n${jsonStr}\n\`\`\``, 
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