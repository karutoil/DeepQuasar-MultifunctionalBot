const { MongoClient } = require('mongodb');
require('dotenv').config();

// Connection URL
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'musicbot';

let db = null;
let client = null;

/**
 * Connect to MongoDB
 * @returns {Promise} A promise that resolves when connection is established
 */
async function connect() {
    if (db) return db;
    
    try {
        client = new MongoClient(url);
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