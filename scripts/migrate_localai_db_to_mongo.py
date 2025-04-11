import sqlite3
import pymongo
import os

def migrate_localai_db(sqlite_path, mongo_uri, mongo_db):
    # Connect to sqlite3
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()

    # Connect to MongoDB
    client = pymongo.MongoClient(mongo_uri)
    db = client[mongo_db]
    ai_config_col = db["ai_config"]
    whitelisted_channels_col = db["whitelisted_channels"]
    migrations_col = db["localai_migrations"]

    # Migrate ai_config
    for row in cursor.execute("SELECT guild_id, api_base, api_key, model_name, enabled, temperature, max_tokens, system_prompt, response_chance FROM ai_config"):
        doc = {
            "guild_id": row[0],
            "api_base": row[1],
            "api_key": row[2],
            "model_name": row[3],
            "enabled": bool(row[4]),
            "temperature": row[5],
            "max_tokens": row[6],
            "system_prompt": row[7],
            "response_chance": row[8]
        }
        ai_config_col.update_one({"guild_id": doc["guild_id"]}, {"$set": doc}, upsert=True)

    # Migrate whitelisted_channels
    for row in cursor.execute("SELECT guild_id, channel_id FROM whitelisted_channels"):
        doc = {
            "guild_id": row[0],
            "channel_id": row[1]
        }
        whitelisted_channels_col.update_one(doc, {"$set": doc}, upsert=True)

    # Migrate migrations table
    for row in cursor.execute("SELECT name FROM migrations"):
        doc = {"name": row[0]}
        migrations_col.update_one(doc, {"$set": doc}, upsert=True)

    print("Migration complete for", sqlite_path)
    conn.close()
    client.close()

if __name__ == "__main__":
    # Usage: python migrate_localai_db_to_mongo.py
    SQLITE_PATH = "data/localai.db"
    MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGO_DB = "musicbot"
    migrate_localai_db(SQLITE_PATH, MONGO_URI, MONGO_DB)
