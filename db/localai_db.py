import pymongo
import os
from typing import List, Optional, Dict

class LocalAIDB:
    def __init__(self):
        # Connect to MongoDB using the URI from environment variables
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client["musicbot"]
        self.ai_config = self.db["ai_config"]
        self.whitelisted_channels = self.db["whitelisted_channels"]
        # Indexes can be created here if needed
        # self.ai_config.create_index("guild_id", unique=True)
        # self.whitelisted_channels.create_index([("guild_id", 1), ("channel_id", 1)], unique=True)
        # No need for _init_db with MongoDB

    # MongoDB: No need for _init_db

    def set_config(self, guild_id: int, api_base: str = 'http://192.168.0.12', api_key: Optional[str] = 'lm-studio', model_name: str = 'fusechat-llama-3.2-3b-instruct'):
        """Configure local AI endpoint in MongoDB"""
        self.ai_config.update_one(
            {"guild_id": guild_id},
            {"$set": {
                "api_base": api_base,
                "api_key": api_key,
                "model_name": model_name
            }},
            upsert=True
        )

    def get_config(self, guild_id: int) -> Optional[Dict]:
        """Get current configuration from MongoDB"""
        doc = self.ai_config.find_one({"guild_id": guild_id})
        if doc:
            return {
                'api_base': doc.get('api_base', 'http://192.168.0.12'),
                'api_key': doc.get('api_key', 'lm-studio'),
                'model_name': doc.get('model_name', 'fusechat-llama-3.2-3b-instruct'),
                'enabled': doc.get('enabled', False),
                'temperature': doc.get('temperature', 0.7),
                'max_tokens': doc.get('max_tokens', 1000),
                'system_prompt': doc.get('system_prompt', "You are a helpful assistant"),
                'response_chance': doc.get('response_chance', 100.0)
            }
        return None

    def set_enabled(self, guild_id: int, enabled: bool):
        """Toggle AI functionality in MongoDB"""
        self.ai_config.update_one(
            {"guild_id": guild_id},
            {"$set": {"enabled": enabled}},
            upsert=True
        )

    def add_whitelisted_channel(self, guild_id: int, channel_id: int):
        """Add channel to whitelist in MongoDB"""
        self.whitelisted_channels.update_one(
            {"guild_id": guild_id, "channel_id": channel_id},
            {"$set": {}},
            upsert=True
        )

    def remove_whitelisted_channel(self, guild_id: int, channel_id: int):
        """Remove channel from whitelist in MongoDB"""
        self.whitelisted_channels.delete_one({"guild_id": guild_id, "channel_id": channel_id})

    def get_whitelisted_channels(self, guild_id: int) -> List[int]:
        """Get all whitelisted channels from MongoDB"""
        return [doc["channel_id"] for doc in self.whitelisted_channels.find({"guild_id": guild_id})]

    def is_whitelisted(self, guild_id: int, channel_id: int) -> bool:
        """Check if channel is whitelisted in MongoDB"""
        return self.whitelisted_channels.count_documents({"guild_id": guild_id, "channel_id": channel_id}) > 0

    def set_system_prompt(self, guild_id: int, prompt: Optional[str]):
        """Set the system prompt for a guild in MongoDB"""
        self.ai_config.update_one(
            {"guild_id": guild_id},
            {"$set": {"system_prompt": prompt}},
            upsert=True
        )

    def get_system_prompt(self, guild_id: int) -> Optional[str]:
        """Get the system prompt for a guild from MongoDB"""
        doc = self.ai_config.find_one({"guild_id": guild_id})
        return doc.get("system_prompt") if doc and doc.get("system_prompt") else "You are a helpful assistant"

    def set_response_chance(self, guild_id: int, chance: float):
        """Set the AI response chance percentage (0-100) in MongoDB"""
        self.ai_config.update_one(
            {"guild_id": guild_id},
            {"$set": {"response_chance": chance}},
            upsert=True
        )

    def get_response_chance(self, guild_id: int) -> float:
        """Get the AI response chance percentage (0-100), defaults to 100, from MongoDB"""
        doc = self.ai_config.find_one({"guild_id": guild_id})
        if doc and doc.get("response_chance") is not None:
            return doc["response_chance"]
        return 100.0

    def close(self):
        """Close the MongoDB client connection"""
        self.client.close()
