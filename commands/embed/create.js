// Create embeds from JSON
const embedCreatorModel = require('../../models/embedCreatorModel');
const { parseEmbedJson, checkPermissions } = require('./utils');

/**
 * Create a new embed from JSON and post it to a channel
 * @param {Interaction} interaction - The Discord interaction object
 */
async function createEmbed(interaction) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    // Get options
    const jsonInput = interaction.options.getString('json_input');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const messageContent = interaction.options.getString('content') || '';
    
    // Parse embed
    const parsed = parseEmbedJson(jsonInput);
    if (!parsed) {
        return await interaction.reply({ 
            content: "Invalid embed JSON. Please check your input.", 
            flags: 64 
        });
    }
    
    // Extract embed and potentially content from JSON
    const { embed, content: jsonContent } = parsed;
    
    // Use explicitly provided content or content from JSON
    const finalContent = messageContent || jsonContent || '';
    
    /* console.log('Creating embed with content:', {
        hasCommandContent: !!messageContent,
        hasJsonContent: !!jsonContent,
        finalContent: finalContent || '(empty)',
        contentSource: messageContent ? 'command' : jsonContent ? 'json' : 'none'
    }) */;
    
    try {
        // Send the embed
        const message = await channel.send({ 
            content: finalContent,
            embeds: [embed] 
        });
        
        // Store in database
        await embedCreatorModel.storeEmbed(
            message.id,
            channel.id,
            interaction.guildId,
            jsonInput,
            interaction.user.id,
            messageContent
        );
        
        await interaction.reply({ 
            content: `Embed posted in ${channel}! Message ID: \`${message.id}\``, 
            flags: 64 
        });
    } catch (error) {
        console.error('Error creating embed:', error);
        await interaction.reply({ 
            content: "I don't have permission to send messages there, or the JSON is malformed.", 
            flags: 64 
        });
    }
}

module.exports = { createEmbed };