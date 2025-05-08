import discord
from discord.ext import commands
from discord import app_commands

class InviteLeaderboard(commands.Cog):
    invites_group = app_commands.Group(
        name="invites",
        description="Invite management commands"
    )

    def __init__(self, bot):
        self.bot = bot

    def cog_unload(self):
        pass

    @invites_group.command(name="leaderboard", description="Show the top invites leaderboard.")
    async def invite_leaderboard(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)

        invites = await interaction.guild.invites()
        if not invites:
            await interaction.followup.send("No invites found for this server.")
            return

        # Sort invites by uses descending
        sorted_invites = sorted(invites, key=lambda i: i.uses or 0, reverse=True)

        leaderboard_lines = []
        for idx, invite in enumerate(sorted_invites[:10], start=1):
            inviter = invite.inviter.name if invite.inviter else "Unknown"
            uses = invite.uses or 0
            leaderboard_lines.append(f"**{idx}.** {inviter} - `{uses}` uses (Code: `{invite.code}`)")

        leaderboard_text = "\n".join(leaderboard_lines)
        embed = discord.Embed(
            title="📊 Invite Leaderboard",
            description=leaderboard_text,
            color=discord.Color.blue()
        )
        await interaction.followup.send(embed=embed)

async def setup(bot):
    await bot.add_cog(InviteLeaderboard(bot))
