import discord
from discord.ext import commands
from discord import app_commands

class Cleanup(commands.Cog):
    cleanup_group = app_commands.Group(
        name="cleanup",
        description="Bulk delete messages"
    )

    def __init__(self, bot):
        self.bot = bot

    @cleanup_group.command(name="messages", description="Delete the last X messages in this channel.")
    async def cleanup(self, interaction: discord.Interaction, amount: int):
        if not interaction.user.guild_permissions.manage_messages:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)
        deleted = await interaction.channel.purge(limit=amount)
        await interaction.followup.send(f"Deleted {len(deleted)} messages.", ephemeral=True)

    @cleanup_group.command(name="all", description="Delete all messages in this channel.")
    async def cleanup_all(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.manage_messages:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)
        deleted = await interaction.channel.purge()
        await interaction.followup.send(f"Deleted {len(deleted)} messages.", ephemeral=True)

    @cleanup_group.command(name="user", description="Delete a number of messages from a specific user.")
    async def cleanup_user(self, interaction: discord.Interaction, user: discord.Member, amount: int):
        if not interaction.user.guild_permissions.manage_messages:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        import asyncio

        await interaction.response.defer(ephemeral=True)

        def is_user(m):
            return m.author == user

        messages = await interaction.channel.history(limit=1000).flatten()
        user_messages = [m for m in messages if m.author == user][:amount]

        deleted_count = 0
        batch_size = 50
        for i in range(0, len(user_messages), batch_size):
            batch = user_messages[i:i+batch_size]
            try:
                deleted = await interaction.channel.delete_messages(batch)
                deleted_count += len(deleted)
            except Exception:
                # fallback to deleting individually if bulk delete fails
                for msg in batch:
                    try:
                        await msg.delete()
                        deleted_count += 1
                    except Exception:
                        pass
            await asyncio.sleep(1)  # delay to avoid rate limits

        await interaction.followup.send(f"Deleted {deleted_count} messages from {user.display_name}.", ephemeral=True)

async def setup(bot):
    await bot.add_cog(Cleanup(bot))
