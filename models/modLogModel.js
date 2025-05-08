const database = require('./database');

// Default modlog events configuration
const DEFAULT_EVENTS = {
    message_edit: true,
    message_delete: true,
    member_update: true,
    role_change: true,
    role_create: true,
    role_delete: true,
    voice_state_update: true,
    member_join: true,
    member_remove: true,
    channel_update: true,
    channel_create: true,
    channel_delete: true,
    guild_update: true,
    emoji_update: true,
    sticker_update: false,
    invite_create: false,
    invite_delete: false,
    thread_create: false,
    thread_delete: false,
    thread_update: false,
    admin_command: true,
    command: false
};

const modLogModel = {
    /**
     * Initialize the modlog collection
     */
    async init() {
        // Create the modlogs collection if it doesn't exist
        const db = await database.getDb();
        
        const collections = await db.listCollections({ name: 'modlogs' }).toArray();
        if (collections.length === 0) {
            await db.createCollection('modlogs');
            console.log('Created modlogs collection');
        }
    },
    
    /**
     * Get modlog settings for a guild
     * @param {string} guildId - The Discord guild ID
     * @returns {Promise<object>} The guild's modlog settings, or null if not found
     */
    async getGuildSettings(guildId) {
        const db = await database.getDb();
        const result = await db.collection('modlogs').findOne({ guildId });
        
        return result || null;
    },
    
    /**
     * Set the log channel for a guild
     * @param {string} guildId - The Discord guild ID
     * @param {string} channelId - The Discord channel ID
     * @returns {Promise<object>} The operation result
     */
    async setLogChannel(guildId, channelId) {
        const db = await database.getDb();
        
        const result = await db.collection('modlogs').updateOne(
            { guildId },
            { $set: { guildId, logChannelId: channelId } },
            { upsert: true }
        );
        
        return result;
    },
    
    /**
     * Remove the log channel for a guild
     * @param {string} guildId - The Discord guild ID
     * @returns {Promise<object>} The operation result
     */
    async removeLogChannel(guildId) {
        const db = await database.getDb();
        
        const result = await db.collection('modlogs').updateOne(
            { guildId },
            { $set: { logChannelId: null } }
        );
        
        return result;
    },
    
    /**
     * Set enabled events for a guild
     * @param {string} guildId - The Discord guild ID
     * @param {object} enabledEvents - Object containing event name keys and boolean values
     * @returns {Promise<object>} The operation result
     */
    async setEnabledEvents(guildId, enabledEvents) {
        const db = await database.getDb();
        
        const result = await db.collection('modlogs').updateOne(
            { guildId },
            { $set: { enabledEvents } },
            { upsert: true }
        );
        
        return result;
    },
    
    /**
     * Toggle a specific modlog event for a guild
     * @param {string} guildId - The Discord guild ID
     * @param {string} eventName - The event name
     * @param {boolean} enabled - Whether the event is enabled
     * @returns {Promise<object>} The operation result
     */
    async toggleEvent(guildId, eventName, enabled) {
        const db = await database.getDb();
        
        // First, make sure the document exists
        await db.collection('modlogs').updateOne(
            { guildId },
            { $setOnInsert: { guildId } },
            { upsert: true }
        );
        
        // Then set the specific event
        const updateField = {};
        updateField[`enabledEvents.${eventName}`] = enabled;
        
        const result = await db.collection('modlogs').updateOne(
            { guildId },
            { $set: updateField }
        );
        
        return result;
    }
};

module.exports = { modLogModel, DEFAULT_EVENTS };