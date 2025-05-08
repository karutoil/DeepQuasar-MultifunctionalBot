const database = require('./database');

/**
 * LocalAI model for interacting with local AI services
 */
module.exports = {
    /**
     * Set LocalAI config for a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} apiBase - Base URL for API
     * @param {string} apiKey - API key (optional)
     * @param {string} modelName - Model name
     * @returns {Promise<void>}
     */
    async setConfig(guildId, apiBase, apiKey = null, modelName = 'llama3') {
        const db = database.getDb();
        await db.collection('localAI').updateOne(
            { guildId: guildId },
            {
                $set: {
                    guildId: guildId,
                    apiBase: apiBase,
                    apiKey: apiKey,
                    modelName: modelName,
                    enabled: true // Enable by default when configured
                }
            },
            { upsert: true }
        );
    },

    /**
     * Get LocalAI config for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<Object|null>} - Config object or null
     */
    async getConfig(guildId) {
        const db = database.getDb();
        return await db.collection('localAI').findOne({ guildId: guildId });
    },

    /**
     * Set system prompt for a guild
     * @param {string} guildId - Discord guild ID
     * @param {string} systemPrompt - System prompt text
     * @returns {Promise<void>}
     */
    async setSystemPrompt(guildId, systemPrompt) {
        const db = database.getDb();
        await db.collection('localAI').updateOne(
            { guildId: guildId },
            {
                $set: {
                    systemPrompt: systemPrompt
                }
            },
            { upsert: true }
        );
    },

    /**
     * Get system prompt for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<string|null>} - System prompt or null
     */
    async getSystemPrompt(guildId) {
        const config = await this.getConfig(guildId);
        return config?.systemPrompt || null;
    },

    /**
     * Enable or disable AI for a guild
     * @param {string} guildId - Discord guild ID
     * @param {boolean} enabled - Enable flag
     * @returns {Promise<void>}
     */
    async setEnabled(guildId, enabled) {
        const db = database.getDb();
        await db.collection('localAI').updateOne(
            { guildId: guildId },
            {
                $set: {
                    enabled: enabled
                }
            },
            { upsert: true }
        );
    },

    /**
     * Check if AI is enabled for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<boolean>} - True if enabled
     */
    async isEnabled(guildId) {
        const config = await this.getConfig(guildId);
        return config?.enabled || false;
    },

    /**
     * Add a channel to whitelist
     * @param {string} guildId - Discord guild ID
     * @param {string} channelId - Channel ID to whitelist
     * @returns {Promise<void>}
     */
    async addWhitelistedChannel(guildId, channelId) {
        const db = database.getDb();
        await db.collection('localAI').updateOne(
            { guildId: guildId },
            {
                $addToSet: {
                    whitelistedChannels: channelId
                }
            },
            { upsert: true }
        );
    },

    /**
     * Remove a channel from whitelist
     * @param {string} guildId - Discord guild ID
     * @param {string} channelId - Channel ID to remove
     * @returns {Promise<void>}
     */
    async removeWhitelistedChannel(guildId, channelId) {
        const db = database.getDb();
        await db.collection('localAI').updateOne(
            { guildId: guildId },
            {
                $pull: {
                    whitelistedChannels: channelId
                }
            }
        );
    },

    /**
     * Get all whitelisted channels for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<Array<string>>} - Array of channel IDs
     */
    async getWhitelistedChannels(guildId) {
        const config = await this.getConfig(guildId);
        return config?.whitelistedChannels || [];
    },

    /**
     * Check if a channel is whitelisted
     * @param {string} guildId - Discord guild ID
     * @param {string} channelId - Channel ID to check
     * @returns {Promise<boolean>} - True if whitelisted
     */
    async isChannelWhitelisted(guildId, channelId) {
        const channels = await this.getWhitelistedChannels(guildId);
        return channels.includes(channelId);
    },

    /**
     * Set response chance for a guild
     * @param {string} guildId - Discord guild ID
     * @param {number} chance - Chance percentage (0-100)
     * @returns {Promise<void>}
     */
    async setResponseChance(guildId, chance) {
        const db = database.getDb();
        await db.collection('localAI').updateOne(
            { guildId: guildId },
            {
                $set: {
                    responseChance: chance
                }
            },
            { upsert: true }
        );
    },

    /**
     * Get response chance for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<number>} - Chance percentage (0-100)
     */
    async getResponseChance(guildId) {
        const config = await this.getConfig(guildId);
        return config?.responseChance !== undefined ? config.responseChance : 25; // Default to 25%
    }
};