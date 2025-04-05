import discord
from discord import app_commands
from discord.ext import commands
import yt_dlp as youtube_dl
import asyncio
from collections import deque
from discord.utils import get
from discord import Forbidden, HTTPException
import sqlite3  # Added for volume persistence

# Suppress noise about console usage from errors
youtube_dl.utils.bug_reports_message = lambda: ''

ytdl_format_options = {
    'format': 'bestaudio/best',
    'outtmpl': '%(extractor)s-%(id)s-%(title)s.%(ext)s',
    'restrictfilenames': True,
    'noplaylist': True,
    'nocheckcertificate': True,
    'ignoreerrors': False,
    'logtostderr': False,
    'quiet': True,
    'no_warnings': True,
    'default_search': 'auto',
    'source_address': '0.0.0.0',  # bind to ipv4 since ipv6 addresses cause issues sometimes
}

ffmpeg_options = {
    'options': '-vn',
    "before_options": "-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5"
}

ytdl = youtube_dl.YoutubeDL(ytdl_format_options)

class YTDLSource(discord.PCMVolumeTransformer):
    def __init__(self, source, *, data, volume=0.5):
        super().__init__(source, volume)
        self.data = data
        self.title = data.get('title')
        self.url = data.get('url')

    @classmethod
    async def from_url(cls, url, *, loop=None, stream=False):
        loop = loop or asyncio.get_event_loop()
        data = await loop.run_in_executor(None, lambda: ytdl.extract_info(url, download=not stream))
        
        if 'entries' in data:
            # Take first item from a playlist
            data = data['entries'][0]
        
        filename = data['url'] if stream else ytdl.prepare_filename(data)
        return cls(discord.FFmpegPCMAudio(filename, **ffmpeg_options), data=data)


