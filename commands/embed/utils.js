// Common utilities for embed commands
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const EmbedCreatorModel = require('../../models/embedCreatorModel');
const { logContentDetails, ensureStringMessageId } = require('../../utils/embedContentDebug');

/**
 * Parse JSON string into an embed
 * @param {string} jsonStr - JSON string to parse
 * @returns {{embed: EmbedBuilder, content: string}|null} Embed object and content or null if invalid
 */
function parseEmbedJson(jsonStr) {
    try {
        // Parse JSON string
        const data = JSON.parse(jsonStr);
        
        // Check if the JSON has an 'embed' property or is directly an embed
        const embedData = data.embed || data;
        
        // Check if content is included in the JSON
        const content = data.content || '';
        
        // Use our debug helper to log content details
        logContentDetails('parseEmbedJson', 'json_parsing', content);
        
        // Create embed from data
        const embed = EmbedBuilder.from(embedData);
        
        // Return both embed and content
        return { embed, content };
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
    
    // Ensure we're working with a string ID to preserve precision
    const messageIdStr = ensureStringMessageId(messageId);
    /* console.log(`Looking for message with ID: ${messageIdStr} in guild: ${guildId}`) */;
    
    // Try to get from database first
    const record = await embedCreatorModel.getEmbed(messageIdStr);
    if (record) {
        /* console.log(`Found message in database for ID: ${messageIdStr}`) */;
        try {
            const channel = await client.channels.fetch(record.channelId).catch((err) => {
                console.error(`Failed to fetch channel ${record.channelId}:`, err.message);
                return null;
            });
            if (!channel) {
                console.error(`Channel not found: ${record.channelId}`);
                return null;
            }
            
            const message = await channel.messages.fetch(messageIdStr).catch((err) => {
                console.error(`Failed to fetch message ${messageIdStr} in channel ${channel.name}:`, err.message);
                return null;
            });
            if (!message) {
                console.error(`Message not found in channel: ${messageIdStr}`);
                return null;
            }
            
            // Log the content from database with more details
            logContentDetails('database record', messageIdStr, record.content);
            
            // Also log the raw message content
            logContentDetails('message (from DB fetch)', messageIdStr, message.content);
            
            return { 
                message, 
                channel, 
                embedJson: record.embedJson, 
                record,
                // Always use the raw message content when possible
                content: message.content || record.content || '' 
            };
        } catch (error) {
            console.error('Error fetching embed from database:', error);
            return null;
        }
    }
    
    // If not in database, try to find in guild channels
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        /* console.log(`Guild not found: ${guildId}`) */;
        return null;
    }
    
    // Debug text channels in the guild
    /* console.log(`Searching for message in ${guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size} text channels`) */;
    
    for (const [, channel] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
        try {
            /* console.log(`Checking channel: ${channel.name} (${channel.id})`) */;
            const message = await channel.messages.fetch(messageIdStr).catch((err) => {
                /* console.log(`Could not fetch message in channel ${channel.name}: ${err.message}`) */;
                return null;
            });
            if (message && message.embeds && message.embeds.length > 0) {
                const embedJson = JSON.stringify(message.embeds[0].toJSON(), null, 2);
                
                // Use our debug helper to log content details
                logContentDetails('message (from channel search)', messageIdStr, message.content);
                
                return { 
                    message, 
                    channel, 
                    embedJson,
                    // Always use the raw message content
                    content: message.content || '' 
                };
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