import sqlite3
import pymongo
import ast
import os

def migrate_ticket_db(sqlite_path, mongo_uri, mongo_db):
    # Connect to sqlite3
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()

    # Connect to MongoDB
    client = pymongo.MongoClient(mongo_uri)
    db = client[mongo_db]
    ticket_settings_col = db["ticket_settings"]
    tickets_col = db["tickets"]

    # Migrate ticket_settings
    for row in cursor.execute("SELECT guild_id, category_open, category_archive, support_roles, log_channel FROM ticket_settings"):
        doc = {
            "guild_id": row[0],
            "category_open": row[1],
            "category_archive": row[2],
            "support_roles": ast.literal_eval(row[3]) if row[3] else [],
            "log_channel": row[4]
        }
        ticket_settings_col.update_one({"guild_id": doc["guild_id"]}, {"$set": doc}, upsert=True)

    # Migrate tickets
    for row in cursor.execute("SELECT channel_id, guild_id, owner_id, claimed_by, members, status FROM tickets"):
        doc = {
            "channel_id": row[0],
            "guild_id": row[1],
            "owner_id": row[2],
            "claimed_by": row[3],
            "members": ast.literal_eval(row[4]) if row[4] else [],
            "status": row[5]
        }
        tickets_col.update_one({"channel_id": doc["channel_id"]}, {"$set": doc}, upsert=True)

    print("Migration complete for", sqlite_path)
    conn.close()
    client.close()

if __name__ == "__main__":
    # Usage: python migrate_ticket_db_to_mongo.py
    SQLITE_PATH = "data/ticket.db"
    MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGO_DB = "musicbot"
    migrate_ticket_db(SQLITE_PATH, MONGO_URI, MONGO_DB)
