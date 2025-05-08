const { getDb } = require('./database');
const config = require('../config');

/**
 * AutoRole model for managing automatic role assignments
 */
class AutoRoleModel {
    constructor() {
        this.collection = getDb().collection(config.mongodb.collections.autoroles);
    }

    /**
     * Get the auto-role for a guild
     * @param {string} guildId - Discord Guild ID
     * @returns {Promise<string|null>} Role ID or null if not set
     */
    async getRoleForGuild(guildId) {
        const doc = await this.collection.findOne({ guild_id: guildId });
        return doc ? doc.role_id : null;
    }

    /**
     * Set the auto-role for a guild
     * @param {string} guildId - Discord Guild ID
     * @param {string} roleId - Discord Role ID to assign
     * @returns {Promise<object>} MongoDB update result
     */
    async setRoleForGuild(guildId, roleId) {
        return await this.collection.updateOne(
            { guild_id: guildId },
            { $set: { role_id: roleId } },
            { upsert: true }
        );
    }

    /**
     * Remove the auto-role configuration for a guild
     * @param {string} guildId - Discord Guild ID
     * @returns {Promise<object>} MongoDB delete result
     */
    async removeRoleForGuild(guildId) {
        return await this.collection.deleteOne({ guild_id: guildId });
    }

    /**
     * Get all auto-role configurations
     * @returns {Promise<object>} Object with guild IDs as keys and role IDs as values
     */
    async getAllRoles() {
        const docs = await this.collection.find({}).toArray();
        const result = {};
        
        for (const doc of docs) {
            result[doc.guild_id] = doc.role_id;
        }
        
        return result;
    }
}

module.exports = new AutoRoleModel();