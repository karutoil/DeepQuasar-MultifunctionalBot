import pymongo
import os

class AutoRoleDB:
    def __init__(self):
        # Connect to MongoDB using the URI from environment variables
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client["musicbot"]
        self.autoroles = self.db["autoroles"]
        # Index can be created here if needed
        # self.autoroles.create_index("guild_id", unique=True)
        # No need for _init_db with MongoDB

    # MongoDB: No need for _init_db

    def get_autorole(self, guild_id):
        """Get the auto-role for a guild from MongoDB"""
        doc = self.autoroles.find_one({"guild_id": guild_id})
        return doc.get("role_id") if doc else None

    def set_autorole(self, guild_id, role_id):
        """Set the auto-role for a guild in MongoDB"""
        self.autoroles.update_one(
            {"guild_id": guild_id},
            {"$set": {"role_id": role_id}},
            upsert=True
        )

    def remove_autorole(self, guild_id):
        """Remove the auto-role configuration for a guild in MongoDB"""
        self.autoroles.delete_one({"guild_id": guild_id})

    def get_all_autoroles(self):
        """Get all auto-role configurations from MongoDB"""
        return {doc["guild_id"]: doc["role_id"] for doc in self.autoroles.find()}

    def close(self):
        """Close the MongoDB client connection"""
        self.client.close()

""" async def setup(bot):
    await bot.add_cog(AutoRoleDB(bot)) """
