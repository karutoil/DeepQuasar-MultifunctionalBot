import discord
from discord.ext import commands
from discord import app_commands
import aiohttp
import json
from db.localai_db import LocalAIDB
from typing import Optional, List

class LocalAI(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.db = LocalAIDB()
        self.session = aiohttp.ClientSession()
        self.mention_triggers = [f"<@{bot.user.id}>", f"<@!{bot.user.id}>"]

    def cog_unload(self):
        self.bot.loop.create_task(self.session.close())
        self.db.close()

    def is_mentioned(self, message: discord.Message) -> bool:
        """Check if bot is mentioned in message"""
        return any(trigger in message.content for trigger in self.mention_triggers)

    # Modify the get_ai_response method to include the system prompt
    async def get_ai_response(self, guild_id: int, prompt: str) -> Optional[str]:
        """Get response from local AI endpoint"""
        config = self.db.get_config(guild_id)
        if not config or not config['enabled']:
            return None
    
        headers = {}
        if config['api_key']:
            headers["Authorization"] = f"Bearer {config['api_key']}"
    
        # Get system prompt if configured
        system_prompt = self.db.get_system_prompt(guild_id)
        
        # Build messages array
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
    
        payload = {
            "model": config['model_name'],
            "messages": messages,  # Use the messages array we built
            "temperature": config.get('temperature', 0.7),
            "max_tokens": config.get('max_tokens', 1000)
        }
    
        try:
            async with self.session.post(
                f"{config['api_base']}/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data['choices'][0]['message']['content']
                error = await response.text()
                print(f"AI API Error: {error}")
                return None
        except Exception as e:
            print(f"AI Request Failed: {str(e)}")
            return None

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        """Handle message events for AI responses"""
        if (message.author.bot or 
            not message.guild or 
            not isinstance(message.channel, discord.TextChannel)):
            return

        # Check if bot is mentioned or channel is whitelisted
        should_respond = (self.is_mentioned(message) or 
                         self.db.is_whitelisted(message.guild.id, message.channel.id))
        
        if not should_respond:
            return

        # Get clean prompt (remove mentions)
        prompt = message.clean_content
        for trigger in self.mention_triggers:
            prompt = prompt.replace(trigger, '').strip()

        if not prompt:
            return

        async with message.channel.typing():
            response = await self.get_ai_response(message.guild.id, prompt)
            if response:
                # Truncate if needed
                if len(response) > 2000:
                    response = response[:1997] + "..."
                
                # Reply to the message
                await message.reply(response, mention_author=False)

    @app_commands.command(name="ailocal")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        api_base="Your local API URL (e.g., http://localhost:1234)",
        api_key="API key if required (leave empty if none)",
        model_name="Model name in your LM Studio"
    )
    async def configure_local_ai(
        self,
        interaction: discord.Interaction,
        api_base: str,
        api_key: Optional[str] = None,
        model_name: str = "local-model"
    ):
        """Configure your local AI endpoint"""
        if not api_base.startswith(('http://', 'https://')):
            return await interaction.response.send_message(
                "Invalid URL format. Must start with http:// or https://",
                ephemeral=True
            )

        self.db.set_config(interaction.guild.id, api_base, api_key, model_name)
        await interaction.response.send_message(
            f"Local AI configured!\n"
            f"Endpoint: `{api_base}`\n"
            f"Model: `{model_name}`\n"
            f"API Key: {'Configured' if api_key else 'None'}",
            ephemeral=True
        )

    @app_commands.command(name="aiprompt")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        prompt="System prompt to prepend to all AI requests (leave empty to clear)"
    )
    async def set_system_prompt(
        self,
        interaction: discord.Interaction,
        prompt: Optional[str] = None
    ):
        """Set a custom system prompt for your server's AI"""
        self.db.set_system_prompt(interaction.guild.id, prompt)
        if prompt:
            await interaction.response.send_message(
                f"System prompt set! It will be prepended to all AI requests.",
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                "System prompt cleared!",
                ephemeral=True
            )

    @app_commands.command(name="toggleai")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(enabled="Enable/disable AI responses")
    async def toggle_ai(self, interaction: discord.Interaction, enabled: bool):
        """Toggle AI functionality for this server"""
        self.db.set_enabled(interaction.guild.id, enabled)
        await interaction.response.send_message(
            f"Local AI responses {'enabled' if enabled else 'disabled'}",
            ephemeral=True
        )

    @app_commands.command(name="aichannel")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        channel="Channel to whitelist",
        action="Add or remove from whitelist"
    )
    async def manage_whitelist(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        action: str
    ):
        """Manage whitelisted channels"""
        if action.lower() == "add":
            self.db.add_whitelisted_channel(interaction.guild.id, channel.id)
            await interaction.response.send_message(
                f"Added {channel.mention} to whitelist",
                ephemeral=True
            )
        elif action.lower() == "remove":
            self.db.remove_whitelisted_channel(interaction.guild.id, channel.id)
            await interaction.response.send_message(
                f"Removed {channel.mention} from whitelist",
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                "Invalid action. Use 'add' or 'remove'",
                ephemeral=True
            )

    @app_commands.command(name="listchannels")
    async def list_whitelisted_channels(self, interaction: discord.Interaction):
        """List all whitelisted channels"""
        channels = self.db.get_whitelisted_channels(interaction.guild.id)
        if not channels:
            return await interaction.response.send_message(
                "No whitelisted channels",
                ephemeral=True
            )

        channel_mentions = []
        for channel_id in channels:
            channel = interaction.guild.get_channel(channel_id)
            if channel:
                channel_mentions.append(channel.mention)

        embed = discord.Embed(
            title="Whitelisted Channels",
            description="\n".join(channel_mentions) or "None",
            color=0x7289da
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(LocalAI(bot))