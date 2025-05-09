const { getDb } = require('./database');
const config = require('../config');
const { logContentDetails, ensureStringMessageId } = require('../utils/embedContentDebug');

/**
 * EmbedCreator model for managing custom embeds
 */
class EmbedCreatorModel {
    constructor() {
        this.collection = getDb().collection(config.mongodb.collections.embedCreator);
        this.templateCollection = getDb().collection(config.mongodb.collections.embedTemplates);
    }

    /**
     * Store an embed in the database
     * @param {string} messageId - Discord Message ID
     * @param {string} channelId - Discord Channel ID 
     * @param {string} guildId - Discord Guild ID
     * @param {string} embedJson - JSON string of the embed
     * @param {string} authorId - Discord User ID of creator
     * @param {string} content - Plain text content to display with the embed
     * @returns {Promise<object>} MongoDB update result
     */
    async storeEmbed(messageId, channelId, guildId, embedJson, authorId, content = '') {
        // Ensure message ID is stored as a string to preserve precision
        const messageIdStr = ensureStringMessageId(messageId);
        
        // Use our debug helper to log content details
        logContentDetails('storeEmbed', messageIdStr, content);
        
        return await this.collection.updateOne(
            { message_id: messageIdStr },
            { 
                $set: {
                    channel_id: channelId,
                    guild_id: guildId,
                    embed_json: embedJson,
                    author_id: authorId,
                    content: content
                }
            },
            { upsert: true }
        );
    }

    /**
     * Get embed data by message ID
     * @param {string} messageId - Discord Message ID
     * @returns {Promise<object|null>} Embed data or null if not found
     */
    async getEmbed(messageId) {
        // Always convert the messageId to string to avoid precision issues
        const messageIdStr = ensureStringMessageId(messageId);
        console.log(`Looking for message in database with string ID: ${messageIdStr}`);
        
        const doc = await this.collection.findOne({ message_id: messageIdStr });
        if (doc) {
            // Ensure content is properly handled for mentions
            const content = doc.content !== undefined ? String(doc.content) : '';
            
            // Use our debug helper for detailed logging
            logContentDetails('getEmbed from DB', messageIdStr, content);
            
            return {
                channelId: doc.channel_id,
                guildId: doc.guild_id,
                embedJson: doc.embed_json,
                authorId: doc.author_id,
                content: content
            };
        }
        return null;
    }

    /**
     * Update an existing embed's JSON
     * @param {string} messageId - Discord Message ID
     * @param {string} newJson - New JSON string for the embed
     * @param {string} content - New plain text content
     * @returns {Promise<object>} MongoDB update result
     */
    async updateEmbed(messageId, newJson, content = null) {
        // Always convert the messageId to string to avoid precision issues
        const messageIdStr = ensureStringMessageId(messageId);
        const updateObj = { embed_json: newJson };
        
        // Only update content if it was provided
        if (content !== null) {
            // Ensure content is properly handled for mentions
            updateObj.content = (content !== undefined) ? String(content) : '';
            
            // Use our debug helper to log content details
            logContentDetails('updateEmbed', messageIdStr, content);
        }
        
        return await this.collection.updateOne(
            { message_id: messageIdStr },
            { $set: updateObj }
        );
    }

    /**
     * Save an embed as a template
     * @param {string} name - Template name
     * @param {string} guildId - Discord Guild ID
     * @param {string} embedJson - JSON string of the embed
     * @param {string} authorId - Discord User ID of creator
     * @param {string} content - Plain text content to include with the embed
     * @returns {Promise<object>} MongoDB update result
     */
    async saveTemplate(name, guildId, embedJson, authorId, content = '') {
        // Ensure content is treated as a string, even if it contains only mentions
        // Special handling for @everyone and other mentions which may appear "empty"
        const contentToSave = (content !== undefined && content !== null) ? String(content) : '';
        
        // Special check for @everyone which may appear empty in some conditions
        const hasEveryoneMention = contentToSave.includes('@everyone') || 
                                  contentToSave.includes('@here') ||
                                  contentToSave.match(/<@&\d+>/g); // Role mention pattern
        
        // Use our debug helper to log content details
        logContentDetails(`saveTemplate (${name})`, 'template', contentToSave);
        
        // Add content to the JSON to ensure it's preserved
        let jsonWithContent;
        try {
            const embedData = JSON.parse(embedJson);
            // Create a new object with both embed and content
            jsonWithContent = JSON.stringify({
                embed: embedData,
                content: contentToSave
            });
        } catch (e) {
            console.error('Error adding content to JSON:', e);
            jsonWithContent = embedJson; // Fallback to original JSON
        }
        
        return await this.templateCollection.updateOne(
            { name: name, guild_id: guildId },
            {
                $set: {
                    embed_json: jsonWithContent, // Use enhanced JSON that includes content
                    author_id: authorId,
                    created_at: new Date(),
                    content: contentToSave
                }
            },
            { upsert: true }
        );
    }

    /**
     * Get a template by name
     * @param {string} name - Template name
     * @param {string} guildId - Discord Guild ID
     * @returns {Promise<object|null>} Template data or null if not found
     */
    async getTemplate(name, guildId) {
        const doc = await this.templateCollection.findOne({ 
            name: name, 
            guild_id: guildId 
        });
        
        if (doc) {
            // Ensure content is properly handled for mentions
            const content = doc.content !== undefined ? String(doc.content) : '';
            
            // Use our debug helper to log content details
            logContentDetails(`getTemplate (${name})`, 'template', content);
            
            return {
                name: doc.name,
                embedJson: doc.embed_json,
                authorId: doc.author_id,
                createdAt: doc.created_at,
                content: content
            };
        }
        return null;
    }

    /**
     * List all templates for a guild
     * @param {string} guildId - Discord Guild ID
     * @returns {Promise<Array>} Array of template objects
     */
    async listTemplates(guildId) {
        const cursor = this.templateCollection.find({ guild_id: guildId });
        const templates = await cursor.toArray();
        
        return templates.map(doc => ({
            name: doc.name,
            authorId: doc.author_id,
            createdAt: doc.created_at,
            hasContent: !!doc.content
        }));
    }

    /**
     * Delete a template
     * @param {string} name - Template name
     * @param {string} guildId - Discord Guild ID
     * @returns {Promise<object>} MongoDB delete result
     */
    async deleteTemplate(name, guildId) {
        return await this.templateCollection.deleteOne({
            name: name,
            guild_id: guildId
        });
    }
}

// Export an instance of the model
module.exports = new EmbedCreatorModel();