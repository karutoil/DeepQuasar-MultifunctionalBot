import pymongo
import os
from typing import Optional, Tuple

class WelcomeLeaveDB:
    def __init__(self, db_path: str = "data/musicbot.db"):
        # Connect to MongoDB using the URI from environment variables
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client["musicbot"]
        self.settings = self.db["welcome_leave_settings"]
        # Index can be created here if needed
        # self.settings.create_index("guild_id", unique=True)
        # No need for _create_table with MongoDB

    # MongoDB: No need for _create_table

    def set_welcome_channel(self, guild_id: int, channel_id: Optional[int]):
        """Set or update the welcome channel for a guild in MongoDB"""
        self.settings.update_one(
            {"guild_id": guild_id},
            {"$set": {"welcome_channel_id": channel_id}},
            upsert=True
        )

    def set_leave_channel(self, guild_id: int, channel_id: Optional[int]):
        """Set or update the leave channel for a guild in MongoDB"""
        self.settings.update_one(
            {"guild_id": guild_id},
            {"$set": {"leave_channel_id": channel_id}},
            upsert=True
        )

    def get_channels(self, guild_id: int) -> Tuple[Optional[int], Optional[int]]:
        """Get the welcome and leave channels for a guild from MongoDB"""
        doc = self.settings.find_one({"guild_id": guild_id})
        if doc:
            return doc.get("welcome_channel_id"), doc.get("leave_channel_id")
        return None, None
