const { getDb } = require('./database');
const config = require('../config');

/**
 * EmbedCreator model for managing custom embeds
 */
class EmbedCreatorModel {
    constructor() {
        this.collection = getDb().collection(config.mongodb.collections.embedCreator);
    }

    /**
     * Store an embed in the database
     * @param {string} messageId - Discord Message ID
     * @param {string} channelId - Discord Channel ID 
     * @param {string} guildId - Discord Guild ID
     * @param {string} embedJson - JSON string of the embed
     * @param {string} authorId - Discord User ID of creator
     * @returns {Promise<object>} MongoDB update result
     */
    async storeEmbed(messageId, channelId, guildId, embedJson, authorId) {
        return await this.collection.updateOne(
            { message_id: messageId },
            { 
                $set: {
                    channel_id: channelId,
                    guild_id: guildId,
                    embed_json: embedJson,
                    author_id: authorId
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
                authorId: doc.author_id
            };
        }
        return null;
    }

    /**
     * Update an existing embed's JSON
     * @param {string} messageId - Discord Message ID
     * @param {string} newJson - New JSON string for the embed
     * @returns {Promise<object>} MongoDB update result
     */
    async updateEmbed(messageId, newJson) {
        return await this.collection.updateOne(
            { message_id: messageId },
            { $set: { embed_json: newJson } }
        );
    }
}

module.exports = new EmbedCreatorModel();