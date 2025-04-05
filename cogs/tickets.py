import discord
from discord.ext import commands
from discord import app_commands, ButtonStyle, ui
import re
from db.ticket_db import TicketDB  # your existing DB helper


class Tickets(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.db = TicketDB()

    async def send_log(self, guild, message):
        s = self.db.get_guild_settings(guild.id)
        if not s:
            return
        log_channel = guild.get_channel(s['log_channel'])
        if log_channel:
            await log_channel.send(message)

    async def create_ticket_from_modal(self, interaction: discord.Interaction, description: str):
        settings = self.db.get_guild_settings(interaction.guild.id)
        if not settings:
            return
        category = interaction.guild.get_channel(settings['category_open'])
        if not category:
            return

        overwrites = {
            interaction.guild.default_role: discord.PermissionOverwrite(view_channel=False),
            interaction.user: discord.PermissionOverwrite(view_channel=True, send_messages=True, attach_files=True, embed_links=True),
        }
        for rid in settings['support_roles']:
            role = interaction.guild.get_role(rid)
            if role:
                overwrites[role] = discord.PermissionOverwrite(view_channel=True, send_messages=True)

        channel = await interaction.guild.create_text_channel(
            f"ticket-{interaction.user.name}".lower(),
            overwrites=overwrites,
            category=category,
            reason=f"Ticket opened by {interaction.user}"
        )

        self.db.create_ticket(channel.id, interaction.guild.id, interaction.user.id, [interaction.user.id])

        embed = discord.Embed(
            title="New Ticket",
            description=description,
            color=0x2ecc71
        )
        embed.set_author(name=str(interaction.user), icon_url=interaction.user.display_avatar.url)
        embed.set_footer(text="Staff will respond shortly.")

        await channel.send(content=interaction.user.mention, embed=embed, view=TicketControlView(self))

        await self.send_log(interaction.guild, f"🎟 Ticket {channel.mention} created by {interaction.user.mention}")

    @app_commands.command(name="setticket")
    @app_commands.default_permissions(administrator=True)
    async def setticket(self, interaction: discord.Interaction,
                        ticket_category: discord.CategoryChannel,
                        archive_category: discord.CategoryChannel,
                        support_roles: str,
                        log_channel: discord.TextChannel):
        """Configure ticket system categories, roles, logs"""
        role_ids = []
        for rid in support_roles.split(","):
            rid = rid.strip()
            match = re.search(r"\d+", rid)
            if match:
                role_ids.append(int(match.group()))
        self.db.set_guild_settings(
            interaction.guild.id,
            ticket_category.id,
            archive_category.id,
            role_ids,
            log_channel.id
        )
        await interaction.response.send_message("Ticket system configured.", ephemeral=True)

    @app_commands.command(name="createpanel")
    @app_commands.default_permissions(administrator=True)
    async def createpanel(self, interaction: discord.Interaction,
                          channel: discord.TextChannel,
                          title: str,
                          description: str):
        """Sends the ticket creation panel"""
        embed = discord.Embed(title=title, description=description, color=0x3498db)
        view = TicketPanelView(self.bot)
        await channel.send(embed=embed, view=view)
        await interaction.response.send_message(f"Panel sent to {channel.mention}", ephemeral=True)


class TicketPanelView(discord.ui.View):
    def __init__(self, bot):
        super().__init__(timeout=None)
        self.bot = bot

    @discord.ui.button(label="Open Ticket", style=ButtonStyle.green, custom_id="open_ticket_button")
    async def open_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(TicketIssueModal(self.bot))


class TicketIssueModal(discord.ui.Modal, title="Open Support Ticket"):
    def __init__(self, bot):
        super().__init__()
        self.bot = bot

        self.description = ui.TextInput(
            label="Describe your issue/request",
            style=discord.TextStyle.paragraph,
            required=True,
            max_length=1000,
            placeholder="Please provide as much detail as possible so staff can help you."
        )
        self.add_item(self.description)

    async def on_submit(self, interaction: discord.Interaction):
        cog = self.bot.get_cog("Tickets")
        await cog.create_ticket_from_modal(interaction, self.description.value)
        await interaction.response.send_message("Your ticket has been created!", ephemeral=True)


class TicketControlView(discord.ui.View):
    def __init__(self, cog):
        super().__init__(timeout=None)
        self.cog = cog

    @discord.ui.button(label="Claim", style=ButtonStyle.primary, custom_id="ticket_claim")
    async def claim(self, interaction: discord.Interaction, button):
        ticket = self.cog.db.get_ticket(interaction.channel.id)
        if not ticket:
            await interaction.response.send_message("Not a ticket channel.", ephemeral=True)
            return
        support_ids = self.cog.db.get_guild_settings(interaction.guild.id)['support_roles']
        if not any(r.id in support_ids for r in interaction.user.roles):
            await interaction.response.send_message("You are not support staff.", ephemeral=True)
            return
        self.cog.db.update_ticket(interaction.channel.id, claimed_by=interaction.user.id)
        await interaction.response.send_message(f"Ticket claimed by {interaction.user.mention}.", ephemeral=True)
        await self.cog.send_log(interaction.guild, f"📝 Ticket {interaction.channel.mention} claimed by {interaction.user.mention}")

    @discord.ui.button(label="Close", style=ButtonStyle.red, custom_id="ticket_close")
    async def close(self, interaction: discord.Interaction, button):
        ticket = self.cog.db.get_ticket(interaction.channel.id)
        if not ticket:
            await interaction.response.send_message("Not a ticket channel.", ephemeral=True)
            return
        settings = self.cog.db.get_guild_settings(interaction.guild.id)
        archive_category = interaction.guild.get_channel(settings['category_archive'])
        if not archive_category:
            await interaction.response.send_message("Archive category missing.", ephemeral=True)
            return
        await interaction.channel.edit(category=archive_category, reason="Ticket closed")
        self.cog.db.update_ticket(interaction.channel.id, status='closed')
        await interaction.response.send_message("Ticket closed and archived.", ephemeral=True)
        await self.cog.send_log(interaction.guild, f"📁 Ticket {interaction.channel.name} closed by {interaction.user.mention}")

    @discord.ui.button(label="Delete", style=ButtonStyle.danger, custom_id="ticket_delete")
    async def delete(self, interaction: discord.Interaction, button):
        ticket = self.cog.db.get_ticket(interaction.channel.id)
        if not ticket:
            await interaction.response.send_message("Not a ticket channel.", ephemeral=True)
            return
        support_ids = self.cog.db.get_guild_settings(interaction.guild.id)['support_roles']
        if interaction.user.id != ticket['claimed_by'] and not any(r.id in support_ids for r in interaction.user.roles):
            await interaction.response.send_message("You must claim or be support to delete.", ephemeral=True)
            return
        await self.cog.send_log(interaction.guild, f"❌ Ticket {interaction.channel.name} deleted by {interaction.user.mention}")
        self.cog.db.delete_ticket(interaction.channel.id)
        await interaction.channel.delete(reason=f"Deleted by {interaction.user}")


async def setup(bot):
    cog = Tickets(bot)
    await bot.add_cog(cog)

    # Register persistent views ONCE, for post-reboot working buttons
    bot.add_view(TicketPanelView(bot))
    bot.add_view(TicketControlView(cog))
