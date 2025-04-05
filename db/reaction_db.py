import sqlite3

class ReactionRolesDB:
    def __init__(self):
        self.conn = sqlite3.connect('reaction_roles.db')
        self.cursor = self.conn.cursor()
        self._init_db()
        self._migrate_db()

    def _init_db(self):
        """Initialize the database tables"""
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS reaction_role_messages (
                message_id INTEGER PRIMARY KEY,
                channel_id INTEGER NOT NULL,
                guild_id INTEGER NOT NULL,
                title TEXT NOT NULL
            )
        ''')
        
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS reaction_roles (
                message_id INTEGER NOT NULL,
                emoji TEXT NOT NULL,
                role_id INTEGER NOT NULL,
                PRIMARY KEY (message_id, emoji),
                FOREIGN KEY (message_id) REFERENCES reaction_role_messages(message_id)
            )
        ''')
        self.conn.commit()

    def _migrate_db(self):
        """Handle database schema migrations"""
        try:
            # Migration 1: Add color column
            self.cursor.execute("PRAGMA table_info(reaction_role_messages)")
            columns = [column[1] for column in self.cursor.fetchall()]
            if 'color' not in columns:
                self.cursor.execute('''
                    ALTER TABLE reaction_role_messages
                    ADD COLUMN color INTEGER DEFAULT 3447003
                ''')
                print("Database migration: Added color column")

            # Migration 2: Add description column
            self.cursor.execute("PRAGMA table_info(reaction_roles)")
            role_columns = [column[1] for column in self.cursor.fetchall()]
            if 'description' not in role_columns:
                self.cursor.execute('''
                    ALTER TABLE reaction_roles
                    ADD COLUMN description TEXT
                ''')
                print("Database migration: Added description column")

            self.conn.commit()
        except Exception as e:
            print(f"Database migration failed: {e}")
            self.conn.rollback()

    def add_reaction_role(self, message_id, channel_id, guild_id, title, color, emoji, role_id, description=None):
        """Add a new reaction role configuration"""
        self.cursor.execute('''
            INSERT OR REPLACE INTO reaction_role_messages 
            (message_id, channel_id, guild_id, title, color)
            VALUES (?, ?, ?, ?, ?)
        ''', (message_id, channel_id, guild_id, title, color))
        
        self.cursor.execute('''
            INSERT OR REPLACE INTO reaction_roles
            (message_id, emoji, role_id, description)
            VALUES (?, ?, ?, ?)
        ''', (message_id, str(emoji), role_id, description))
        self.conn.commit()

    def get_reaction_roles(self, message_id):
        """Get all reaction roles for a message"""
        self.cursor.execute('''
            SELECT emoji, role_id, description FROM reaction_roles
            WHERE message_id = ?
            ORDER BY rowid
        ''', (message_id,))
        return self.cursor.fetchall()

    def get_message_info(self, message_id):
        """Get message information"""
        self.cursor.execute('''
            SELECT channel_id, guild_id, title, color FROM reaction_role_messages
            WHERE message_id = ?
        ''', (message_id,))
        return self.cursor.fetchone()

    def remove_reaction_role(self, message_id, emoji):
        """Remove a specific reaction role"""
        self.cursor.execute('''
            DELETE FROM reaction_roles
            WHERE message_id = ? AND emoji = ?
        ''', (message_id, str(emoji)))
        self.conn.commit()

    def remove_all_message_roles(self, message_id):
        """Remove all reaction roles for a message"""
        self.cursor.execute('''
            DELETE FROM reaction_roles
            WHERE message_id = ?
        ''', (message_id,))
        self.cursor.execute('''
            DELETE FROM reaction_role_messages
            WHERE message_id = ?
        ''', (message_id,))
        self.conn.commit()

    def close(self):
        """Close the database connection"""
        self.conn.close()

""" async def setup(bot):
    await bot.add_cog(ReactionRolesDB(bot)) """