import sqlite3

class AutoRoleDB:
    def __init__(self):
        self.conn = sqlite3.connect('autorole.db')
        self.cursor = self.conn.cursor()
        self._init_db()

    def _init_db(self):
        """Initialize the database table"""
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS autoroles (
                guild_id INTEGER PRIMARY KEY,
                role_id INTEGER NOT NULL
            )
        ''')
        self.conn.commit()

    def get_autorole(self, guild_id):
        """Get the auto-role for a guild"""
        self.cursor.execute('SELECT role_id FROM autoroles WHERE guild_id = ?', (guild_id,))
        result = self.cursor.fetchone()
        return result[0] if result else None

    def set_autorole(self, guild_id, role_id):
        """Set the auto-role for a guild"""
        self.cursor.execute('''
            INSERT OR REPLACE INTO autoroles (guild_id, role_id)
            VALUES (?, ?)
        ''', (guild_id, role_id))
        self.conn.commit()

    def remove_autorole(self, guild_id):
        """Remove the auto-role configuration for a guild"""
        self.cursor.execute('DELETE FROM autoroles WHERE guild_id = ?', (guild_id,))
        self.conn.commit()

    def get_all_autoroles(self):
        """Get all auto-role configurations"""
        self.cursor.execute('SELECT guild_id, role_id FROM autoroles')
        return dict(self.cursor.fetchall())

    def close(self):
        """Close the database connection"""
        self.conn.close()

""" async def setup(bot):
    await bot.add_cog(AutoRoleDB(bot)) """