import discord
from discord.ext import commands
from discord import app_commands
from db.welcome_leave_db import WelcomeLeaveDB
from datetime import datetime

class WelcomeLeave(commands.Cog):
    welcome_group = app_commands.Group(
        name="welcome",
        description="Welcome and leave message settings"
    )

    def __init__(self, bot):
        self.bot = bot
        self.db = WelcomeLeaveDB()

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        welcome_channel_id, _ = self.db.get_channels(member.guild.id)
        if welcome_channel_id:
            channel = member.guild.get_channel(welcome_channel_id)
            if channel:
                embed = self._create_embed(member, joined=True)
                await channel.send(embed=embed)

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        _, leave_channel_id = self.db.get_channels(member.guild.id)
        if leave_channel_id:
            channel = member.guild.get_channel(leave_channel_id)
            if channel:
                embed = self._create_embed(member, joined=False)
                await channel.send(embed=embed)

    def _create_embed(self, member: discord.Member, joined: bool) -> discord.Embed:
        action = "joined the guild" if joined else "has left the guild"
        embed = discord.Embed(
            description=f"**{member}** ({member.id}) {action}\n{member.name}",
            color=discord.Color.green() if joined else discord.Color.red()
        )
        embed.add_field(name="Member", value=member.mention, inline=True)
        embed.add_field(name="Member ID", value=str(member.id), inline=True)
        embed.add_field(name="Total Users", value=str(len(member.guild.members)), inline=True)
        embed.add_field(name="Member since", value=member.joined_at.strftime('%B %d, %Y') if member.joined_at else "Unknown", inline=False)
        embed.add_field(name="Account created", value=member.created_at.strftime('%B %d, %Y'), inline=False)
        embed.set_thumbnail(url=member.display_avatar.url)
        return embed

    @welcome_group.command(name="setwelcome", description="Set the welcome message channel")
    async def set_welcome_channel(self, interaction: discord.Interaction, channel: discord.TextChannel):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        self.db.set_welcome_channel(interaction.guild.id, channel.id)
        await interaction.response.send_message(f"Welcome channel set to {channel.mention}", ephemeral=True)

    @welcome_group.command(name="setleave", description="Set the leave message channel")
    async def set_leave_channel(self, interaction: discord.Interaction, channel: discord.TextChannel):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        self.db.set_leave_channel(interaction.guild.id, channel.id)
        await interaction.response.send_message(f"Leave channel set to {channel.mention}", ephemeral=True)

async def setup(bot):
    await bot.add_cog(WelcomeLeave(bot))
