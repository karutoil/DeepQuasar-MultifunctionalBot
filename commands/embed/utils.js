// Common utilities for embed commands
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const EmbedCreatorModel = require('../../models/embedCreatorModel');

/**
 * Parse JSON string into an embed
 * @param {string} jsonStr - JSON string to parse
 * @returns {EmbedBuilder|null} Embed object or null if invalid
 */
function parseEmbedJson(jsonStr) {
    try {
        // Parse JSON string
        const data = JSON.parse(jsonStr);
        
        // Check if the JSON has an 'embed' property or is directly an embed
        const embedData = data.embed || data;
        
        // Create embed from data
        return EmbedBuilder.from(embedData);
    } catch (error) {
        console.error('Error parsing embed JSON:', error);
        return null;
    }
}

/**
 * Check if a user can manage embeds (has manage messages permission)
 * @param {Interaction} interaction - The Discord interaction object
 * @param {boolean} sendReply - Whether to automatically send a reply on failure
 * @returns {boolean} Whether the user has permission
 */
async function checkPermissions(interaction, sendReply = true) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (sendReply) {
            await interaction.reply({ 
                content: "You don't have permission to use this command!", 
                ephemeral: true 
            });
        }
        return false;
    }
    return true;
}

/**
 * Find an embed message from the database or by searching channels
 * @param {Client} client - Discord client
 * @param {string} messageId - ID of the message to find
 * @param {string} guildId - ID of the guild to search in
 * @param {Object} embedCreatorModel - Database model for embeds
 * @returns {Promise<{message: Message, channel: Channel, embedJson: string}|null>} The message or null if not found
 */
async function findEmbedMessage(client, messageId, guildId, embedCreatorModel) {
    // If embedCreatorModel is not an instance, create one
    if (!embedCreatorModel || typeof embedCreatorModel.getEmbed !== 'function') {
        embedCreatorModel = new EmbedCreatorModel();
    }
    
    // Try to parse the message ID as a number
    const messageIdInt = parseInt(messageId);
    if (isNaN(messageIdInt)) {
        return null;
    }
    
    // Try to get from database first
    const record = await embedCreatorModel.getEmbed(messageIdInt);
    if (record) {
        try {
            const channel = await client.channels.fetch(record.channelId).catch(() => null);
            if (!channel) return null;
            
            const message = await channel.messages.fetch(messageIdInt).catch(() => null);
            if (!message) return null;
            
            return { message, channel, embedJson: record.embedJson, record };
        } catch (error) {
            console.error('Error fetching embed from database:', error);
            return null;
        }
    }
    
    // If not in database, try to find in guild channels
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;
    
    for (const [, channel] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
        try {
            const message = await channel.messages.fetch(messageIdInt).catch(() => null);
            if (message && message.embeds && message.embeds.length > 0) {
                const embedJson = JSON.stringify(message.embeds[0].toJSON(), null, 2);
                return { message, channel, embedJson };
            }
        } catch (error) {
            // Continue to next channel
        }
    }
    
    return null;
}

module.exports = {
    parseEmbedJson,
    checkPermissions,
    findEmbedMessage
};