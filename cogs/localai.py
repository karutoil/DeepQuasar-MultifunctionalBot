import discord
from discord.ext import commands
from discord import app_commands
import aiohttp
import json
import random
from db.localai_db import LocalAIDB
from typing import Optional, List

class LocalAI(commands.Cog):
    chatbot_group = app_commands.Group(
        name="chatbot",
        description="Manage your local AI chatbot"
    )

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
        if (
            message.author.bot or
            not message.guild or
            not isinstance(message.channel, discord.TextChannel)
        ):
            return

        # Always respond if bot is mentioned
        mentioned = self.is_mentioned(message)

        # Always respond if replying to the bot
        is_reply_to_bot = False
        if message.reference and isinstance(message.reference.resolved, discord.Message):
            replied_message = message.reference.resolved
            if replied_message.author.id == self.bot.user.id:
                is_reply_to_bot = True

        # Check whitelist
        whitelisted = self.db.is_whitelisted(message.guild.id, message.channel.id)

        # Decide if should respond
        should_respond = False
        if mentioned or is_reply_to_bot:
            should_respond = True
        elif whitelisted:
            chance = self.db.get_response_chance(message.guild.id)
            roll = random.uniform(0, 100)
            if roll <= chance:
                should_respond = True

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
                await message.reply(response, mention_author=False)

    @chatbot_group.command(name="configure", description="Configure your local AI endpoint")
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
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

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

    @chatbot_group.command(name="prompt", description="Set a custom system prompt")
    @app_commands.describe(
        prompt="System prompt to prepend to all AI requests (leave empty to clear)"
    )
    async def set_system_prompt(
        self,
        interaction: discord.Interaction,
        prompt: Optional[str] = None
    ):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

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

    @chatbot_group.command(name="toggle", description="Enable or disable AI responses")
    @app_commands.describe(enabled="Enable/disable AI responses")
    async def toggle_ai(self, interaction: discord.Interaction, enabled: bool):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        self.db.set_enabled(interaction.guild.id, enabled)
        await interaction.response.send_message(
            f"Local AI responses {'enabled' if enabled else 'disabled'}",
            ephemeral=True
        )

    @chatbot_group.command(name="channel", description="Add or remove a whitelisted channel")
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
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

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

    @chatbot_group.command(name="listchannels", description="List all whitelisted channels")
    async def list_whitelisted_channels(self, interaction: discord.Interaction):
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

    @chatbot_group.command(name="chance", description="Set AI response chance percentage (0-100)")
    @app_commands.describe(
        chance="Chance percentage (0-100). 100 means always respond in whitelisted channels."
    )
    async def set_response_chance(
        self,
        interaction: discord.Interaction,
        chance: float
    ):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message(
                "You do not have permission to use this command.",
                ephemeral=True
            )
            return

        if chance < 0 or chance > 100:
            await interaction.response.send_message(
                "Chance must be between 0 and 100.",
                ephemeral=True
            )
            return

        self.db.set_response_chance(interaction.guild.id, chance)
        await interaction.response.send_message(
            f"AI response chance set to {chance}%.",
            ephemeral=True
        )

async def setup(bot):
    await bot.add_cog(LocalAI(bot))
