const { MongoClient } = require('mongodb');
require('dotenv').config();

// Connection URL
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'musicbot';

// Connection options with improved timeouts and connection pooling
const clientOptions = {
    connectTimeoutMS: 5000,         // Connection timeout (5 seconds)
    socketTimeoutMS: 30000,         // Socket timeout (30 seconds)
    serverSelectionTimeoutMS: 5000, // Server selection timeout
    maxPoolSize: 50,                // Maximum connection pool size
    minPoolSize: 5,                 // Minimum connection pool size
    retryWrites: true,              // Automatically retry failed writes
    retryReads: true                // Automatically retry failed reads
};

let db = null;
let client = null;

/**
 * Connect to MongoDB
 * @returns {Promise} A promise that resolves when connection is established
 */
async function connect() {
    if (db) return db;
    
    try {
        client = new MongoClient(url, clientOptions);
        await client.connect();
        console.log('Connected successfully to MongoDB server');
        
        db = client.db(dbName);
        return db;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        throw err;
    }
}

/**
 * Get the database instance
 * @returns {Object} The MongoDB database instance
 */
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call connect() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
async function close() {
    if (client) {
        await client.close();
        db = null;
        client = null;
        console.log('MongoDB connection closed');
    }
}

module.exports = {
    connect,
    getDb,
    close
};