import sqlite3
import ast
from typing import Dict, Optional

class ModLogDB:
    def __init__(self):
        self.conn = sqlite3.connect('data/modlog.db')
        self.cursor = self.conn.cursor()
        self._init_db()

    def _init_db(self):
        """Initialize database tables"""
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id INTEGER PRIMARY KEY,
                log_channel_id INTEGER,
                enabled_events TEXT
            )
        ''')
        self.conn.commit()

    def get_guild_settings(self, guild_id: int) -> Optional[Dict]:
        """Get settings for a specific guild"""
        self.cursor.execute(
            'SELECT log_channel_id, enabled_events FROM guild_settings WHERE guild_id = ?',
            (guild_id,)
        )
        result = self.cursor.fetchone()
        
        if result:
            channel_id, enabled_events = result
            return {
                'log_channel_id': channel_id,
                'enabled_events': ast.literal_eval(enabled_events) if enabled_events else None
            }
        return None

    def set_log_channel(self, guild_id: int, channel_id: int):
        """Set the log channel for a guild"""
        self.cursor.execute('''
            INSERT OR REPLACE INTO guild_settings 
            (guild_id, log_channel_id) 
            VALUES (?, ?)
        ''', (guild_id, channel_id))
        self.conn.commit()

    def set_enabled_events(self, guild_id: int, enabled_events: Dict[str, bool]):
        """Update enabled events for a guild"""
        self.cursor.execute('''
            INSERT OR REPLACE INTO guild_settings 
            (guild_id, enabled_events) 
            VALUES (?, ?)
        ''', (guild_id, str(enabled_events)))
        self.conn.commit()

    def update_settings(self, guild_id: int, channel_id: Optional[int] = None, enabled_events: Optional[Dict] = None):
        """Update either channel, events, or both"""
        current = self.get_guild_settings(guild_id) or {}
        
        new_channel = channel_id if channel_id is not None else current.get('log_channel_id')
        new_events = enabled_events if enabled_events is not None else current.get('enabled_events')
        
        self.cursor.execute('''
            INSERT OR REPLACE INTO guild_settings 
            (guild_id, log_channel_id, enabled_events) 
            VALUES (?, ?, ?)
        ''', (guild_id, new_channel, str(new_events) if new_events else None))
        self.conn.commit()

    def close(self):
        """Close database connection"""
        self.conn.close()