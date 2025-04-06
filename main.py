import discord
from discord.ext import commands
import os
from dotenv import load_dotenv

load_dotenv()

# Set up intents
intents = discord.Intents.default()
intents.members = True
intents.message_content = True
intents.guilds = True
intents.messages = True
intents.voice_states = True
intents.guild_messages = True
intents.guild_reactions = True

bot = commands.Bot(
    command_prefix="!",
    intents=intents,
    help_command=None
)

async def load_cogs():
    """Load all cogs on startup"""
    for filename in os.listdir("./cogs"):
        if filename.endswith(".py") and not filename.startswith("_"):
            try:
                await bot.load_extension(f"cogs.{filename[:-3]}")
                print(f"Loaded cog: {filename[:-3]}")
            except Exception as e:
                print(f"Failed to load cog {filename}: {e}")

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")
    print("------")
    await load_cogs()
    await bot.tree.sync()
    print("Commands synced!")

@bot.tree.command(name="about", description="Learn more about this bot's creators")
async def about_command(interaction: discord.Interaction):
    embed = discord.Embed(
        title="About This Bot",
        description=(
            "This bot, including all of its cogs, was written by the AIs **Deepseek V3** and **Quasar Alpha**, "
            "with the assistance of **Karutoil**."
        ),
        color=discord.Color.blurple()
    )
    embed.set_footer(text="Powered by AI and a hint of human assistance 🤖✨")
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="list_cogs", description="List all currently loaded cogs")
async def list_cogs(interaction: discord.Interaction):
    """Slash command to list all loaded cogs"""
    loaded_cogs = list(bot.cogs.keys())
    if loaded_cogs:
        cog_list = "\n".join(f"- {name}" for name in loaded_cogs)
        description = f"**Loaded Cogs:**\n{cog_list}"
    else:
        description = "No cogs are currently loaded."

    embed = discord.Embed(
        title="📦 Loaded Cogs",
        description=description,
        color=discord.Color.blue()
    )
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.listen()
async def on_app_command_completion(interaction: discord.Interaction, command: discord.app_commands.Command):
    try:
        is_admin_command = False

        # Check default_permissions
        if hasattr(command, "default_permissions"):
            if command.default_permissions and command.default_permissions.administrator:
                is_admin_command = True

        # Check command checks for has_permissions(administrator=True)
        if not is_admin_command and hasattr(command, "checks"):
            for check in command.checks:
                if hasattr(check, "__qualname__") and "has_permissions" in check.__qualname__:
                    is_admin_command = True
                    break
                if hasattr(check, "__name__") and check.__name__ == "has_permissions":
                    is_admin_command = True
                    break

        if is_admin_command:
            modlog_cog = bot.get_cog("ModLog")
            if modlog_cog:
                params_list = interaction.data.get("options", []) if interaction.data else []
                params = ", ".join(f"{opt['name']}={opt.get('value')}" for opt in params_list)
                await modlog_cog.log_action(
                    interaction.guild.id,
                    "admin_command",
                    user=interaction.user,
                    command=command.name,
                    details=f"Parameters: {params}"
                )
    except Exception:
        pass

@bot.listen()
async def on_command_completion(ctx):
    # Check if command requires admin permissions
    try:
        perms_check = any(
            getattr(check, "__qualname__", "").startswith("has_permissions") or
            getattr(check, "__name__", "") == "has_permissions"
            for check in ctx.command.checks
        )
        if perms_check:
            modlog_cog = bot.get_cog("ModLog")
            if modlog_cog:
                params = " ".join(ctx.args[1:])  # skip ctx itself
                await modlog_cog.log_action(
                    ctx.guild.id,
                    "admin_command",
                    user=ctx.author,
                    command=ctx.command.qualified_name,
                    details=f"Args: {params}"
                )
    except Exception:
        pass  # Avoid crashing on logging errors
    
if __name__ == "__main__":
    bot.run(os.getenv('DISCORD_TOKEN'))
