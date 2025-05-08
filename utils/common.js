/**
 * Utility functions for the DeepQuasar bot
 */

/**
 * Check if a user has the required permissions
 * @param {Object} interaction - Discord.js interaction object
 * @param {Array} permissions - Array of permission flags to check
 * @returns {Boolean} Whether the user has all the permissions
 */
function checkPermissions(interaction, permissions) {
    if (!interaction.guild) return false;
    
    const member = interaction.member;
    
    // Always allow guild owner
    if (interaction.guild.ownerId === interaction.user.id) {
        return true;
    }
    
    return member.permissions.has(permissions);
}

/**
 * Format duration in milliseconds to a readable string (e.g. "3:45")
 * @param {Number} ms - Duration in milliseconds
 * @returns {String} Formatted duration
 */
function formatDuration(ms) {
    if (!ms || isNaN(ms) || ms <= 0) return '0:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    const paddedSeconds = seconds.toString().padStart(2, '0');
    
    if (hours > 0) {
        const paddedMinutes = minutes.toString().padStart(2, '0');
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    }
    
    return `${minutes}:${paddedSeconds}`;
}

/**
 * Truncate a string to a given length
 * @param {String} text - The string to truncate
 * @param {Number} maxLength - Maximum length 
 * @returns {String} Truncated string
 */
function truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if a user is a bot owner
 * @param {String} userId - Discord user ID 
 * @returns {Boolean} Whether the user is a bot owner
 */
function isBotOwner(userId) {
    const ownerIds = process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',') : [];
    return ownerIds.includes(userId);
}

module.exports = {
    checkPermissions,
    formatDuration,
    truncate,
    isBotOwner
};