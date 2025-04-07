import discord
from discord.ext import commands
import os
import sqlite3
from dotenv import load_dotenv

DB_PATH = "data/cog_state.db"

def init_cog_db():
    """Create cog_state.db and table if missing"""
    if not os.path.exists(DB_PATH):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('CREATE TABLE IF NOT EXISTS cogs (cog_name TEXT PRIMARY KEY, loaded INTEGER NOT NULL)')
        conn.commit()
        conn.close()

init_cog_db()

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

def ensure_cog_record(cog_name):
    """Ensure cog record exists in DB, default loaded=1"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT OR IGNORE INTO cogs (cog_name, loaded) VALUES (?, ?)", (cog_name, 1))
    conn.commit()
    conn.close()

def set_cog_loaded(cog_name, loaded: int):
    """Update cog loaded state in DB"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO cogs (cog_name, loaded) VALUES (?, ?)", (cog_name, loaded))
    conn.commit()
    conn.close()

def is_cog_enabled(cog_name):
    """Check if cog is enabled (loaded=1)"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT loaded FROM cogs WHERE cog_name = ?", (cog_name,))
    row = c.fetchone()
    conn.close()
    if row is None:
        return True  # default to enabled if not in DB
    return bool(row[0])

async def load_cogs():
    """Load all cogs on startup based on DB state"""
    for filename in os.listdir("./cogs"):
        if filename.endswith(".py") and not filename.startswith("_"):
            cog_name = filename[:-3]
            ensure_cog_record(cog_name)
            if is_cog_enabled(cog_name):
                try:
                    await bot.load_extension(f"cogs.{cog_name}")
                    print(f"Loaded cog: {cog_name}")
                except Exception as e:
                    print(f"Failed to load cog {cog_name}: {e}")
            else:
                print(f"Skipped disabled cog: {cog_name}")

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

from discord import app_commands

def owner_only():
    async def predicate(interaction: discord.Interaction) -> bool:
        return await interaction.client.is_owner(interaction.user)
    return app_commands.check(predicate)

@owner_only()
@bot.tree.command(name="list_cogs", description="List all currently loaded cogs")
async def list_cogs(interaction: discord.Interaction):
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

@owner_only()
@bot.tree.command(name="load_cog", description="Load a cog by name (owner only)")
@app_commands.describe(cog_name="Name of the cog to load (e.g., music, autorole)")
async def load_cog(interaction: discord.Interaction, cog_name: str):
    cog_path = f"cogs.{cog_name}"
    try:
        await bot.load_extension(cog_path)
        set_cog_loaded(cog_name, 1)
        await interaction.response.send_message(f"✅ Loaded cog `{cog_name}`", ephemeral=True)
    except commands.ExtensionAlreadyLoaded:
        await interaction.response.send_message(f"❌ Cog `{cog_name}` is already loaded.", ephemeral=True)
    except Exception as e:
        await interaction.response.send_message(f"❌ Failed to load cog `{cog_name}`: {e}", ephemeral=True)

@owner_only()
@bot.tree.command(name="unload_cog", description="Unload a cog by name (owner only)")
@app_commands.describe(cog_name="Name of the cog to unload (e.g., music, autorole)")
async def unload_cog(interaction: discord.Interaction, cog_name: str):
    cog_path = f"cogs.{cog_name}"
    try:
        await bot.unload_extension(cog_path)
        set_cog_loaded(cog_name, 0)
        await interaction.response.send_message(f"✅ Unloaded cog `{cog_name}`", ephemeral=True)
    except commands.ExtensionNotLoaded:
        await interaction.response.send_message(f"❌ Cog `{cog_name}` is not loaded.", ephemeral=True)
    except Exception as e:
        await interaction.response.send_message(f"❌ Failed to unload cog `{cog_name}`: {e}", ephemeral=True)

@owner_only()
@bot.tree.command(name="reload_cog", description="Reload a cog by name (owner only)")
@app_commands.describe(cog_name="Name of the cog to reload (e.g., music, autorole)")
async def reload_cog(interaction: discord.Interaction, cog_name: str):
    cog_path = f"cogs.{cog_name}"
    try:
        await bot.unload_extension(cog_path)
    except commands.ExtensionNotLoaded:
        pass  # ignore if not loaded
    except Exception as e:
        await interaction.response.send_message(f"❌ Failed to unload cog `{cog_name}`: {e}", ephemeral=True)
        return
    try:
        await bot.load_extension(cog_path)
        set_cog_loaded(cog_name, 1)
        await interaction.response.send_message(f"🔄 Reloaded cog `{cog_name}`", ephemeral=True)
    except Exception as e:
        await interaction.response.send_message(f"❌ Failed to reload cog `{cog_name}`: {e}", ephemeral=True)

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
    try:
        perms_check = any(
            getattr(check, "__qualname__", "").startswith("has_permissions") or
            getattr(check, "__name__", "") == "has_permissions"
            for check in ctx.command.checks
        )
        if perms_check:
            modlog_cog = bot.get_cog("ModLog")
            if modlog_cog:
                params = " ".join(ctx.args[1:])
                await modlog_cog.log_action(
                    ctx.guild.id,
                    "admin_command",
                    user=ctx.author,
                    command=ctx.command.qualified_name,
                    details=f"Args: {params}"
                )
    except Exception:
        pass

@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.CheckFailure):
        if not interaction.response.is_done():
            await interaction.response.send_message("❌ You are not the owner of the bot.", ephemeral=True)
    else:
        # Optionally handle other errors or re-raise
        pass

if __name__ == "__main__":
    print("Starting Discord bot...")
    bot.run(os.getenv('DISCORD_TOKEN'))
