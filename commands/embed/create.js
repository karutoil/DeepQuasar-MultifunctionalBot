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
    
    // Parse embed
    const embed = parseEmbedJson(jsonInput);
    if (!embed) {
        return await interaction.reply({ 
            content: "Invalid embed JSON. Please check your input.", 
            ephemeral: true 
        });
    }
    
    try {
        // Send the embed
        const message = await channel.send({ embeds: [embed] });
        
        // Store in database
        await embedCreatorModel.storeEmbed(
            message.id,
            channel.id,
            interaction.guildId,
            jsonInput,
            interaction.user.id
        );
        
        await interaction.reply({ 
            content: `Embed posted in ${channel}! Message ID: \`${message.id}\``, 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error creating embed:', error);
        await interaction.reply({ 
            content: "I don't have permission to send messages there, or the JSON is malformed.", 
            ephemeral: true 
        });
    }
}

module.exports = { createEmbed };