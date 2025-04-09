import discord
from discord import app_commands
from discord.ext import commands
import wavelink
import sqlite3
import asyncio
from collections import deque

class MusicCog(commands.Cog):
    """Advanced music cog using Wavelink 3.5.1, Lavalink 4, YouTube plugin, with slash commands."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.node_ready = False
        self.bot.loop.create_task(self.connect_node())

        # In-memory state
        self.looping = {}    # guild_id: bool
        self.autoplay = {}   # guild_id: bool
        self.history = {}    # guild_id: deque of (title, url)
        self.queues = {}     # guild_id: deque of wavelink.Playable

        # SQLite DB
        self.conn = sqlite3.connect('data/musicbot.db')
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS volumes (
                guild_id INTEGER PRIMARY KEY,
                volume REAL NOT NULL
            )
        ''')
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS dj_roles (
                guild_id INTEGER PRIMARY KEY,
                role_id INTEGER
            )
        ''')
        self.conn.commit()

    async def connect_node(self):
        try:
            node = wavelink.Node(
                uri='http://localhost:2333',
                password='youshallnotpass',
                identifier='default-node',
            )
            await wavelink.Pool.connect(nodes=[node], client=self.bot)
            print('[Wavelink] Node connection initiated.')
        except Exception as e:
            print(f'[Wavelink] Failed to connect node: {e}')

    @commands.Cog.listener()
    async def on_wavelink_node_ready(self, payload):
        print(f"[Wavelink] Node '{payload.node.identifier}' connected and ready.")
        self.node_ready = True

    @commands.Cog.listener()
    async def on_wavelink_node_disconnected(self, payload):
        print(f"[Wavelink] Node '{payload.node.identifier}' disconnected. Attempting reconnect...")
        self.node_ready = False
        try:
            await wavelink.Pool.connect(nodes=[payload.node], client=self.bot)
            print(f"[Wavelink] Reconnection attempt to node '{payload.node.identifier}' initiated.")
        except Exception as e:
            print(f"[Wavelink] Failed to reconnect node: {e}")

    def cog_unload(self):
        try:
            # Disconnect all voice clients
            for vc in self.bot.voice_clients:
                try:
                    if vc.is_playing():
                        vc.stop()
                    asyncio.create_task(vc.disconnect())
                except:
                    pass
            # Close DB
            self.conn.close()
        except:
            pass

    def get_saved_volume(self, guild_id: int) -> float:
        self.cursor.execute('SELECT volume FROM volumes WHERE guild_id = ?', (guild_id,))
        row = self.cursor.fetchone()
        if row:
            return row[0]
        return 1.0

    @commands.Cog.listener()
    async def on_wavelink_track_end(self, payload):
        guild_id = int(payload.player.guild.id)
        looping = self.looping.get(guild_id, False)
        queue = self.queues.get(guild_id, deque())

        if looping and payload.track:
            # Re-add current track to front of queue
            queue.appendleft(payload.track)
            self.queues[guild_id] = queue

        # Play next track if available
        if queue:
            next_track = queue.popleft()
            await payload.player.play(next_track)
            # Set saved volume
            vol = self.get_saved_volume(guild_id)
            await payload.player.set_volume(int(vol * 100))
            return

        # Autoplay logic
        if self.autoplay.get(guild_id, False) and payload.track:
            # Search related track
            query = f"ytsearch:{payload.track.title}"
            try:
                results = await wavelink.Playable.search(query)
                if results:
                    next_track = results[0]
                    await payload.player.play(next_track)
                    vol = self.get_saved_volume(guild_id)
                    await payload.player.set_volume(int(vol * 100))
                    return
            except:
                pass

        # Else, disconnect
        try:
            await payload.player.disconnect()
        except:
            pass

    def is_dj_or_admin(self, interaction: discord.Interaction) -> bool:
        # Always allow admins
        if interaction.user.guild_permissions.administrator:
            return True

        # Check DJ role
        self.cursor.execute('SELECT role_id FROM dj_roles WHERE guild_id = ?', (interaction.guild.id,))
        row = self.cursor.fetchone()
        if not row or not row[0]:
            # No DJ role set, allow all
            return True

        dj_role = interaction.guild.get_role(row[0])
        if dj_role and dj_role in interaction.user.roles:
            return True

        return False

    @app_commands.command(name="join", description="Join your voice channel")
    async def join_slash(self, interaction: discord.Interaction):
        if not interaction.user.voice or not interaction.user.voice.channel:
            embed = discord.Embed(description="You are not connected to a voice channel.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        channel = interaction.user.voice.channel
        if interaction.guild.voice_client:
            await interaction.guild.voice_client.move_to(channel)
        else:
            await channel.connect(cls=wavelink.Player)

        embed = discord.Embed(description=f"✅ Joined {channel.mention}!", color=discord.Color.green())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="leave", description="Leave the voice channel")
    async def leave_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc:
            embed = discord.Embed(description="Not connected.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.disconnect()
        embed = discord.Embed(description="✅ Disconnected.", color=discord.Color.green())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="play", description="Play a song from YouTube")
    @app_commands.describe(query="Search query or URL")
    async def play_slash(self, interaction: discord.Interaction, query: str):
        await interaction.response.defer()

        # Connect if not connected
        if not interaction.guild.voice_client:
            if not interaction.user.voice or not interaction.user.voice.channel:
                embed = discord.Embed(description="You are not connected to a voice channel.", color=discord.Color.red())
                await interaction.followup.send(embed=embed, ephemeral=True)
                return
            await interaction.user.voice.channel.connect(cls=wavelink.Player)

        player = interaction.guild.voice_client
        if not isinstance(player, wavelink.Player):
            embed = discord.Embed(description="Voice client is not a Wavelink player.", color=discord.Color.red())
            await interaction.followup.send(embed=embed, ephemeral=True)
            return

        # Prefix query to use plugin
        if not query.startswith('http'):
            query = f'ytsearch:{query}'

        tracks = await wavelink.Playable.search(query)
        if not tracks:
            embed = discord.Embed(description="No results found.", color=discord.Color.red())
            await interaction.followup.send(embed=embed, ephemeral=True)
            return

        track = tracks[0]
        guild_id = interaction.guild.id
        if guild_id not in self.queues:
            self.queues[guild_id] = deque()
        self.queues[guild_id].append(track)

        if not player.playing:
            next_track = self.queues[guild_id].popleft()
            await player.play(next_track)
            embed = discord.Embed(description=f"▶️ Now playing: **{next_track.title}**", color=discord.Color.green())
            await interaction.followup.send(embed=embed)
        else:
            embed = discord.Embed(description=f"➕ Added to queue: **{track.title}**", color=discord.Color.blurple())
            await interaction.followup.send(embed=embed)

    @app_commands.command(name="skip", description="Skip the current track")
    async def skip_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            embed = discord.Embed(description="Nothing is playing.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.stop()

        guild_id = interaction.guild.id
        if guild_id in self.queues and self.queues[guild_id]:
            next_track = self.queues[guild_id].popleft()
            await vc.play(next_track)
            embed = discord.Embed(description=f"⏭️ Skipped. Now playing: **{next_track.title}**", color=discord.Color.green())
            await interaction.response.send_message(embed=embed, ephemeral=True)
        else:
            embed = discord.Embed(description="⏭️ Skipped. Queue is empty.", color=discord.Color.orange())
            await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="stop", description="Stop playback and clear the queue")
    async def stop_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player):
            embed = discord.Embed(description="Not connected.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        guild_id = interaction.guild.id
        if guild_id in self.queues:
            self.queues[guild_id].clear()

        await vc.stop()
        embed = discord.Embed(description="⏹️ Stopped playback and cleared the queue.", color=discord.Color.orange())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="pause", description="Pause playback")
    async def pause_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            embed = discord.Embed(description="Nothing is playing.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.pause(True)
        embed = discord.Embed(description="⏸️ Paused.", color=discord.Color.orange())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="resume", description="Resume playback")
    async def resume_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.paused:
            embed = discord.Embed(description="Nothing is paused.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.pause(False)
        embed = discord.Embed(description="▶️ Resumed.", color=discord.Color.green())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="queue", description="Show the current queue")
    async def queue_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        queue = self.queues.get(guild_id, deque())
        if not queue:
            embed = discord.Embed(description="Queue is empty.", color=discord.Color.orange())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        desc = ""
        for idx, track in enumerate(queue, 1):
            desc += f"{idx}. {track.title}\n"

        embed = discord.Embed(title="Queue", description=desc, color=discord.Color.blurple())
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="nowplaying", description="Show the currently playing track")
    async def nowplaying_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        current = vc.current
        if not current:
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        position_ms = vc.position
        duration_ms = current.length

        pos_min, pos_sec = divmod(position_ms // 1000, 60)
        dur_min, dur_sec = divmod(duration_ms // 1000, 60)
        remaining_ms = max(duration_ms - position_ms, 0)
        rem_min, rem_sec = divmod(remaining_ms // 1000, 60)

        embed = discord.Embed(
            title="Now Playing",
            description=(
                f"**{current.title}**\n"
                f"`{pos_min}:{pos_sec:02d} / {dur_min}:{dur_sec:02d}` elapsed\n"
                f"`{rem_min}:{rem_sec:02d}` remaining"
            ),
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="volume", description="Set or get playback volume (0-200%)")
    @app_commands.describe(level="Volume level (0-200)")
    async def volume_slash(self, interaction: discord.Interaction, level: int = None):
        guild_id = interaction.guild.id

        # Always show saved volume if no argument
        if level is None:
            self.cursor.execute('SELECT volume FROM volumes WHERE guild_id = ?', (guild_id,))
            row = self.cursor.fetchone()
            if row:
                percent = int(row[0] * 100)
            else:
                percent = 100
            await interaction.response.send_message(f"🔊 Current volume is {percent}%.", ephemeral=True)
            return

        # Validate range
        if level < 0 or level > 200:
            await interaction.response.send_message("Volume must be between 0 and 200.", ephemeral=True)
            return

        # Save to DB
        vol = level / 100
        self.cursor.execute('''
            INSERT INTO volumes (guild_id, volume)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET volume=excluded.volume
        ''', (guild_id, vol))
        self.conn.commit()

        # Set volume if connected
        vc = interaction.guild.voice_client
        if vc and isinstance(vc, wavelink.Player):
            await vc.set_volume(int(vol * 100))

        await interaction.response.send_message(f"🔊 Volume set to {level}%.", ephemeral=True)

    @app_commands.command(name="loop", description="Toggle looping the current track")
    async def loop_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        current = self.looping.get(guild_id, False)
        self.looping[guild_id] = not current
        status = "enabled" if not current else "disabled"
        await interaction.response.send_message(f"🔁 Looping {status}.", ephemeral=True)

    @app_commands.command(name="shuffle", description="Shuffle the queue")
    async def shuffle_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        queue = self.queues.get(guild_id, deque())
        if len(queue) < 2:
            await interaction.response.send_message("Not enough songs in the queue to shuffle.", ephemeral=True)
            return

        import random
        random.shuffle(queue)
        await interaction.response.send_message("🔀 Shuffled the queue.", ephemeral=True)

    @app_commands.command(name="clear", description="Clear the queue")
    async def clear_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        if guild_id in self.queues:
            self.queues[guild_id].clear()
        await interaction.response.send_message("🗑️ Cleared the queue.", ephemeral=True)

    @app_commands.command(name="replay", description="Replay the current track from the beginning")
    async def replay_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        current = vc.current
        if not current:
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        await vc.seek(0)
        await interaction.response.send_message("🔁 Replaying current track.", ephemeral=True)

    @app_commands.command(name="seek", description="Seek to a position in the current track (seconds)")
    @app_commands.describe(seconds="Number of seconds to seek to")
    async def seek_slash(self, interaction: discord.Interaction, seconds: int):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        ms = max(0, seconds * 1000)
        await vc.seek(ms)
        await interaction.response.send_message(f"⏩ Seeked to {seconds} seconds.", ephemeral=True)

    @app_commands.command(name="history", description="Show recently played tracks")
    async def history_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        hist = self.history.get(guild_id, deque())
        if not hist:
            await interaction.response.send_message("No history yet.", ephemeral=True)
            return

        desc = ""
        for idx, (title, url) in enumerate(hist, 1):
            desc += f"{idx}. {title}\n"

        embed = discord.Embed(title="Recently Played", description=desc)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="autoplay", description="Toggle autoplay related tracks")
    async def autoplay_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        current = self.autoplay.get(guild_id, False)
        self.autoplay[guild_id] = not current
        status = "enabled" if not current else "disabled"
        await interaction.response.send_message(f"🔄 Autoplay {status}.", ephemeral=True)

    @app_commands.command(name="setdj", description="Set the DJ role")
    @app_commands.describe(role="Role to set as DJ")
    async def setdj_slash(self, interaction: discord.Interaction, role: discord.Role):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("Only administrators can set the DJ role.", ephemeral=True)
            return

        guild_id = interaction.guild.id
        self.cursor.execute('''
            INSERT INTO dj_roles (guild_id, role_id)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET role_id=excluded.role_id
        ''', (guild_id, role.id))
        self.conn.commit()
        await interaction.response.send_message(f"🎧 DJ role set to {role.mention}", ephemeral=True)

    @app_commands.command(name="cleardj", description="Clear the DJ role")
    async def cleardj_slash(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("Only administrators can clear the DJ role.", ephemeral=True)
            return

        guild_id = interaction.guild.id
        self.cursor.execute('DELETE FROM dj_roles WHERE guild_id = ?', (guild_id,))
        self.conn.commit()
        await interaction.response.send_message("🎧 DJ role cleared.", ephemeral=True)

    @app_commands.command(name="move", description="Move a track in the queue")
    @app_commands.describe(from_pos="Current position (starting from 1)", to_pos="New position (starting from 1)")
    async def move_slash(self, interaction: discord.Interaction, from_pos: int, to_pos: int):
        guild_id = interaction.guild.id
        queue = self.queues.get(guild_id, deque())

        if from_pos < 1 or from_pos > len(queue) or to_pos < 1 or to_pos > len(queue):
            await interaction.response.send_message("Invalid positions.", ephemeral=True)
            return

        track = queue[from_pos - 1]
        del queue[from_pos - 1]
        queue.insert(to_pos - 1, track)
        await interaction.response.send_message(f"Moved **{track.title}** from position {from_pos} to {to_pos}.", ephemeral=True)

    @app_commands.command(name="remove", description="Remove a track from the queue by position")
    @app_commands.describe(position="Position in the queue (starting from 1)")
    async def remove_slash(self, interaction: discord.Interaction, position: int):
        guild_id = interaction.guild.id
        queue = self.queues.get(guild_id, deque())

        if position < 1 or position > len(queue):
            await interaction.response.send_message("Invalid position.", ephemeral=True)
            return

        track = queue[position - 1]
        del queue[position - 1]
        await interaction.response.send_message(f"Removed **{track.title}** from the queue.", ephemeral=True)

async def setup(bot):
    await bot.add_cog(MusicCog(bot))
