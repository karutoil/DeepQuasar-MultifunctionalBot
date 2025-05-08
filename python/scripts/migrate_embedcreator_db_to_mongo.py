import sqlite3
import pymongo
import os
import json

def migrate_embedcreator_db(sqlite_path, mongo_uri, mongo_db):
    # Connect to sqlite3
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()

    # Connect to MongoDB
    client = pymongo.MongoClient(mongo_uri)
    db = client[mongo_db]
    embeds_col = db["embeds"]

    # Migrate embeds
    for row in cursor.execute("SELECT message_id, channel_id, guild_id, embed_json, author_id, created_at FROM embeds"):
        try:
            embed_json_data = json.loads(row[3])
        except Exception:
            embed_json_data = row[3]  # fallback to raw string if not valid JSON

        doc = {
            "message_id": row[0],
            "channel_id": row[1],
            "guild_id": row[2],
            "embed_json": embed_json_data,
            "author_id": row[4],
            "created_at": row[5]
        }
        embeds_col.update_one({"message_id": doc["message_id"]}, {"$set": doc}, upsert=True)

    print("Migration complete for", sqlite_path)
    conn.close()
    client.close()

if __name__ == "__main__":
    # Usage: python migrate_embedcreator_db_to_mongo.py
    SQLITE_PATH = "data/embedcreator.db"
    MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGO_DB = "musicbot"
    migrate_embedcreator_db(SQLITE_PATH, MONGO_URI, MONGO_DB)
