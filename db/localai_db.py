import sqlite3
from typing import List, Optional, Dict

class LocalAIDB:
    def __init__(self):
        self.conn = sqlite3.connect('data/localai.db')
        self.cursor = self.conn.cursor()
        self._init_db()

    def _init_db(self):
        """Initialize database tables"""
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS ai_config (
                guild_id INTEGER PRIMARY KEY,
                api_base TEXT DEFAULT 'http://192.168.0.12',
                api_key TEXT DEFAULT 'lm-studio',
                model_name TEXT DEFAULT 'fusechat-llama-3.2-3b-instruct',
                enabled BOOLEAN DEFAULT FALSE,
                temperature REAL DEFAULT 0.7,
                max_tokens INTEGER DEFAULT 1000,
                system_prompt TEXT DEFAULT "You are a helpful assistant",
                response_chance REAL DEFAULT 100
            )
        ''')

        # Check existing columns for migrations
        self.cursor.execute("PRAGMA table_info(ai_config)")
        columns = [column[1] for column in self.cursor.fetchall()]

        if 'system_prompt' not in columns:
            try:
                self.cursor.execute('ALTER TABLE ai_config ADD COLUMN system_prompt TEXT DEFAULT "You are a helpful assistant"')
                self.conn.commit()
            except sqlite3.OperationalError as e:
                print(f"Database migration error (system_prompt): {e}")

        if 'response_chance' not in columns:
            try:
                self.cursor.execute('ALTER TABLE ai_config ADD COLUMN response_chance REAL DEFAULT 100')
                self.conn.commit()
            except sqlite3.OperationalError as e:
                print(f"Database migration error (response_chance): {e}")

        if 'api_base' not in columns:
            try:
                self.cursor.execute('ALTER TABLE ai_config ADD COLUMN api_base TEXT DEFAULT "http://192.168.0.12:1234"')
                self.conn.commit()
            except sqlite3.OperationalError as e:
                print(f"Database migration error (api_base): {e}")

        if 'api_key' not in columns:
            try:
                self.cursor.execute('ALTER TABLE ai_config ADD COLUMN api_key TEXT DEFAULT "lm-studio"')
                self.conn.commit()
            except sqlite3.OperationalError as e:
                print(f"Database migration error (api_key): {e}")

        if 'model_name' not in columns:
            try:
                self.cursor.execute('ALTER TABLE ai_config ADD COLUMN model_name TEXT DEFAULT "fusechat-llama-3.2-3b-instruct"')
                self.conn.commit()
            except sqlite3.OperationalError as e:
                print(f"Database migration error (model_name): {e}")

        # Whitelisted channels
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS whitelisted_channels (
                guild_id INTEGER,
                channel_id INTEGER,
                PRIMARY KEY (guild_id, channel_id)
            )
        ''')
        self.conn.commit()

    def set_config(self, guild_id: int, api_base: str = 'http://192.168.0.12', api_key: Optional[str] = 'lm-studio', model_name: str = 'fusechat-llama-3.2-3b-instruct'):
        """Configure local AI endpoint"""
        self.cursor.execute('''
            INSERT OR REPLACE INTO ai_config 
            (guild_id, api_base, api_key, model_name) 
            VALUES (?, ?, ?, ?)
        ''', (guild_id, api_base, api_key, model_name))
        self.conn.commit()

    def get_config(self, guild_id: int) -> Optional[Dict]:
        """Get current configuration"""
        self.cursor.execute('''
            SELECT api_base, api_key, model_name, enabled, temperature, max_tokens, system_prompt, response_chance
            FROM ai_config WHERE guild_id = ?
        ''', (guild_id,))
        result = self.cursor.fetchone()
        if result:
            return {
                'api_base': result[0] or 'http://192.168.0.12',
                'api_key': result[1] or 'lm-studio',
                'model_name': result[2] or 'fusechat-llama-3.2-3b-instruct',
                'enabled': bool(result[3]),
                'temperature': result[4],
                'max_tokens': result[5],
                'system_prompt': result[6] if len(result) > 6 else "You are a helpful assistant",
                'response_chance': result[7] if len(result) > 7 and result[7] is not None else 100.0
            }
        return None

    def set_enabled(self, guild_id: int, enabled: bool):
        """Toggle AI functionality"""
        self.cursor.execute('SELECT 1 FROM ai_config WHERE guild_id = ?', (guild_id,))
        if not self.cursor.fetchone():
            self.cursor.execute('''
                INSERT INTO ai_config 
                (guild_id, enabled, api_base, api_key, model_name)
                VALUES (?, ?, ?, ?, ?)
            ''', (guild_id, enabled, 'http://192.168.0.12', 'lm-studio', 'fusechat-llama-3.2-3b-instruct'))
        else:
            self.cursor.execute('''
                UPDATE ai_config 
                SET enabled = ?
                WHERE guild_id = ?
            ''', (enabled, guild_id))
        self.conn.commit()

    def add_whitelisted_channel(self, guild_id: int, channel_id: int):
        """Add channel to whitelist"""
        self.cursor.execute('''
            INSERT OR IGNORE INTO whitelisted_channels 
            (guild_id, channel_id) 
            VALUES (?, ?)
        ''', (guild_id, channel_id))
        self.conn.commit()

    def remove_whitelisted_channel(self, guild_id: int, channel_id: int):
        """Remove channel from whitelist"""
        self.cursor.execute('''
            DELETE FROM whitelisted_channels 
            WHERE guild_id = ? AND channel_id = ?
        ''', (guild_id, channel_id))
        self.conn.commit()

    def get_whitelisted_channels(self, guild_id: int) -> List[int]:
        """Get all whitelisted channels"""
        self.cursor.execute('''
            SELECT channel_id FROM whitelisted_channels 
            WHERE guild_id = ?
        ''', (guild_id,))
        return [row[0] for row in self.cursor.fetchall()]

    def is_whitelisted(self, guild_id: int, channel_id: int) -> bool:
        """Check if channel is whitelisted"""
        self.cursor.execute('''
            SELECT 1 FROM whitelisted_channels 
            WHERE guild_id = ? AND channel_id = ?
        ''', (guild_id, channel_id))
        return bool(self.cursor.fetchone())

    def set_system_prompt(self, guild_id: int, prompt: Optional[str]):
        """Set the system prompt for a guild"""
        self.cursor.execute('''
            UPDATE ai_config 
            SET system_prompt = ?
            WHERE guild_id = ?
        ''', (prompt, guild_id))
        self.conn.commit()

    def get_system_prompt(self, guild_id: int) -> Optional[str]:
        """Get the system prompt for a guild"""
        self.cursor.execute('''
            SELECT system_prompt FROM ai_config WHERE guild_id = ?
        ''', (guild_id,))
        result = self.cursor.fetchone()
        return result[0] if result and result[0] else "You are a helpful assistant"

    def set_response_chance(self, guild_id: int, chance: float):
        """Set the AI response chance percentage (0-100)"""
        self.cursor.execute('''
            UPDATE ai_config
            SET response_chance = ?
            WHERE guild_id = ?
        ''', (chance, guild_id))
        self.conn.commit()

    def get_response_chance(self, guild_id: int) -> float:
        """Get the AI response chance percentage (0-100), defaults to 100"""
        self.cursor.execute('''
            SELECT response_chance FROM ai_config WHERE guild_id = ?
        ''', (guild_id,))
        result = self.cursor.fetchone()
        if result and result[0] is not None:
            return result[0]
        return 100.0

    def close(self):
        self.conn.close()
