# db/ticket_db.py
import pymongo
import os
import ast
from typing import Optional, Dict, List

class TicketDB:
    def __init__(self):
        # Connect to MongoDB using the URI from environment variables
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client["musicbot"]
        self.ticket_settings = self.db["ticket_settings"]
        self.tickets = self.db["tickets"]
        # Indexes can be created here if needed
        # self.ticket_settings.create_index("guild_id", unique=True)
        # self.tickets.create_index("channel_id", unique=True)
        # No need for _init_db with MongoDB

    # MongoDB: No need for _init_db

    def set_guild_settings(self, guild_id: int, category_open: int, category_archive: int, support_roles: List[int], log_channel: int):
        """Insert or update guild ticket settings in MongoDB"""
        self.ticket_settings.update_one(
            {"guild_id": guild_id},
            {
                "$set": {
                    "category_open": category_open,
                    "category_archive": category_archive,
                    "support_roles": support_roles,
                    "log_channel": log_channel
                }
            },
            upsert=True
        )

    def get_guild_settings(self, guild_id: int) -> Optional[Dict]:
        """Retrieve guild ticket settings from MongoDB"""
        doc = self.ticket_settings.find_one({"guild_id": guild_id})
        if not doc:
            return None
        return {
            "category_open": doc.get("category_open"),
            "category_archive": doc.get("category_archive"),
            "support_roles": doc.get("support_roles", []),
            "log_channel": doc.get("log_channel")
        }

    def create_ticket(self, channel_id: int, guild_id: int, owner_id: int, members: List[int]):
        """Insert or update a ticket in MongoDB"""
        self.tickets.update_one(
            {"channel_id": channel_id},
            {
                "$set": {
                    "guild_id": guild_id,
                    "owner_id": owner_id,
                    "claimed_by": None,
                    "members": members,
                    "status": "open"
                }
            },
            upsert=True
        )

    def get_ticket(self, channel_id: int) -> Optional[Dict]:
        """Retrieve a ticket from MongoDB"""
        doc = self.tickets.find_one({"channel_id": channel_id})
        if not doc:
            return None
        return {
            "channel_id": doc.get("channel_id"),
            "guild_id": doc.get("guild_id"),
            "owner_id": doc.get("owner_id"),
            "claimed_by": doc.get("claimed_by"),
            "members": doc.get("members", []),
            "status": doc.get("status")
        }

    def update_ticket(self, channel_id: int, **updates):
        """Update fields of a ticket in MongoDB"""
        update_fields = {}
        if "claimed_by" in updates:
            update_fields["claimed_by"] = updates["claimed_by"]
        if "members" in updates:
            update_fields["members"] = updates["members"]
        if "status" in updates:
            update_fields["status"] = updates["status"]
        if update_fields:
            self.tickets.update_one(
                {"channel_id": channel_id},
                {"$set": update_fields}
            )

    def delete_ticket(self, channel_id: int):
        """Delete a ticket from MongoDB"""
        self.tickets.delete_one({"channel_id": channel_id})

    def close(self):
        """Close the MongoDB client connection"""
        self.client.close()
