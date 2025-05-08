import pymongo
import os

class ReactionRolesDB:
    def __init__(self):
        # Connect to MongoDB using the URI from environment variables
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client["musicbot"]
        self.reaction_role_messages = self.db["reaction_role_messages"]
        self.reaction_roles = self.db["reaction_roles"]
        # Indexes can be created here if needed
        # self.reaction_role_messages.create_index("message_id", unique=True)
        # self.reaction_roles.create_index([("message_id", 1), ("emoji", 1)], unique=True)
        # No need for _init_db or _migrate_db with MongoDB

    # MongoDB: No need for _init_db or _migrate_db

    def add_reaction_role(self, message_id, channel_id, guild_id, title, color, emoji, role_id, description=None):
        """Add or update a reaction role configuration in MongoDB"""
        # Upsert the message info
        self.reaction_role_messages.update_one(
            {"message_id": message_id},
            {
                "$set": {
                    "channel_id": channel_id,
                    "guild_id": guild_id,
                    "title": title,
                    "color": color
                }
            },
            upsert=True
        )
        # Upsert the reaction role
        self.reaction_roles.update_one(
            {"message_id": message_id, "emoji": str(emoji)},
            {
                "$set": {
                    "role_id": role_id,
                    "description": description
                }
            },
            upsert=True
        )

    def get_reaction_roles(self, message_id):
        """Get all reaction roles for a message from MongoDB"""
        cursor = self.reaction_roles.find({"message_id": message_id})
        return [(doc.get("emoji"), doc.get("role_id"), doc.get("description")) for doc in cursor]

    def get_message_info(self, message_id):
        """Get message information from MongoDB"""
        doc = self.reaction_role_messages.find_one({"message_id": message_id})
        if doc:
            return (doc.get("channel_id"), doc.get("guild_id"), doc.get("title"), doc.get("color"))
        return None

    def remove_reaction_role(self, message_id, emoji):
        """Remove a specific reaction role from MongoDB"""
        self.reaction_roles.delete_one({"message_id": message_id, "emoji": str(emoji)})

    def remove_all_message_roles(self, message_id):
        """Remove all reaction roles and the message info for a message from MongoDB"""
        self.reaction_roles.delete_many({"message_id": message_id})
        self.reaction_role_messages.delete_one({"message_id": message_id})

    def close(self):
        """Close the MongoDB client connection"""
        self.client.close()

""" async def setup(bot):
    await bot.add_cog(ReactionRolesDB(bot)) """
