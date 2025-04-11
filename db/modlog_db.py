import pymongo
import os
import ast
from typing import Dict, Optional

class ModLogDB:
    def __init__(self):
        # Connect to MongoDB using the URI from environment variables
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client["musicbot"]
        self.guild_settings = self.db["modlog_guild_settings"]
        # Index can be created here if needed
        # self.guild_settings.create_index("guild_id", unique=True)
        # No need for _init_db with MongoDB

    # MongoDB: No need for _init_db

    def get_guild_settings(self, guild_id: int) -> Optional[Dict]:
        """Get settings for a specific guild from MongoDB"""
        doc = self.guild_settings.find_one({"guild_id": guild_id})
        if doc:
            return {
                "log_channel_id": doc.get("log_channel_id"),
                "enabled_events": doc.get("enabled_events")
            }
        return None

    def set_log_channel(self, guild_id: int, channel_id: int):
        """Set the log channel for a guild in MongoDB"""
        self.guild_settings.update_one(
            {"guild_id": guild_id},
            {"$set": {"log_channel_id": channel_id}},
            upsert=True
        )

    def set_enabled_events(self, guild_id: int, enabled_events: Dict[str, bool]):
        """Update enabled events for a guild in MongoDB"""
        self.guild_settings.update_one(
            {"guild_id": guild_id},
            {"$set": {"enabled_events": enabled_events}},
            upsert=True
        )

    def update_settings(self, guild_id: int, channel_id: Optional[int] = None, enabled_events: Optional[Dict] = None):
        """Update either channel, events, or both in MongoDB"""
        update_fields = {}
        if channel_id is not None:
            update_fields["log_channel_id"] = channel_id
        if enabled_events is not None:
            update_fields["enabled_events"] = enabled_events
        if update_fields:
            self.guild_settings.update_one(
                {"guild_id": guild_id},
                {"$set": update_fields},
                upsert=True
            )

    def close(self):
        """Close the MongoDB client connection"""
        self.client.close()
