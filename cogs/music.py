import discord
from discord import app_commands
from discord.ext import commands
import yt_dlp
import asyncio
from collections import deque
import sqlite3
import aiohttp
from urllib.parse import quote
from youtubesearchpython import VideosSearch
from ytmusicapi import YTMusic

ytdl_format_options = {
    'format': 'bestaudio/best',
    'quiet': True,
    'no_warnings': True,
    'default_search': 'auto',
    'source_address': '0.0.0.0',
    'noplaylist': True,
    'ignoreerrors': False,
    'logtostderr': False,
    'nocheckcertificate': True,
    'cookiefile': 'lavalink/youtube_cookies.txt',
    'http_headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
}

ffmpeg_options = {
    'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
    'options': '-vn'
}

ytdl = yt_dlp.YoutubeDL(ytdl_format_options)

# Separate fast metadata-only extractor for quick search
fast_ytdl = yt_dlp.YoutubeDL({**ytdl_format_options, 'extract_flat': True})


class YTDLSource(discord.PCMVolumeTransformer):
    def __init__(self, source, *, data, volume=0.5):
        super().__init__(source, volume)
        self.data = data
        self.title = data.get('title')
        self.url = data.get('url')

    @classmethod
    async def from_url(cls, url, *, loop=None, stream=True):
        loop = loop or asyncio.get_event_loop()
        data = await loop.run_in_executor(None, lambda: ytdl.extract_info(url, download=not stream))
        if 'entries' in data:
            data = data['entries'][0]
        filename = data['url'] if stream else ytdl.prepare_filename(data)
        return cls(discord.FFmpegPCMAudio(filename, **ffmpeg_options), data=data)

import random

