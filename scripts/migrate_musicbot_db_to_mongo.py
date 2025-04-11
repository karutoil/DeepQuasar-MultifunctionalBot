import sqlite3
import pymongo
import os

def migrate_musicbot_db(sqlite_path, mongo_uri, mongo_db):
    # Connect to sqlite3
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()

    # Connect to MongoDB
    client = pymongo.MongoClient(mongo_uri)
    db = client[mongo_db]
    welcome_leave_settings_col = db["musicbot_welcome_leave_settings"]
    volumes_col = db["musicbot_volumes"]
    dj_roles_col = db["musicbot_dj_roles"]
    bot_config_col = db["musicbot_bot_config"]

    # Migrate welcome_leave_settings
    for row in cursor.execute("SELECT guild_id, welcome_channel_id, leave_channel_id FROM welcome_leave_settings"):
        doc = {
            "guild_id": row[0],
            "welcome_channel_id": row[1],
            "leave_channel_id": row[2]
        }
        welcome_leave_settings_col.update_one({"guild_id": doc["guild_id"]}, {"$set": doc}, upsert=True)

    # Migrate volumes
    for row in cursor.execute("SELECT guild_id, volume FROM volumes"):
        doc = {
            "guild_id": row[0],
            "volume": row[1]
        }
        volumes_col.update_one({"guild_id": doc["guild_id"]}, {"$set": doc}, upsert=True)

    # Migrate dj_roles
    for row in cursor.execute("SELECT guild_id, role_id FROM dj_roles"):
        doc = {
            "guild_id": row[0],
            "role_id": row[1]
        }
        dj_roles_col.update_one(doc, {"$set": doc}, upsert=True)

    # Migrate bot_config
    for row in cursor.execute("SELECT key, value FROM bot_config"):
        doc = {
            "key": row[0],
            "value": row[1]
        }
        bot_config_col.update_one({"key": doc["key"]}, {"$set": doc}, upsert=True)

    print("Migration complete for", sqlite_path)
    conn.close()
    client.close()

if __name__ == "__main__":
    # Usage: python migrate_musicbot_db_to_mongo.py
    SQLITE_PATH = "data/musicbot.db"
    MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGO_DB = "musicbot"
    migrate_musicbot_db(SQLITE_PATH, MONGO_URI, MONGO_DB)
