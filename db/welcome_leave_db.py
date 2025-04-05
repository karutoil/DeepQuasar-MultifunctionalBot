import sqlite3
from typing import Optional, Tuple

class WelcomeLeaveDB:
    def __init__(self, db_path: str = "data/musicbot.db"):
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        self._create_table()

    def _create_table(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS welcome_leave_settings (
                guild_id INTEGER PRIMARY KEY,
                welcome_channel_id INTEGER,
                leave_channel_id INTEGER
            )
        ''')
        self.conn.commit()

    def set_welcome_channel(self, guild_id: int, channel_id: Optional[int]):
        self.cursor.execute('''
            INSERT OR REPLACE INTO welcome_leave_settings (guild_id, welcome_channel_id, leave_channel_id)
            VALUES (?, ?, COALESCE((SELECT leave_channel_id FROM welcome_leave_settings WHERE guild_id = ?), NULL))
        ''', (guild_id, channel_id, guild_id))
        self.conn.commit()

    def set_leave_channel(self, guild_id: int, channel_id: Optional[int]):
        self.cursor.execute('''
            INSERT OR REPLACE INTO welcome_leave_settings (guild_id, welcome_channel_id, leave_channel_id)
            VALUES (?, COALESCE((SELECT welcome_channel_id FROM welcome_leave_settings WHERE guild_id = ?), NULL), ?)
        ''', (guild_id, guild_id, channel_id))
        self.conn.commit()

    def get_channels(self, guild_id: int) -> Tuple[Optional[int], Optional[int]]:
        self.cursor.execute('''
            SELECT welcome_channel_id, leave_channel_id FROM welcome_leave_settings WHERE guild_id = ?
        ''', (guild_id,))
        result = self.cursor.fetchone()
        if result:
            return result[0], result[1]
        return None, None