class Music(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.queues = {}
        self.looping = {}  # guild_id: bool
        self.history = {}  # guild_id: deque of (title, url)
        self.session = aiohttp.ClientSession()
        self.ytmusic = YTMusic()

        # Initialize database
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

    def is_dj_or_admin(self, interaction: discord.Interaction) -> bool:
        # Admin check
        if interaction.user.guild_permissions.administrator:
            return True

        # DJ role check
        self.cursor.execute('SELECT role_id FROM dj_roles WHERE guild_id = ?', (interaction.guild.id,))
        row = self.cursor.fetchone()
        if row and row[0]:
            dj_role_id = row[0]
            dj_role = interaction.guild.get_role(dj_role_id)
            if dj_role and dj_role in interaction.user.roles:
                return True

        return False

    def cog_unload(self):
        # Disconnect all voice clients
        for vc in self.bot.voice_clients:
            try:
                if vc.is_playing():
                    vc.stop()
                asyncio.create_task(vc.disconnect())
            except Exception:
                pass

        # Close database
        self.conn.close()

        # Close aiohttp session
        asyncio.create_task(self.session.close())

        # Reset autoplay and looping on unload
        self.looping.clear()
        if hasattr(self, 'autoplay'):
            self.autoplay.clear()

    @app_commands.command(name="setdj", description="Set the DJ role")
    @app_commands.describe(role="Role to set as DJ")
    async def setdj(self, interaction: discord.Interaction, role: discord.Role):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("Only administrators can set the DJ role.", ephemeral=True)
            return

        self.cursor.execute('''
            INSERT INTO dj_roles (guild_id, role_id)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET role_id=excluded.role_id
        ''', (interaction.guild.id, role.id))
        self.conn.commit()
        await interaction.response.send_message(f"🎧 DJ role set to {role.mention}")

    @app_commands.command(name="cleardj", description="Clear the DJ role")
    async def cleardj(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("Only administrators can clear the DJ role.", ephemeral=True)
            return

        self.cursor.execute('DELETE FROM dj_roles WHERE guild_id = ?', (interaction.guild.id,))
        self.conn.commit()
        await interaction.response.send_message("🎧 DJ role cleared.")

    @app_commands.command(name="autoplay", description="Toggle autoplay related songs when queue ends")
    async def autoplay_cmd(self, interaction: discord.Interaction):
        if not self.is_dj_or_admin(interaction):
            await interaction.response.send_message("You need DJ or Administrator permissions to toggle autoplay.", ephemeral=True)
            return

        if not hasattr(self, 'autoplay'):
            self.autoplay = {}

        current = self.autoplay.get(interaction.guild.id, False)
        self.autoplay[interaction.guild.id] = not current
        status = "enabled" if not current else "disabled"
        await interaction.response.send_message(f"🔄 Autoplay {status}.")

    def save_volume(self, guild_id, volume):
        self.cursor.execute('''
            INSERT INTO volumes (guild_id, volume)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET volume=excluded.volume
        ''', (guild_id, volume))
        self.conn.commit()

    def get_volume(self, guild_id):
        self.cursor.execute('SELECT volume FROM volumes WHERE guild_id = ?', (guild_id,))
        row = self.cursor.fetchone()
        if row:
            return row[0]
        else:
            return 0.5  # default volume 50%

    def get_queue(self, guild_id):
        if guild_id not in self.queues:
            self.queues[guild_id] = deque()
        return self.queues[guild_id]

    async def play_next(self, interaction):
        queue = self.get_queue(interaction.guild.id)
        if not queue:
            # Check autoplay
            if hasattr(self, 'autoplay') and self.autoplay.get(interaction.guild.id, False):
                # Use last played song as seed
                hist = self.history.get(interaction.guild.id, deque())
                if hist:
                    last_title, last_url = hist[0]
                    # Initialize before try-except
                    use_artist = False
                    # Try to get artist if history is still small
                    if len(hist) < 100:
                        try:
                            # Extract info again to get artist
                            data = await asyncio.to_thread(ytdl.extract_info, last_url, download=False)
                            artist = data.get('artist') or data.get('uploader') or data.get('channel')
                            if artist:
                                query = f"ytsearch:{artist}"
                                use_artist = True
                        except:
                            pass
                    if not use_artist:
                        query = f"ytsearch:{last_title}"
                    try:
                        data = await asyncio.to_thread(ytdl.extract_info, query, download=False)
                        if 'entries' in data and data['entries']:
                            first = data['entries'][0]
                            url = first['webpage_url']
                            title = first.get('title', 'Unknown title')
                            queue.append((url, title))
                            await self.play_next(interaction)
                            return
                    except:
                        pass

            vc = interaction.guild.voice_client
            if vc and vc.is_connected():
                await vc.disconnect()
            # Reset autoplay and looping on disconnect
            if hasattr(self, 'autoplay'):
                self.autoplay.pop(interaction.guild.id, None)
            self.looping.pop(interaction.guild.id, None)
            return

        # Loop mode: if enabled, re-add current song to end of queue
        looping = self.looping.get(interaction.guild.id, False)

        url, title = queue.popleft()
        if looping:
            queue.append((url, title))

        # Save to history
        hist = self.history.setdefault(interaction.guild.id, deque(maxlen=100))
        hist.appendleft((title, url))

        try:
            # Perform full extraction just before playback for faster queuing
            data = await asyncio.to_thread(ytdl.extract_info, url, download=False)
            if 'entries' in data:
                data = data['entries'][0]
            player = YTDLSource(
                discord.FFmpegPCMAudio(data['url'], **ffmpeg_options),
                data=data
            )
            # Set saved volume
            saved_volume = self.get_volume(interaction.guild.id)
            player.volume = saved_volume

            vc = interaction.guild.voice_client
            vc.play(player, after=lambda e: asyncio.run_coroutine_threadsafe(self.play_next(interaction), self.bot.loop))

            embed = discord.Embed(title="🎵 Now Playing", description=f"**{data.get('title', title)}**", color=discord.Color.green())
            await interaction.followup.send(embed=embed)
        except Exception as e:
            embed = discord.Embed(title="❌ Error", description=f"Error playing song: {e}", color=discord.Color.red())
            await interaction.followup.send(embed=embed)
            await self.play_next(interaction)

    @app_commands.command(name="join", description="Join your voice channel")
    async def join(self, interaction: discord.Interaction):
        if not interaction.user.voice or not interaction.user.voice.channel:
            await interaction.response.send_message("You are not connected to a voice channel.", ephemeral=True)
            return

        channel = interaction.user.voice.channel
        if interaction.guild.voice_client:
            await interaction.guild.voice_client.move_to(channel)
        else:
            await channel.connect()

        await interaction.response.send_message(f"Joined {channel.mention}!", ephemeral=True)

    @app_commands.command(name="play", description="Play a song from YouTube")
    @app_commands.describe(query="The search query or URL")
    async def play(self, interaction: discord.Interaction, query: str):
        await interaction.response.defer()

        # Connect to voice ASAP to overlap latency
        if not interaction.user.voice or not interaction.user.voice.channel:
            await interaction.followup.send("You are not connected to a voice channel.", ephemeral=True)
            return

        if not interaction.guild.voice_client:
            await interaction.user.voice.channel.connect()

        if not query:
            await interaction.followup.send("You must provide a search query or URL.", ephemeral=True)
            return

        # If not URL, treat as search
        if not query.startswith(('http://', 'https://')):
            try:
                search_url = f"https://yewtu.be/search?q={quote(query)}"
                async with self.session.get(search_url, ssl=False, headers={"User-Agent": "Mozilla/5.0"}) as resp:
                    if resp.status != 200:
                        await interaction.followup.send("Invidious search failed.", ephemeral=True)
                        return
                    html = await resp.text()
                    import re
                    matches = re.findall(r'/watch\?v=[\w-]+', html)
                    if not matches:
                        # Fallback to yt-dlp search
                        try:
                            data = await asyncio.to_thread(ytdl.extract_info, f"ytsearch:{query}", download=False)
                            if 'entries' in data and data['entries']:
                                first = data['entries'][0]
                                url = first.get('webpage_url')
                                title = first.get('title', query)
                            else:
                                await interaction.followup.send("No results found.", ephemeral=True)
                                return
                        except Exception as e:
                            await interaction.followup.send(f"Search error: {e}", ephemeral=True)
                            return
                    else:
                        # Deduplicate matches
                        seen = set()
                        unique_matches = []
                        for m in matches:
                            if m not in seen:
                                seen.add(m)
                                unique_matches.append(m)
                        video_path = unique_matches[0]
                        url = "https://www.youtube.com" + video_path
                        title = query  # Placeholder, will update after extraction
            except Exception as e:
                await interaction.followup.send(f"Search error: {e}", ephemeral=True)
                return
        else:
            url = query
            title = query  # Will be updated after extraction

        try:
            queue = self.get_queue(interaction.guild.id)
            queue.append((url, title))

            vc = interaction.guild.voice_client
            if not vc.is_playing() and not vc.is_paused():
                await self.play_next(interaction)
            else:
                await interaction.followup.send(f"🎵 Added **{title}** to the queue.")
        except Exception as e:
            await interaction.followup.send(f"Error: {e}", ephemeral=True)

    @app_commands.command(name="skip", description="Skip the current song")
    async def skip(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not vc.is_playing():
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        vc.stop()
        await interaction.response.send_message("⏭️ Skipped.")

    @app_commands.command(name="seek", description="Seek to a position in the current song (seconds)")
    @app_commands.describe(seconds="Number of seconds to seek to")
    async def seek(self, interaction: discord.Interaction, seconds: int):
        vc = interaction.guild.voice_client
        if not vc or not vc.is_playing():
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        source = vc.source
        if not isinstance(source, YTDLSource):
            await interaction.response.send_message("Cannot seek in this audio source.", ephemeral=True)
            return

        # Recreate FFmpegPCMAudio with -ss option
        try:
            data = source.data
            url = data.get('url')
            before_opts = f"-ss {seconds} -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5"
            ffmpeg_opts = {
                'before_options': before_opts,
                'options': '-vn'
            }
            new_source = discord.FFmpegPCMAudio(url, **ffmpeg_opts)
            new_player = YTDLSource(new_source, data=data, volume=source.volume)
            vc.stop()
            vc.play(new_player)
            await interaction.response.send_message(f"⏩ Seeked to {seconds} seconds.")
        except Exception as e:
            await interaction.response.send_message(f"Error seeking: {e}", ephemeral=True)

    @app_commands.command(name="move", description="Move a song in the queue")
    @app_commands.describe(from_pos="Current position (starting from 1)", to_pos="New position (starting from 1)")
    async def move(self, interaction: discord.Interaction, from_pos: int, to_pos: int):
        if not self.is_dj_or_admin(interaction):
            await interaction.response.send_message("You need DJ or Administrator permissions to move songs.", ephemeral=True)
            return

        queue = self.get_queue(interaction.guild.id)
        if from_pos < 1 or from_pos > len(queue) or to_pos < 1 or to_pos > len(queue):
            await interaction.response.send_message("Invalid positions.", ephemeral=True)
            return

        song = queue[from_pos - 1]
        del queue[from_pos - 1]
        queue.insert(to_pos - 1, song)
        await interaction.response.send_message(f"Moved **{song[1]}** from position {from_pos} to {to_pos}.")

    @app_commands.command(name="remove", description="Remove a song from the queue by position")
    @app_commands.describe(position="Position in the queue (starting from 1)")
    async def remove(self, interaction: discord.Interaction, position: int):
        if not self.is_dj_or_admin(interaction):
            await interaction.response.send_message("You need DJ or Administrator permissions to remove songs.", ephemeral=True)
            return

        queue = self.get_queue(interaction.guild.id)
        if position < 1 or position > len(queue):
            await interaction.response.send_message("Invalid position.", ephemeral=True)
            return

        removed = queue[position - 1]
        del queue[position - 1]
        await interaction.response.send_message(f"Removed **{removed[1]}** from the queue.")

    @app_commands.command(name="clear", description="Clear the entire queue")
    async def clear(self, interaction: discord.Interaction):
        if not self.is_dj_or_admin(interaction):
            await interaction.response.send_message("You need DJ or Administrator permissions to clear the queue.", ephemeral=True)
            return

        queue = self.get_queue(interaction.guild.id)
        queue.clear()
        await interaction.response.send_message("🗑️ Cleared the queue.")

    @app_commands.command(name="shuffle", description="Shuffle the queue")
    async def shuffle(self, interaction: discord.Interaction):
        queue = self.get_queue(interaction.guild.id)
        if len(queue) < 2:
            await interaction.response.send_message("Not enough songs in the queue to shuffle.", ephemeral=True)
            return

        random.shuffle(queue)
        await interaction.response.send_message("🔀 Shuffled the queue.")

    @app_commands.command(name="loop", description="Toggle looping the current song")
    async def loop(self, interaction: discord.Interaction):
        if not self.is_dj_or_admin(interaction):
            await interaction.response.send_message("You need DJ or Administrator permissions to toggle loop.", ephemeral=True)
            return

        current = self.looping.get(interaction.guild.id, False)
        self.looping[interaction.guild.id] = not current
        status = "enabled" if not current else "disabled"
        await interaction.response.send_message(f"🔁 Looping {status}.")

    @app_commands.command(name="pause", description="Pause playback")
    async def pause(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not vc.is_playing():
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        vc.pause()
        await interaction.response.send_message("⏸️ Paused.")

    @app_commands.command(name="resume", description="Resume playback")
    async def resume(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not vc.is_paused():
            await interaction.response.send_message("Nothing is paused.", ephemeral=True)
            return

        vc.resume()
        await interaction.response.send_message("▶️ Resumed.")

    @app_commands.command(name="stop", description="Stop playback and disconnect")
    async def stop(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc:
            await interaction.response.send_message("Not connected.", ephemeral=True)
            return

        queue = self.get_queue(interaction.guild.id)
        queue.clear()
        vc.stop()
        await vc.disconnect()
        await interaction.response.send_message("⏹️ Stopped and disconnected.")

    @app_commands.command(name="replay", description="Replay the current song from the beginning")
    async def replay(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not vc.is_playing():
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        source = vc.source
        if not isinstance(source, YTDLSource):
            await interaction.response.send_message("Cannot replay this audio source.", ephemeral=True)
            return

        try:
            data = source.data
            url = data.get('url')
            before_opts = "-ss 0 -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5"
            ffmpeg_opts = {
                'before_options': before_opts,
                'options': '-vn'
            }
            new_source = discord.FFmpegPCMAudio(url, **ffmpeg_opts)
            new_player = YTDLSource(new_source, data=data, volume=source.volume)
            vc.stop()
            vc.play(new_player)
            await interaction.response.send_message("🔁 Replaying current song.")
        except Exception as e:
            await interaction.response.send_message(f"Error replaying: {e}", ephemeral=True)

    @app_commands.command(name="history", description="Show recently played songs")
    async def history_cmd(self, interaction: discord.Interaction):
        hist = self.history.get(interaction.guild.id, deque())
        if not hist:
            await interaction.response.send_message("No history yet.", ephemeral=True)
            return

        desc = ""
        for idx, (title, url) in enumerate(hist, 1):
            desc += f"{idx}. **{title}**\n"

        embed = discord.Embed(title="🎶 Recently Played", description=desc, color=discord.Color.purple())
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="queue", description="Show the current queue")
    async def queue_cmd(self, interaction: discord.Interaction):
        queue = self.get_queue(interaction.guild.id)
        if not queue:
            await interaction.response.send_message("The queue is empty.", ephemeral=True)
            return

        desc = ""
        for idx, (url, title) in enumerate(queue, 1):
            desc += f"{idx}. **{title}**\n"

        embed = discord.Embed(title="🎶 Queue", description=desc, color=discord.Color.blue())
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="nowplaying", description="Show the currently playing song")
    async def nowplaying(self, interaction: discord.Interaction):
        vc = interaction.guild.voice_client
        if not vc or not vc.is_playing():
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        source = vc.source
        title = getattr(source, 'title', 'Unknown title')

        embed = discord.Embed(title="🎵 Now Playing", description=f"**{title}**", color=discord.Color.green())
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="volume", description="Set or show playback volume (0-200%)")
    @app_commands.describe(level="Volume level (0-200)")
    async def volume(self, interaction: discord.Interaction, level: int = None):
        if level is None:
            # Show current saved volume
            saved_volume = self.get_volume(interaction.guild.id)
            percent = int(saved_volume * 100)
            await interaction.response.send_message(f"🔊 Current volume is {percent}%.", ephemeral=True)
            return

        if level < 0 or level > 200:
            await interaction.response.send_message("Volume must be between 0 and 200.", ephemeral=True)
            return

        vc = interaction.guild.voice_client
        if not vc or not vc.source:
            await interaction.response.send_message("Nothing is playing.", ephemeral=True)
            return

        new_volume = level / 100
        # Save volume to database
        self.save_volume(interaction.guild.id, new_volume)

        vc.source.volume = new_volume
        await interaction.response.send_message(f"🔊 Volume set to {level}%.")


async def setup(bot):
    # Warm up yt_dlp to reduce first extraction latency
    async def warmup():
        try:
            # Use a very fast flat extraction on a popular video
            await asyncio.to_thread(fast_ytdl.extract_info, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", download=False)
        except Exception:
            pass  # Ignore errors during warmup

    bot.loop.create_task(warmup())
    await bot.add_cog(Music(bot))
