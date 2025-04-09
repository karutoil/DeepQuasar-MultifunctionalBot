import discord
from discord import app_commands
from discord.ext import commands
import wavelink
import sqlite3
import asyncio
import os
from collections import deque

class MusicCog(commands.Cog):
    """Advanced music cog using Wavelink 3.5.1, Lavalink 4, YouTube plugin, with slash commands."""

    def __init__(self, bot: commands.Bot):
        import uuid

        self.bot = bot
        self.node_ready = False

        # SQLite DB
        self.conn = sqlite3.connect('data/musicbot.db')
        self.cursor = self.conn.cursor()

        # Create tables if not exist
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
        # New: bot_config table for persistent settings
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS bot_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        ''')
        self.conn.commit()

        # Load or generate unique node identifier
        self.cursor.execute('SELECT value FROM bot_config WHERE key = ?', ('node_identifier',))
        row = self.cursor.fetchone()
        if row:
            self.node_identifier = row[0]
        else:
            self.node_identifier = str(uuid.uuid4())
            self.cursor.execute('INSERT INTO bot_config (key, value) VALUES (?, ?)', ('node_identifier', self.node_identifier))
            self.conn.commit()

        # In-memory state
        self.looping = {}    # guild_id: bool
        self.autoplay = {}   # guild_id: bool
        self.history = {}    # guild_id: deque of (title, url)
        self.queues = {}     # guild_id: deque of wavelink.Playable

        # Connect Lavalink node
        self.bot.loop.create_task(self.connect_node())

    async def connect_node(self):
        try:
            lavalink_host = os.getenv('LAVALINK_HOST', 'localhost')
            lavalink_port = os.getenv('LAVALINK_PORT', '2333')
            lavalink_password = os.getenv('LAVALINK_PASSWORD', 'youshallnotpass')
            node = wavelink.Node(
                uri=f'http://{lavalink_host}:{lavalink_port}',
                password=lavalink_password,
                identifier=self.node_identifier,
            )
            await wavelink.Pool.connect(nodes=[node], client=self.bot)
            print(f'[Wavelink] Node connection initiated with identifier: {self.node_identifier}')
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
                except Exception:
                    pass

            # Disconnect all Wavelink nodes asynchronously
            try:
                asyncio.create_task(wavelink.Pool.disconnect())
            except Exception:
                pass

            # Close SQLite database connection
            self.conn.close()

            # Optionally clear in-memory state
            self.looping.clear()
            self.autoplay.clear()
            self.history.clear()
            self.queues.clear()

        except Exception:
            pass

    def get_saved_volume(self, guild_id: int) -> float:
        self.cursor.execute('SELECT volume FROM volumes WHERE guild_id = ?', (guild_id,))
        row = self.cursor.fetchone()
        if row:
            return row[0]
        return 1.0

    @commands.Cog.listener()
    async def on_wavelink_track_end(self, payload):
        player = getattr(payload, "player", None)
        if not player or not getattr(player, "guild", None):
            return  # Player or guild no longer exists

        guild_id = int(player.guild.id)
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

        # Autoplay logic (skip for livestreams)
        if self.autoplay.get(guild_id, False) and payload.track and getattr(payload.track, "length", 1) > 0:
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

        # Else, disconnect only if not playing
        try:
            if not queue and not payload.player.playing:
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
            embed = discord.Embed(
                title="⚠️ Voice Channel Required",
                description="You are not connected to a voice channel.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        channel = interaction.user.voice.channel
        if interaction.guild.voice_client:
            await interaction.guild.voice_client.move_to(channel)
        else:
            await channel.connect(cls=wavelink.Player)

        embed = discord.Embed(
            title="🎶 Connected",
            description=f"Joined {channel.mention}!",
            color=discord.Color.green()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="leave", description="Leave the voice channel")
    async def leave_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc:
            embed = discord.Embed(
                title="⚠️ Not Connected",
                description="I'm not connected to a voice channel.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.disconnect()
        embed = discord.Embed(
            title="👋 Disconnected",
            description="Left the voice channel.",
            color=discord.Color.green()
        )
        embed.set_footer(text="MusicBot")
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

        # Determine if playlist or single track(s)
        playlist_name = None
        track_list = []

        if isinstance(tracks, wavelink.Playlist):
            playlist_name = tracks.name
            track_list = tracks.tracks[:100]  # Limit to 100 tracks
        else:
            # tracks is a list of Playable
            track_list = tracks[:1] if tracks else []

        if not track_list:
            embed = discord.Embed(description="No playable tracks found.", color=discord.Color.red())
            await interaction.followup.send(embed=embed, ephemeral=True)
            return

        guild_id = interaction.guild.id
        if guild_id not in self.queues:
            self.queues[guild_id] = deque()

        # Attach requester and add tracks to queue
        for t in track_list:
            t.requester = interaction.user
            self.queues[guild_id].append(t)

        # If player is not playing, start first track immediately
        if not player.playing:
            next_track = self.queues[guild_id].popleft()
            await player.play(next_track)

            # Set saved volume
            vol = self.get_saved_volume(guild_id)
            await player.set_volume(int(vol * 100))

            embed = discord.Embed(
                title="🎵 Now Playing",
                description=f"**{next_track.title} - {getattr(next_track, 'author', '')}**",
                color=discord.Color.green()
            )
            embed.set_footer(text="MusicBot")
            await interaction.followup.send(embed=embed)
        else:
            if playlist_name:
                embed = discord.Embed(
                    title="➕ Playlist Queued",
                    description=f"Added **{len(track_list)}** tracks from playlist **{playlist_name}**.",
                    color=discord.Color.blurple()
                )
            else:
                embed = discord.Embed(
                    title="➕ Added to Queue",
                    description=f"**{track_list[0].title} - {getattr(track_list[0], 'author', '')}**",
                    color=discord.Color.blurple()
                )
            embed.set_footer(text="MusicBot")
            await interaction.followup.send(embed=embed)

    @app_commands.command(name="skip", description="Skip the current track")
    async def skip_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            embed = discord.Embed(description="Nothing is playing.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.stop()

        embed = discord.Embed(
            title="⏭️ Skipped",
            description="Skipped the current track.",
            color=discord.Color.orange()
        )
        embed.set_footer(text="MusicBot")
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
        embed = discord.Embed(
            title="⏹️ Stopped",
            description="Playback stopped and queue cleared.",
            color=discord.Color.orange()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="pause", description="Pause playback")
    async def pause_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            embed = discord.Embed(description="Nothing is playing.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.pause(True)
        embed = discord.Embed(
            title="⏸️ Paused",
            description="Playback paused.",
            color=discord.Color.orange()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="resume", description="Resume playback")
    async def resume_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.paused:
            embed = discord.Embed(description="Nothing is paused.", color=discord.Color.red())
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.pause(False)
        embed = discord.Embed(
            title="▶️ Resumed",
            description="Playback resumed.",
            color=discord.Color.green()
        )
        embed.set_footer(text="MusicBot")
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
            desc += f"{idx}. {track.title} - {getattr(track, 'author', '')}\n"

        embed = discord.Embed(
            title="🎶 Current Queue",
            description=desc,
            color=discord.Color.blurple()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    class NowPlayingView(discord.ui.View):
        def __init__(self, cog, *, timeout=60):
            super().__init__(timeout=timeout)
            self.cog = cog

        @discord.ui.button(label="Show Queue", style=discord.ButtonStyle.blurple, emoji="📜")
        async def show_queue(self, interaction: discord.Interaction, button: discord.ui.Button):
            await self.cog.queue_slash(interaction)

        @discord.ui.button(label="Skip", style=discord.ButtonStyle.green, emoji="⏭️")
        async def skip(self, interaction: discord.Interaction, button: discord.ui.Button):
            await self.cog.skip_slash(interaction)

        @discord.ui.button(label="Replay", style=discord.ButtonStyle.blurple, emoji="🔁")
        async def replay(self, interaction: discord.Interaction, button: discord.ui.Button):
            await self.cog.replay_slash(interaction)

    @app_commands.command(name="nowplaying", description="Show the currently playing track")
    async def nowplaying_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            embed = discord.Embed(
                title="⚠️ Nothing Playing",
                description="There is no track currently playing.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            view = self.NowPlayingView(self)
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
            return

        current = vc.current
        if not current:
            embed = discord.Embed(
                title="⚠️ Nothing Playing",
                description="There is no track currently playing.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        position_ms = vc.position
        duration_ms = current.length

        pos_min, pos_sec = divmod(position_ms // 1000, 60)
        dur_min, dur_sec = divmod(duration_ms // 1000, 60)
        remaining_ms = max(duration_ms - position_ms, 0)
        rem_min, rem_sec = divmod(remaining_ms // 1000, 60)

        # Compose title with track title and author if available
        track_title = current.title
        track_author = getattr(current, "author", None)
        if track_author:
            title_text = f"{track_title} - {track_author}"
        else:
            title_text = track_title

        # Generate progress bar
        bar_length = 12
        progress_ratio = position_ms / duration_ms if duration_ms else 0
        filled_length = int(bar_length * progress_ratio)
        bar = "▇" + "▬" * (bar_length - 1)
        if filled_length > 0 and filled_length < bar_length:
            bar = "▬" * (filled_length - 1) + "▇" + "▬" * (bar_length - filled_length)
        elif filled_length == 0:
            bar = "▇" + "▬" * (bar_length - 1)
        elif filled_length >= bar_length:
            bar = "▬" * (bar_length - 1) + "▇"

        # Compose timestamp string
        timestamp = f"`{pos_min}:{pos_sec:02d} / {dur_min}:{dur_sec:02d}`"

        # Attempt to get artwork URL
        artwork_url = None
        if hasattr(current, "artwork_url"):
            artwork_url = current.artwork_url
        elif hasattr(current, "thumbnail"):
            artwork_url = current.thumbnail
        elif hasattr(current, "info") and isinstance(current.info, dict):
            artwork_url = current.info.get("artworkUrl")

        # Compose footer with requester and channel
        requester = getattr(current, "requester", None)
        if requester:
            requester_text = str(requester)
        else:
            requester_text = "Unknown"

        channel_name = interaction.channel.name if interaction.channel else "Unknown"

        footer_text = f"{requester_text} 🎧🎶 #{channel_name}"

        embed = discord.Embed(
            color=discord.Color.blurple()
        )
        embed.set_author(name="Now playing 🎵")
        embed.title = title_text
        embed.description = f"{bar}\n{timestamp}"
        if artwork_url:
            embed.set_thumbnail(url=artwork_url)
        embed.set_footer(text=footer_text)

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
            embed = discord.Embed(
                title="🔊 Current Volume",
                description=f"{percent}%",
                color=discord.Color.blurple()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        # Validate range
        if level < 0 or level > 200:
            embed = discord.Embed(
                title="⚠️ Invalid Volume",
                description="Volume must be between 0 and 200.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
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

        embed = discord.Embed(
            title="🔊 Volume Updated",
            description=f"Set to {level}%.",
            color=discord.Color.green()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="loop", description="Toggle looping the current track")
    async def loop_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        current = self.looping.get(guild_id, False)
        self.looping[guild_id] = not current
        status = "enabled" if not current else "disabled"
        embed = discord.Embed(
            title="🔁 Looping",
            description=f"Looping {status}.",
            color=discord.Color.blurple()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="shuffle", description="Shuffle the queue")
    async def shuffle_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        queue = self.queues.get(guild_id, deque())
        if len(queue) < 2:
            embed = discord.Embed(
                title="⚠️ Not Enough Songs",
                description="Add more songs to the queue before shuffling.",
                color=discord.Color.orange()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        import random
        random.shuffle(queue)
        embed = discord.Embed(
            title="🔀 Shuffled",
            description="The queue has been shuffled.",
            color=discord.Color.blurple()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="clear", description="Clear the queue")
    async def clear_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        if guild_id in self.queues:
            self.queues[guild_id].clear()
        embed = discord.Embed(
            title="🗑️ Queue Cleared",
            description="The queue has been emptied.",
            color=discord.Color.orange()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="replay", description="Replay the current track from the beginning")
    async def replay_slash(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            embed = discord.Embed(
                title="⚠️ Nothing Playing",
                description="There is no track currently playing.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        current = vc.current
        if not current:
            embed = discord.Embed(
                title="⚠️ Nothing Playing",
                description="There is no track currently playing.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        await vc.seek(0)
        embed = discord.Embed(
            title="🔁 Replaying",
            description="Restarted the current track.",
            color=discord.Color.green()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="seek", description="Seek to a position in the current track (seconds)")
    @app_commands.describe(seconds="Number of seconds to seek to")
    async def seek_slash(self, interaction: discord.Interaction, seconds: int):
        vc = interaction.guild.voice_client
        if not vc or not isinstance(vc, wavelink.Player) or not vc.playing:
            embed = discord.Embed(
                title="⚠️ Nothing Playing",
                description="There is no track currently playing.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        ms = max(0, seconds * 1000)
        await vc.seek(ms)
        embed = discord.Embed(
            title="⏩ Seeked",
            description=f"Moved to {seconds} seconds.",
            color=discord.Color.green()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="history", description="Show recently played tracks")
    async def history_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        hist = self.history.get(guild_id, deque())
        if not hist:
            embed = discord.Embed(
                title="ℹ️ No History",
                description="No tracks have been played yet.",
                color=discord.Color.orange()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        desc = ""
        for idx, (title, url) in enumerate(hist, 1):
            desc += f"{idx}. {title}\n"

        embed = discord.Embed(
            title="📜 Recently Played",
            description=desc,
            color=discord.Color.blurple()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="autoplay", description="Toggle autoplay related tracks")
    async def autoplay_slash(self, interaction: discord.Interaction):
        guild_id = interaction.guild.id
        current = self.autoplay.get(guild_id, False)
        self.autoplay[guild_id] = not current
        status = "enabled" if not current else "disabled"
        embed = discord.Embed(
            title="🔄 Autoplay",
            description=f"Autoplay {status}.",
            color=discord.Color.blurple()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="setdj", description="Set the DJ role")
    @app_commands.describe(role="Role to set as DJ")
    async def setdj_slash(self, interaction: discord.Interaction, role: discord.Role):
        if not interaction.user.guild_permissions.administrator:
            embed = discord.Embed(
                title="⚠️ Permission Denied",
                description="Only administrators can set the DJ role.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        guild_id = interaction.guild.id
        self.cursor.execute('''
            INSERT INTO dj_roles (guild_id, role_id)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET role_id=excluded.role_id
        ''', (guild_id, role.id))
        self.conn.commit()
        embed = discord.Embed(
            title="🎧 DJ Role Set",
            description=f"DJ role set to {role.mention}",
            color=discord.Color.green()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="cleardj", description="Clear the DJ role")
    async def cleardj_slash(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            embed = discord.Embed(
                title="⚠️ Permission Denied",
                description="Only administrators can clear the DJ role.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        guild_id = interaction.guild.id
        self.cursor.execute('DELETE FROM dj_roles WHERE guild_id = ?', (guild_id,))
        self.conn.commit()
        embed = discord.Embed(
            title="🎧 DJ Role Cleared",
            description="DJ role has been cleared.",
            color=discord.Color.orange()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="move", description="Move a track in the queue")
    @app_commands.describe(from_pos="Current position (starting from 1)", to_pos="New position (starting from 1)")
    async def move_slash(self, interaction: discord.Interaction, from_pos: int, to_pos: int):
        guild_id = interaction.guild.id
        queue = self.queues.get(guild_id, deque())

        if from_pos < 1 or from_pos > len(queue) or to_pos < 1 or to_pos > len(queue):
            embed = discord.Embed(
                title="⚠️ Invalid Positions",
                description="Please provide valid queue positions.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        track = queue[from_pos - 1]
        del queue[from_pos - 1]
        queue.insert(to_pos - 1, track)
        embed = discord.Embed(
            title="🔀 Track Moved",
            description=f"Moved **{track.title}** from position {from_pos} to {to_pos}.",
            color=discord.Color.blurple()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="remove", description="Remove a track from the queue by position")
    @app_commands.describe(position="Position in the queue (starting from 1)")
    async def remove_slash(self, interaction: discord.Interaction, position: int):
        guild_id = interaction.guild.id
        queue = self.queues.get(guild_id, deque())

        if position < 1 or position > len(queue):
            embed = discord.Embed(
                title="⚠️ Invalid Position",
                description="Please provide a valid queue position.",
                color=discord.Color.red()
            )
            embed.set_footer(text="MusicBot")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return

        track = queue[position - 1]
        del queue[position - 1]
        embed = discord.Embed(
            title="❌ Track Removed",
            description=f"Removed **{track.title}** from the queue.",
            color=discord.Color.orange()
        )
        embed.set_footer(text="MusicBot")
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(MusicCog(bot))
