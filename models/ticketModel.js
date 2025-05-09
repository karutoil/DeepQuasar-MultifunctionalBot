const { getDb, connect } = require('./database');

// Collection names
const COLLECTIONS = {
    SETTINGS: 'ticketsettings',
    TICKETS: 'tickets'
};

// Helper function to ensure database connection
async function ensureDbConnection() {
    try {
        await connect();
        return getDb();
    } catch (error) {
        console.error('Failed to connect to database:', error);
        throw error;
    }
}

// Helper function for retrying database operations
async function withRetry(operation, maxRetries = 3) {
    let lastError;
    let delay = 500;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const db = await ensureDbConnection();
            return await operation(db);
        } catch (error) {
            console.error(`Database operation attempt ${attempt}/${maxRetries} failed:`, error.message);
            lastError = error;
            
            if (attempt < maxRetries) {
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }
    
    throw lastError;
}

// Functions to interact with the database
module.exports = {
    // Guild settings functions
    async getGuildSettings(guildId) {
        return await withRetry(async (db) => {
            return await db.collection(COLLECTIONS.SETTINGS).findOne({ guildId }, { maxTimeMS: 5000 });
        });
    },

    async setGuildSettings(guildId, categoryOpen, categoryArchive, supportRoles, logChannel) {
        return await withRetry(async (db) => {
            const result = await db.collection(COLLECTIONS.SETTINGS).findOneAndUpdate(
                { guildId },
                { 
                    $set: { 
                        guildId, 
                        categoryOpen, 
                        categoryArchive, 
                        supportRoles, 
                        logChannel 
                    }
                },
                { upsert: true, returnDocument: 'after', maxTimeMS: 5000 }
            );
            return result.value;
        });
    },

    // Ticket functions
    async createTicket(channelId, guildId, creatorId, participants) {
        return await withRetry(async (db) => {
            const newTicket = {
                channelId,
                guildId,
                creatorId,
                claimedBy: null,
                status: 'open',
                participants: participants || [],
                createdAt: new Date()
            };
            
            await db.collection(COLLECTIONS.TICKETS).insertOne(newTicket, { maxTimeMS: 5000 });
            return newTicket;
        });
    },

    async getTicket(channelId) {
        return await withRetry(async (db) => {
            return await db.collection(COLLECTIONS.TICKETS).findOne({ channelId }, { maxTimeMS: 5000 });
        });
    },

    async updateTicket(channelId, updateData) {
        return await withRetry(async (db) => {
            const result = await db.collection(COLLECTIONS.TICKETS).findOneAndUpdate(
                { channelId },
                { $set: updateData },
                { returnDocument: 'after', maxTimeMS: 5000 }
            );
            return result.value;
        });
    },

    async deleteTicket(channelId) {
        return await withRetry(async (db) => {
            const result = await db.collection(COLLECTIONS.TICKETS).findOneAndDelete(
                { channelId },
                { maxTimeMS: 5000 }
            );
            return result.value;
        });
    },

    async getGuildTickets(guildId) {
        return await withRetry(async (db) => {
            return await db.collection(COLLECTIONS.TICKETS).find({ guildId })
                .maxTimeMS(5000)
                .toArray();
        });
    },

    async getOpenTickets(guildId) {
        return await withRetry(async (db) => {
            return await db.collection(COLLECTIONS.TICKETS).find({ guildId, status: 'open' })
                .maxTimeMS(5000)
                .toArray();
        });
    },

    async getClosedTickets(guildId) {
        return await withRetry(async (db) => {
            return await db.collection(COLLECTIONS.TICKETS).find({ guildId, status: 'closed' })
                .maxTimeMS(5000)
                .toArray();
        });
    },

    async getUserTickets(guildId, userId) {
        return await withRetry(async (db) => {
            return await db.collection(COLLECTIONS.TICKETS).find({ 
                guildId, 
                $or: [{ creatorId: userId }, { participants: userId }]
            })
                .maxTimeMS(5000)
                .toArray();
        });
    }
};