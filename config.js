require('dotenv').config();

module.exports = {
    // Bot configuration
    prefix: '!',
    
    // MongoDB configuration
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        database: 'musicbot',
        collections: {
            cogState: 'cog_state',
            autoroles: 'autoroles',
            tickets: 'tickets',
            ticketSettings: 'ticket_settings',
            embedCreator: 'embed_creator',
            embedTemplates: 'embed_templates',
            localAI: 'local_ai',
            modLog: 'mod_log',
            music: 'music',
            welcomeLeave: 'welcome_leave',
            reactionRoles: 'reaction_roles'
        }
    },
    
    // Lavalink configuration
    lavalink: {
        host: process.env.LAVALINK_HOST || 'localhost',
        port: process.env.LAVALINK_PORT || 2333,
        password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
        secure: false
    },
    
    // YouTube configuration
    youtube: {
        refreshToken: process.env.YOUTUBE_REFRESH_TOKEN
    }
};