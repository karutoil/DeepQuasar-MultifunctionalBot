import discord
from discord.ext import commands
from discord import app_commands
from db.welcome_leave_db import WelcomeLeaveDB
from datetime import datetime

class WelcomeLeave(commands.Cog):
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

    @app_commands.command(name="setwelcomechannel", description="Set the welcome message channel")
    @app_commands.checks.has_permissions(administrator=True)
    async def set_welcome_channel(self, interaction: discord.Interaction, channel: discord.TextChannel):
        self.db.set_welcome_channel(interaction.guild.id, channel.id)
        await interaction.response.send_message(f"Welcome channel set to {channel.mention}", ephemeral=True)

    @app_commands.command(name="setleavechannel", description="Set the leave message channel")
    @app_commands.checks.has_permissions(administrator=True)
    async def set_leave_channel(self, interaction: discord.Interaction, channel: discord.TextChannel):
        self.db.set_leave_channel(interaction.guild.id, channel.id)
        await interaction.response.send_message(f"Leave channel set to {channel.mention}", ephemeral=True)

async def setup(bot):
    await bot.add_cog(WelcomeLeave(bot))
