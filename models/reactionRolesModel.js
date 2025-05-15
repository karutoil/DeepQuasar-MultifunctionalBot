const { getDb } = require('./database');
const config = require('../config');

/**
 * ReactionRoles model for managing role assignment via reactions
 */
class ReactionRolesModel {
    constructor() {
        this.messagesCollection = getDb().collection(config.mongodb.collections.reactionRoleMessages);
        this.rolesCollection = getDb().collection(config.mongodb.collections.reactionRoles);
    }

    /**
     * Add or update a reaction role configuration
     * @param {string} messageId - Discord Message ID
     * @param {string} channelId - Discord Channel ID
     * @param {string} guildId - Discord Guild ID
     * @param {string} title - Title for the reaction roles embed
     * @param {number} color - Embed color in decimal format
     * @param {string} emoji - The emoji to react with
     * @param {string} roleId - Discord Role ID
     * @param {string} description - Optional description for this role
     * @returns {Promise<object>} MongoDB update result
     */
    async addReactionRole(messageId, channelId, guildId, title, color, emoji, roleId, description = null) {
        // Update message info
        await this.messagesCollection.updateOne(
            { message_id: messageId },
            {
                $set: {
                    channel_id: channelId,
                    guild_id: guildId,
                    title: title,
                    color: color
                }
            },
            { upsert: true }
        );

        // Update reaction role
        return await this.rolesCollection.updateOne(
            { message_id: messageId, emoji: String(emoji) },
            {
                $set: {
                    role_id: roleId,
                    description: description
                }
            },
            { upsert: true }
        );
    }

    /**
     * Add or update a button-based role configuration
     * @param {string} messageId - Discord Message ID
     * @param {string} channelId - Discord Channel ID
     * @param {string} guildId - Discord Guild ID
     * @param {string} title - Title for the role embed
     * @param {number} color - Embed color in decimal format
     * @param {string} label - The label for the button
     * @param {string} buttonColor - The button color (primary, secondary, success, danger)
     * @param {string} roleId - Discord Role ID
     * @returns {Promise<object>} MongoDB update result
     */
    async addRoleButton(messageId, channelId, guildId, title, color, label, buttonColor, roleId) {
        // Update message info
        await this.messagesCollection.updateOne(
            { message_id: messageId },
            {
                $set: {
                    channel_id: channelId,
                    guild_id: guildId,
                    title: title,
                    color: color
                }
            },
            { upsert: true }
        );

        // Update button role
        return await this.rolesCollection.updateOne(
            { message_id: messageId, label: label },
            {
                $set: {
                    role_id: roleId,
                    button_color: buttonColor
                }
            },
            { upsert: true }
        );
    }

    /**
     * Get all reaction roles for a message
     * @param {string} messageId - Discord Message ID
     * @returns {Promise<Array>} Array of [emoji, roleId, description] tuples
     */
    async getReactionRoles(messageId) {
        const cursor = await this.rolesCollection.find({ message_id: messageId });
        const docs = await cursor.toArray();
        return docs.map(doc => [doc.emoji, doc.role_id, doc.description]);
    }

    /**
     * Get message information
     * @param {string} messageId - Discord Message ID
     * @returns {Promise<Array|null>} Tuple of [channelId, guildId, title, color] or null
     */
    async getMessageInfo(messageId) {
        const doc = await this.messagesCollection.findOne({ message_id: messageId });
        if (doc) {
            return [doc.channel_id, doc.guild_id, doc.title, doc.color];
        }
        return null;
    }

    /**
     * Remove a specific reaction role
     * @param {string} messageId - Discord Message ID
     * @param {string} emoji - The emoji to remove
     * @returns {Promise<object>} MongoDB delete result
     */
    async removeReactionRole(messageId, emoji) {
        return await this.rolesCollection.deleteOne({ 
            message_id: messageId, 
            emoji: String(emoji) 
        });
    }

    /**
     * Remove all reaction roles and the message info for a message
     * @param {string} messageId - Discord Message ID
     * @returns {Promise<object>} MongoDB delete results
     */
    async removeAllMessageRoles(messageId) {
        await this.rolesCollection.deleteMany({ message_id: messageId });
        return await this.messagesCollection.deleteOne({ message_id: messageId });
    }
}

module.exports = new ReactionRolesModel();