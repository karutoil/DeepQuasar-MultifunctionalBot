const { getDb } = require('./database');

class UpdateNotifierModel {
    constructor() {
        // Lazy initialization
        this._collection = null;
    }

    // Getter for lazy initialization
    get collection() {
        if (!this._collection) {
            this._collection = getDb().collection('update_notifier');
        }
        return this._collection;
    }

    /**
     * Get the update notification settings
     * @returns {Promise<Object>} Update notifier configuration
     */
    async getConfig() {
        const config = await this.collection.findOne({ key: 'config' });
        return config || {
            key: 'config',
            enabled: true,
            owner_id_override: null,
            github_api_token: null,
            last_check_time: null,
            last_notification_time: null
        };
    }

    /**
     * Save update notification settings
     * @param {Object} config - Configuration object
     * @returns {Promise<Object>} Result of the update operation
     */
    async saveConfig(config) {
        return await this.collection.updateOne(
            { key: 'config' },
            { $set: config },
            { upsert: true }
        );
    }

    /**
     * Enable or disable update notifications
     * @param {boolean} enabled - Whether notifications are enabled
     * @returns {Promise<Object>} Result of the update operation
     */
    async setEnabled(enabled) {
        return await this.collection.updateOne(
            { key: 'config' },
            { $set: { enabled: !!enabled } },
            { upsert: true }
        );
    }

    /**
     * Set the GitHub API token
     * @param {string|null} token - GitHub API token or null to remove
     * @returns {Promise<Object>} Result of the update operation
     */
    async setGitHubToken(token) {
        return await this.collection.updateOne(
            { key: 'config' },
            { $set: { github_api_token: token } },
            { upsert: true }
        );
    }

    /**
     * Set the owner ID override
     * @param {string|null} ownerId - Discord user ID or null to use the app owner
     * @returns {Promise<Object>} Result of the update operation
     */
    async setOwnerIdOverride(ownerId) {
        return await this.collection.updateOne(
            { key: 'config' },
            { $set: { owner_id_override: ownerId } },
            { upsert: true }
        );
    }

    /**
     * Update the last check time
     * @returns {Promise<Object>} Result of the update operation
     */
    async updateLastCheckTime() {
        return await this.collection.updateOne(
            { key: 'config' },
            { $set: { last_check_time: new Date() } },
            { upsert: true }
        );
    }

    /**
     * Update the last notification time
     * @returns {Promise<Object>} Result of the update operation
     */
    async updateLastNotificationTime() {
        return await this.collection.updateOne(
            { key: 'config' },
            { $set: { last_notification_time: new Date() } },
            { upsert: true }
        );
    }
}

// Export a function that returns a singleton instance
let instance = null;
module.exports = function() {
    if (!instance) {
        instance = new UpdateNotifierModel();
    }
    return instance;
};