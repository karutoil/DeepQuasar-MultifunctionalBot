import pymongo
import os

COLLECTIONS = [
    "autoroles",
    "ticket",
    "cogs",
    "embeds",
    "ai_config",
    "whitelisted_channels",
    "localai_migrations",
    "modlog_guild_settings",
    "musicbot_welcome_leave_settings",
    "musicbot_volumes",
    "musicbot_dj_roles",
    "musicbot_bot_config",
    "welcome_leave_settings",
]

def main():
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongo_db = "musicbot"
    client = pymongo.MongoClient(mongo_uri)
    db = client[mongo_db]

    print(f"Connected to MongoDB at {mongo_uri}, database: {mongo_db}\n")
    for col_name in COLLECTIONS:
        col = db[col_name]
        count = col.count_documents({})
        print(f"Collection: {col_name} | Document count: {count}")
        sample = col.find_one()
        if sample:
            print(f"Sample document: {sample}\n")
        else:
            print("No documents found.\n")

    client.close()

if __name__ == "__main__":
    main()
