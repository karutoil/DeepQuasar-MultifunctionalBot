const { getDb } = require('./database');
const config = require('../config');

/**
 * Welcome/Leave module for tracking join/leave messages
 */
class WelcomeLeaveModel {
    constructor() {
        this.collection = getDb().collection(config.mongodb.collections.welcomeLeave);
    }

    /**
     * Set the welcome channel for a guild
     * @param {string} guildId - Discord Guild ID
     * @param {string} channelId - Discord Channel ID for welcome messages
     * @returns {Promise<object>} MongoDB update result
     */
    async setWelcomeChannel(guildId, channelId) {
        return await this.collection.updateOne(
            { guild_id: guildId },
            { $set: { welcome_channel_id: channelId } },
            { upsert: true }
        );
    }

    /**
     * Set the leave channel for a guild
     * @param {string} guildId - Discord Guild ID
     * @param {string} channelId - Discord Channel ID for leave messages
     * @returns {Promise<object>} MongoDB update result
     */
    async setLeaveChannel(guildId, channelId) {
        return await this.collection.updateOne(
            { guild_id: guildId },
            { $set: { leave_channel_id: channelId } },
            { upsert: true }
        );
    }

    /**
     * Get the welcome and leave channels for a guild
     * @param {string} guildId - Discord Guild ID
     * @returns {Promise<Array>} Array with [welcomeChannelId, leaveChannelId]
     */
    async getChannels(guildId) {
        const doc = await this.collection.findOne({ guild_id: guildId });
        if (doc) {
            return [doc.welcome_channel_id, doc.leave_channel_id];
        }
        return [null, null];
    }
}

module.exports = new WelcomeLeaveModel();