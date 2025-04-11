import sqlite3
import pymongo
import os

def migrate_cog_state_db(sqlite_path, mongo_uri, mongo_db):
    # Connect to sqlite3
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()

    # Connect to MongoDB
    client = pymongo.MongoClient(mongo_uri)
    db = client[mongo_db]
    cogs_col = db["cogs"]

    # Migrate cogs
    for row in cursor.execute("SELECT cog_name, loaded FROM cogs"):
        doc = {
            "cog_name": row[0],
            "loaded": row[1]
        }
        cogs_col.update_one({"cog_name": doc["cog_name"]}, {"$set": doc}, upsert=True)

    print("Migration complete for", sqlite_path)
    conn.close()
    client.close()

if __name__ == "__main__":
    # Usage: python migrate_cog_state_db_to_mongo.py
    SQLITE_PATH = "data/cog_state.db"
    MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGO_DB = "musicbot"
    migrate_cog_state_db(SQLITE_PATH, MONGO_URI, MONGO_DB)
