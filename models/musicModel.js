const { getDb, connect } = require('./database');

let volumes = null;
let djRoles = null;

/**
 * Initializes the connection to the music collections in MongoDB
 */
async function init() {
    if (volumes && djRoles) return;

    try {
        // Use the centralized database connection
        const db = await connect();
        volumes = db.collection('volumes');
        djRoles = db.collection('dj_roles');
        console.log('Connected to MongoDB for Music module');
    } catch (error) {
        console.error('Error connecting to MongoDB for Music module:', error);
        throw error;
    }
}

// Volume operations
async function getVolume(guildId) {
    await init();
    try {
        const doc = await volumes.findOne({ guild_id: guildId });
        return doc && doc.volume ? doc.volume : 1.0; // Default volume is 100%
    } catch (error) {
        console.error('Error getting volume:', error);
        return 1.0; // Default to 100% volume on error
    }
}

async function setVolume(guildId, normalizedVolume) {
    await init();
    return volumes.updateOne(
        { guild_id: guildId },
        { $set: { volume: normalizedVolume } },
        { upsert: true }
    );
}

// DJ role operations
async function getDJRole(guildId) {
    await init();
    const doc = await djRoles.findOne({ guild_id: guildId });
    return doc ? doc.role_id : null;
}

async function setDJRole(guildId, roleId) {
    await init();
    return djRoles.updateOne(
        { guild_id: guildId },
        { $set: { role_id: roleId } },
        { upsert: true }
    );
}

async function clearDJRole(guildId) {
    await init();
    return djRoles.deleteOne({ guild_id: guildId });
}

async function hasDJPermission(guildId, member) {
    // Always allow administrators
    if (member.permissions.has('ADMINISTRATOR')) {
        return true;
    }
    
    try {
        const roleId = await getDJRole(guildId);
        
        // If no DJ role is set, allow everyone
        if (!roleId) {
            return true;
        }
        
        // Check if user has the DJ role
        return member.roles.cache.has(roleId);
    } catch (error) {
        console.error('Error checking DJ permissions:', error);
        return true; // On error, allow access to be safe
    }
}

// Playlist search functions removed since caching was causing URL expiration issues

module.exports = {
    init,
    getVolume,
    setVolume,
    getDJRole,
    setDJRole,
    clearDJRole,
    hasDJPermission
};