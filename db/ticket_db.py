# db/ticket_db.py
import sqlite3
import ast
from typing import Optional, Dict, List

class TicketDB:
    def __init__(self):
        self.conn = sqlite3.connect('data/ticket.db')
        self.cursor = self.conn.cursor()
        self._init_db()

    def _init_db(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS ticket_settings (
                guild_id INTEGER PRIMARY KEY,
                category_open INTEGER,
                category_archive INTEGER,
                support_roles TEXT,
                log_channel INTEGER
            )
        ''')
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS tickets (
                channel_id INTEGER PRIMARY KEY,
                guild_id INTEGER,
                owner_id INTEGER,
                claimed_by INTEGER,
                members TEXT,
                status TEXT
            )
        ''')
        self.conn.commit()

    def set_guild_settings(self, guild_id: int, category_open: int, category_archive: int, support_roles: List[int], log_channel: int):
        self.cursor.execute('''
        INSERT OR REPLACE INTO ticket_settings 
        (guild_id, category_open, category_archive, support_roles, log_channel)
        VALUES (?, ?, ?, ?, ?)
        ''', (guild_id, category_open, category_archive, str(support_roles), log_channel))
        self.conn.commit()

    def get_guild_settings(self, guild_id: int) -> Optional[Dict]:
        self.cursor.execute('SELECT * FROM ticket_settings WHERE guild_id=?', (guild_id,))
        result = self.cursor.fetchone()
        if not result: return None
        _, cat_open, cat_arch, support_roles, log_channel = result
        return {
            'category_open': cat_open,
            'category_archive': cat_arch,
            'support_roles': ast.literal_eval(support_roles),
            'log_channel': log_channel
        }

    def create_ticket(self, channel_id: int, guild_id: int, owner_id: int, members: List[int]):
        self.cursor.execute(
            '''INSERT OR REPLACE INTO tickets (channel_id, guild_id, owner_id, claimed_by, members, status)
               VALUES (?, ?, ?, NULL, ?, 'open')''',
            (channel_id, guild_id, owner_id, str(members))
        )
        self.conn.commit()

    def get_ticket(self, channel_id: int) -> Optional[Dict]:
        self.cursor.execute('SELECT * FROM tickets WHERE channel_id=?', (channel_id,))
        res = self.cursor.fetchone()
        if not res: return None
        chan, guild, owner, claimed_by, members, status = res
        return {
            'channel_id': chan,
            'guild_id': guild,
            'owner_id': owner,
            'claimed_by': claimed_by,
            'members': ast.literal_eval(members),
            'status': status
        }

    def update_ticket(self, channel_id: int, **updates):
        ticket = self.get_ticket(channel_id)
        if not ticket: return
        claimed_by = updates.get('claimed_by', ticket['claimed_by'])
        members = updates.get('members', ticket['members'])
        status = updates.get('status', ticket['status'])
        self.cursor.execute('''
            UPDATE tickets SET claimed_by=?, members=?, status=?
            WHERE channel_id=?
        ''', (claimed_by, str(members), status, channel_id))
        self.conn.commit()

    def delete_ticket(self, channel_id: int):
        self.cursor.execute('DELETE FROM tickets WHERE channel_id=?', (channel_id,))
        self.conn.commit()

    def close(self):
        self.conn.close()
