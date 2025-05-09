const { getDb } = require('./database');
const config = require('../config');

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
        return await this.collection.updateOne(
            { message_id: messageId },
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
        const doc = await this.collection.findOne({ message_id: messageId });
        if (doc) {
            return {
                channelId: doc.channel_id,
                guildId: doc.guild_id,
                embedJson: doc.embed_json,
                authorId: doc.author_id,
                content: doc.content || ''
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
        const updateObj = { embed_json: newJson };
        
        // Only update content if it was provided
        if (content !== null) {
            updateObj.content = content;
        }
        
        return await this.collection.updateOne(
            { message_id: messageId },
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
        return await this.templateCollection.updateOne(
            { name: name, guild_id: guildId },
            {
                $set: {
                    embed_json: embedJson,
                    author_id: authorId,
                    created_at: new Date(),
                    content: content
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
            return {
                name: doc.name,
                embedJson: doc.embed_json,
                authorId: doc.author_id,
                createdAt: doc.created_at,
                content: doc.content || ''
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