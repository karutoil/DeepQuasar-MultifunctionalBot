import sqlite3
import pymongo
import os

def migrate_modlog_db(sqlite_path, mongo_uri, mongo_db):
    # Connect to sqlite3
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()

    # Connect to MongoDB
    client = pymongo.MongoClient(mongo_uri)
    db = client[mongo_db]
    settings_col = db["modlog_guild_settings"]

    # Migrate guild_settings
    for row in cursor.execute("SELECT guild_id, log_channel_id, enabled_events FROM guild_settings"):
        doc = {
            "guild_id": row[0],
            "log_channel_id": row[1],
            "enabled_events": row[2]
        }
        settings_col.update_one({"guild_id": doc["guild_id"]}, {"$set": doc}, upsert=True)

    print("Migration complete for", sqlite_path)
    conn.close()
    client.close()

if __name__ == "__main__":
    # Usage: python migrate_modlog_db_to_mongo.py
    SQLITE_PATH = "data/modlog.db"
    MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGO_DB = "musicbot"
    migrate_modlog_db(SQLITE_PATH, MONGO_URI, MONGO_DB)