class MusicBot(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.queues = {}

        # Initialize volume database
        self._init_db()

    def _init_db(self):
        self.conn = sqlite3.connect('data/musicbot.db')
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS volumes (
                guild_id INTEGER PRIMARY KEY,
                volume REAL NOT NULL
            )
        ''')
        self.conn.commit()

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
            return None

    async def cog_unload(self):
        self.conn.close()
    
    def get_queue(self, guild_id):
        if guild_id not in self.queues:
            self.queues[guild_id] = deque()
        return self.queues[guild_id]
    
    async def play_next(self, interaction):
        queue = self.get_queue(interaction.guild.id)
        if not queue:
            return
        
        # Get both URL and title from the queue
        next_item = queue.popleft()
        if isinstance(next_item, tuple):  # If queue stores (url, title)
            url, title = next_item
        else:  # For backward compatibility
            url = next_item
            # Try to get title again
            try:
                data = await asyncio.to_thread(ytdl.extract_info, url, download=False)
                title = data.get('title', 'Unknown title')
            except:
                title = 'Unknown title'
        
        try:
            player = await YTDLSource.from_url(url, loop=self.bot.loop, stream=True)
            player.title = title  # Ensure the title is set

            # Retrieve saved volume for this guild
            saved_volume = self.get_volume(interaction.guild.id)
            if saved_volume is not None:
                player.volume = saved_volume

            interaction.guild.voice_client.play(
                player, 
                after=lambda e: asyncio.run_coroutine_threadsafe(self.play_next(interaction), self.bot.loop)
            )
            
            embed = discord.Embed(
                title="🎵 Now Playing",
                description=f"**{title}**",
                color=discord.Color.green()
            )
            await interaction.followup.send(embed=embed)
        except Exception as e:
            embed = discord.Embed(
                title="❌ Error",
                description=f"Error playing song: {e}",
                color=discord.Color.red()
            )
            await interaction.followup.send(embed=embed)
            await self.play_next(interaction)
    
    @app_commands.command(name="join", description="Joins the voice channel")
    async def join(self, interaction: discord.Interaction):
        """Joins a voice channel"""
        if interaction.user.voice is None:
            embed = discord.Embed(
                title="❌ Error",
                description="You are not in a voice channel!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        channel = interaction.user.voice.channel
        if interaction.guild.voice_client is not None:
            await interaction.guild.voice_client.move_to(channel)
        else:
            await channel.connect()
        
        embed = discord.Embed(
            title="✅ Joined Voice Channel",
            description=f"Joined {channel.mention}",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="play", description="Plays a song from YouTube")
    async def play(self, interaction: discord.Interaction, query: str):
        """Plays from a query (could be URL or search term)"""
        await interaction.response.defer()

        if interaction.user.voice is None:
            embed = discord.Embed(
                title="❌ Error",
                description="You are not in a voice channel!",
                color=discord.Color.red()
            )
            await interaction.followup.send(embed=embed)
            return

        if interaction.guild.voice_client is None:
            channel = interaction.user.voice.channel
            await channel.connect()

        # Check if it's a URL
        if not query.startswith(('http://', 'https://')):
            query = f"ytsearch:{query}"

        try:
            data = await asyncio.to_thread(ytdl.extract_info, query, download=False)

            if 'entries' in data:
                # This is a playlist or search result
                entries = data['entries']
                if not entries:
                    embed = discord.Embed(
                        title="❌ Error",
                        description="No results found!",
                        color=discord.Color.red()
                    )
                    await interaction.followup.send(embed=embed)
                    return

                first_entry = entries[0]
                url = first_entry['url']
                title = first_entry['title']

                queue = self.get_queue(interaction.guild.id)
                queue.append((url, title))  # Store both URL and title

                if not interaction.guild.voice_client.is_playing():
                    await self.play_next(interaction)
                else:
                    embed = discord.Embed(
                        title="🎵 Added to Queue",
                        description=f"**{title}**",
                        color=discord.Color.blue()
                    )
                    await interaction.followup.send(embed=embed)
            else:
                # Single video
                url = data['url']
                title = data['title']

                queue = self.get_queue(interaction.guild.id)
                queue.append((url, title))  # Store both URL and title

                if not interaction.guild.voice_client.is_playing():
                    await self.play_next(interaction)
                else:
                    embed = discord.Embed(
                        title="🎵 Added to Queue",
                        description=f"**{title}**",
                        color=discord.Color.blue()
                    )
                    await interaction.followup.send(embed=embed)
        except Exception as e:
            embed = discord.Embed(
                title="❌ Error",
                description=f"Error: {e}",
                color=discord.Color.red()
            )
            await interaction.followup.send(embed=embed)

    @app_commands.command(name="pause", description="Pauses the current song")
    async def pause(self, interaction: discord.Interaction):
        """Pauses the currently playing song"""
        if interaction.guild.voice_client is None:
            embed = discord.Embed(
                title="❌ Error",
                description="I'm not connected to a voice channel!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        if interaction.guild.voice_client.is_playing():
            interaction.guild.voice_client.pause()
            embed = discord.Embed(
                title="⏸️ Paused",
                description="The player has been paused.",
                color=discord.Color.orange()
            )
            await interaction.response.send_message(embed=embed)
        else:
            embed = discord.Embed(
                title="❌ Error",
                description="Nothing is playing!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="resume", description="Resumes the current song")
    async def resume(self, interaction: discord.Interaction):
        """Resumes the currently paused song"""
        if interaction.guild.voice_client is None:
            embed = discord.Embed(
                title="❌ Error",
                description="I'm not connected to a voice channel!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        if interaction.guild.voice_client.is_paused():
            interaction.guild.voice_client.resume()
            embed = discord.Embed(
                title="▶️ Resumed",
                description="The player has been resumed.",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        else:
            embed = discord.Embed(
                title="❌ Error",
                description="The player is not paused!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="stop", description="Stops the current song and clears the queue")
    async def stop(self, interaction: discord.Interaction):
        """Stops and disconnects the bot from voice"""
        if interaction.guild.voice_client is None:
            embed = discord.Embed(
                title="❌ Error",
                description="I'm not connected to a voice channel!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        self.get_queue(interaction.guild.id).clear()
        interaction.guild.voice_client.stop()
        await interaction.guild.voice_client.disconnect()
        embed = discord.Embed(
            title="⏹️ Stopped",
            description="The player has been stopped and disconnected.",
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="skip", description="Skips the current song")
    async def skip(self, interaction: discord.Interaction):
        """Skips the current song"""
        if interaction.guild.voice_client is None or not interaction.guild.voice_client.is_playing():
            embed = discord.Embed(
                title="❌ Error",
                description="Nothing is playing!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        interaction.guild.voice_client.stop()
        embed = discord.Embed(
            title="⏭️ Skipped",
            description="The current song has been skipped.",
            color=discord.Color.blue()
        )
        await interaction.response.send_message(embed=embed)
        await self.play_next(interaction)
    
    @app_commands.command(name="queue", description="Shows the current queue")
    async def queue(self, interaction: discord.Interaction):
        """Shows the current queue"""
        queue = self.get_queue(interaction.guild.id)
        if not queue:
            embed = discord.Embed(
                title="🎵 Queue",
                description="The queue is empty!",
                color=discord.Color.blue()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        message = ""
        for i, item in enumerate(queue, 1):
            if isinstance(item, tuple):  # New format
                url, title = item
                message += f"{i}. **{title}**\n"
            else:  # Old format (for compatibility)
                message += f"{i}. [Unknown title]\n"
        
        embed = discord.Embed(
            title="🎵 Current Queue",
            description=message,
            color=discord.Color.blue()
        )
        await interaction.response.send_message(embed=embed)
    
    @app_commands.command(name="nowplaying", description="Shows the currently playing song")
    async def nowplaying(self, interaction: discord.Interaction):
        """Shows the currently playing song"""
        if interaction.guild.voice_client is None or not interaction.guild.voice_client.is_playing():
            embed = discord.Embed(
                title="❌ Error",
                description="Nothing is playing!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        player = interaction.guild.voice_client.source
        if hasattr(player, 'title'):
            embed = discord.Embed(
                title="🎵 Now Playing",
                description=f"**{player.title}**",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)
        else:
            embed = discord.Embed(
                title="🎵 Now Playing",
                description="[Unknown title]",
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="volume", description="Adjust the player volume (0-200%)")
    @app_commands.describe(level="Volume level (0-200)")
    async def volume(self, interaction: discord.Interaction, level: int):
        """Adjusts the player volume"""
        if interaction.guild.voice_client is None or not interaction.guild.voice_client.is_playing():
            embed = discord.Embed(
                title="❌ Error",
                description="Nothing is playing!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        if level < 0 or level > 200:
            embed = discord.Embed(
                title="❌ Error",
                description="Volume must be between 0 and 200!",
                color=discord.Color.red()
            )
            await interaction.response.send_message(embed=embed)
            return
        
        # Get the current player (PCMVolumeTransformer)
        player = interaction.guild.voice_client.source
        player.volume = level / 100  # Convert percentage to float (0.0-2.0)

        # Save volume to database
        self.save_volume(interaction.guild.id, player.volume)
        
        embed = discord.Embed(
            title="🔊 Volume Adjusted",
            description=f"Set volume to {level}%",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

async def setup(bot):
    await bot.add_cog(MusicBot(bot))
