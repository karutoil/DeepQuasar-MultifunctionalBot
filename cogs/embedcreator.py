import discord
from discord.ext import commands
from discord import app_commands
import json, sqlite3
from typing import Optional

# --------- INTERACTIVE EMBED BUILDER VIEWS AND MODALS -----------

class EditModal(discord.ui.Modal):
    def __init__(self, title: str, label: str, default: str = "", max_length=2048):
        super().__init__(title=title)
        self.value = None
        self.input = discord.ui.TextInput(label=label, placeholder=default, default=default, max_length=max_length, required=False)
        self.add_item(self.input)

    async def on_submit(self, interaction: discord.Interaction):
        self.value = self.input.value
        await interaction.response.defer()

class FieldModal(discord.ui.Modal):
    def __init__(self):
        super().__init__(title="Add Embed Field")
        self.name_input = discord.ui.TextInput(label="Field Name", max_length=256)
        self.value_input = discord.ui.TextInput(label="Field Value", max_length=1024)
        self.inline_input = discord.ui.TextInput(label="Inline? true/false", default="true", max_length=5)
        self.add_item(self.name_input)
        self.add_item(self.value_input)
        self.add_item(self.inline_input)

    async def on_submit(self, interaction: discord.Interaction):
        self.name = self.name_input.value
        self.value = self.value_input.value
        inline_str = self.inline_input.value.lower()
        self.inline = inline_str == 'true'
        await interaction.response.defer()

class EmbedBuilderView(discord.ui.View):
    def __init__(self, bot: commands.Bot, author: discord.User, interaction: discord.Interaction, cog):
        super().__init__(timeout=600)
        self.author = author
        self.bot = bot
        self.interaction = interaction
        self.cog = cog
        self.embed = discord.Embed(title="Sample Title", description="Sample description", color=discord.Color.blue())
        self.message = None

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        return interaction.user.id == self.author.id

    async def send_or_update(self, embed=None):
        embed = embed or self.embed
        try:
            await self.message.edit(embed=embed, view=self)
        except:
            pass

    @discord.ui.button(label="Title", style=discord.ButtonStyle.primary, row=0)
    async def edit_title(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditModal("Edit Title", "Title", default=self.embed.title or "")
        await interaction.response.send_modal(modal)
        await modal.wait()
        if modal.value is not None:
            self.embed.title = modal.value
            await self.send_or_update()

    @discord.ui.button(label="Description", style=discord.ButtonStyle.primary, row=0)
    async def edit_description(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditModal("Edit Description", "Description", default=self.embed.description or "")
        await interaction.response.send_modal(modal)
        await modal.wait()
        if modal.value is not None:
            self.embed.description = modal.value
            await self.send_or_update()

    @discord.ui.button(label="Add Field", style=discord.ButtonStyle.secondary, row=1)
    async def add_field(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = FieldModal()
        await interaction.response.send_modal(modal)
        await modal.wait()
        try:
            self.embed.add_field(name=modal.name, value=modal.value, inline=modal.inline)
            await self.send_or_update()
        except:
            pass

    @discord.ui.button(label="Footer", style=discord.ButtonStyle.secondary, row=1)
    async def edit_footer(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditModal("Edit Footer", "Footer text", default=self.embed.footer.text or "")
        await interaction.response.send_modal(modal)
        await modal.wait()
        if modal.value is not None:
            self.embed.set_footer(text=modal.value)
            await self.send_or_update()

    @discord.ui.button(label="Thumbnail", style=discord.ButtonStyle.secondary, row=2)
    async def edit_thumbnail(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditModal("Set Thumbnail URL", "Image URL", default=self.embed.thumbnail.url if self.embed.thumbnail.url else "")
        await interaction.response.send_modal(modal)
        await modal.wait()
        if modal.value:
            try:
                self.embed.set_thumbnail(url=modal.value)
            except:
                pass
            await self.send_or_update()

    @discord.ui.button(label="Image", style=discord.ButtonStyle.secondary, row=2)
    async def edit_image(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditModal("Set Image URL", "Image URL", default=self.embed.image.url if self.embed.image.url else "")
        await interaction.response.send_modal(modal)
        await modal.wait()
        if modal.value:
            try:
                self.embed.set_image(url=modal.value)
            except:
                pass
            await self.send_or_update()

    @discord.ui.button(label="Color", style=discord.ButtonStyle.secondary, row=2)
    async def edit_color(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditModal("Set Embed Color (#hex)", "Hex color", default=f"#{self.embed.color.value:06x}")
        await interaction.response.send_modal(modal)
        await modal.wait()
        if modal.value:
            try:
                self.embed.color = discord.Color(int(modal.value.lstrip('#'), 16))
            except:
                pass
            await self.send_or_update()

    @discord.ui.button(label="Export JSON", style=discord.ButtonStyle.success, row=3)
    async def export_json(self, interaction: discord.Interaction, button: discord.ui.Button):
        json_str = json.dumps(self.embed.to_dict(), indent=2)
        if len(json_str) > 1900:
            json_str = "Embed JSON too large to display."
        await interaction.response.send_message(f"```json\n{json_str}\n```", ephemeral=True)

    @discord.ui.button(label="Send", style=discord.ButtonStyle.green, row=3)
    async def send_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        options = [
            discord.SelectOption(label=channel.name, value=str(channel.id))
            for channel in interaction.guild.text_channels if channel.permissions_for(interaction.guild.me).send_messages
        ]
        select = discord.ui.Select(placeholder="Select a channel", options=options[:25])

        async def select_callback(inter: discord.Interaction):
            channel_id = int(select.values[0])
            channel = self.bot.get_channel(channel_id)
            message = await channel.send(embed=self.embed)
            embed_json = json.dumps(self.embed.to_dict())
            # Save to database
            await self.cog.store_embed(
                message_id=message.id,
                channel_id=channel.id,
                guild_id=interaction.guild.id,
                embed_json=embed_json,
                author_id=interaction.user.id
            )
            await inter.response.send_message(f"Embed sent to {channel.mention}!", ephemeral=True)
            await self.message.edit(content="Embed finalized.", embed=None, view=None)
            self.stop()

        select.callback = select_callback
        select_view = discord.ui.View(timeout=60)
        select_view.add_item(select)
        await interaction.response.send_message("Select the channel to post the embed in:", view=select_view, ephemeral=True)

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.danger, row=3)
    async def cancel_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("Embed creation canceled.", ephemeral=True)
        await self.message.edit(content="Embed creation canceled.", embed=None, view=None)
        self.stop()

# ------------- YOUR COG, extended ----------------

class EmbedCreator(commands.Cog):
    embed_group = app_commands.Group(
        name="embed",
        description="Embed management commands"
    )

    def __init__(self, bot):
        self.bot = bot
        self._init_db()

    def _init_db(self):
        self.conn = sqlite3.connect('data/embedcreator.db')
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS embeds (
                message_id INTEGER PRIMARY KEY,
                channel_id INTEGER NOT NULL,
                guild_id INTEGER NOT NULL,
                embed_json TEXT NOT NULL,
                author_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.conn.commit()

    async def cog_unload(self):
        self.conn.close()

    async def store_embed(self, message_id, channel_id, guild_id, embed_json, author_id):
        self.cursor.execute('''
            INSERT INTO embeds (message_id, channel_id, guild_id, embed_json, author_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (message_id, channel_id, guild_id, embed_json, author_id))
        self.conn.commit()

    async def get_embed(self, message_id):
        self.cursor.execute('SELECT channel_id, guild_id, embed_json, author_id FROM embeds WHERE message_id = ?', (message_id,))
        r = self.cursor.fetchone()
        if r:
            return {'channel_id': r[0], 'guild_id': r[1], 'embed_json': r[2], 'author_id': r[3]}
        else:
            return None

    async def update_embed(self, message_id, new_json):
        self.cursor.execute('UPDATE embeds SET embed_json=? WHERE message_id=?', (new_json, message_id))
        self.conn.commit()

    async def parse_embed_json(self, json_str):
        try:
            data = json.loads(json_str)
            if "embed" in data:
                embed_data = data['embed']
            else:
                embed_data = data
            return discord.Embed.from_dict(embed_data)
        except Exception as e:
            print(f"Error parsing embed: {e}")
            return None

    @embed_group.command(
        name="create",
        description="Create an embed from JSON"
    )
    @app_commands.describe(
        json_input="Embed JSON (use https://embed.discord.website/ to create)",
        channel="Channel to post in (defaults to current)"
    )
    async def create_embed(self, interaction: discord.Interaction, json_input: str, channel: Optional[discord.TextChannel] = None):
        if not interaction.user.guild_permissions.manage_messages:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        target_channel = channel or interaction.channel
        embed = await self.parse_embed_json(json_input)
        if not embed:
            return await interaction.response.send_message("Invalid embed JSON. Please check your input.", ephemeral=True)
        try:
            msg = await target_channel.send(embed=embed)
            await self.store_embed(msg.id, target_channel.id, interaction.guild.id, json_input, interaction.user.id)
            await interaction.response.send_message(
                f"Embed posted in {target_channel.mention}! Message ID: `{msg.id}`",
                ephemeral=True
            )
        except discord.Forbidden:
            await interaction.response.send_message("I don't have permission to send messages there.", ephemeral=True)

    @embed_group.command(
        name="edit",
        description="Edit an existing embed by message ID"
    )
    @app_commands.describe(
        message_id="ID of the message to edit",
        new_json="New embed JSON"
    )
    async def edit_embed(self, interaction: discord.Interaction, message_id: str, new_json: str):
        if not interaction.user.guild_permissions.manage_messages:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        try:
            message_id_int = int(message_id)
        except:
            return await interaction.response.send_message("Invalid message ID.", ephemeral=True)

        record = await self.get_embed(message_id_int)
        if not record:
            return await interaction.response.send_message("Embed not found in database.", ephemeral=True)

        if interaction.user.id != record['author_id'] and not interaction.user.guild_permissions.manage_messages:
            return await interaction.response.send_message("You can only edit embeds you created.", ephemeral=True)

        channel = self.bot.get_channel(record['channel_id'])
        if not channel:
            return await interaction.response.send_message("Channel not found.", ephemeral=True)
        try:
            msg = await channel.fetch_message(message_id_int)
        except discord.NotFound:
            return await interaction.response.send_message("Message not found.", ephemeral=True)
        embed = await self.parse_embed_json(new_json)
        if not embed:
            return await interaction.response.send_message("Invalid embed JSON.", ephemeral=True)
        try:
            await msg.edit(embed=embed)
            await self.update_embed(message_id_int, new_json)
            await interaction.response.send_message("Embed updated successfully!", ephemeral=True)
        except discord.Forbidden:
            await interaction.response.send_message("I don't have permission to edit that message.", ephemeral=True)

    @embed_group.command(
        name="get",
        description="Get the JSON of an existing embed"
    )
    @app_commands.describe(message_id="ID of the message to get JSON from")
    async def get_embed_json(self, interaction: discord.Interaction, message_id: str):
        if not interaction.user.guild_permissions.manage_messages:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        try:
            message_id_int = int(message_id)
        except:
            return await interaction.response.send_message("Invalid message ID.", ephemeral=True)
        data = await self.get_embed(message_id_int)
        if data:
            return await interaction.response.send_message(f"```json\n{data['embed_json']}\n```", ephemeral=True)

        for channel in interaction.guild.text_channels:
            try:
                msg = await channel.fetch_message(message_id_int)
                if msg.embeds:
                    return await interaction.response.send_message(
                        f"```json\n{json.dumps(msg.embeds[0].to_dict(), indent=2)}\n```",
                        ephemeral=True
                    )
            except:
                continue
        await interaction.response.send_message("Message not found or no embed.", ephemeral=True)

    @embed_group.command(
        name="builder",
        description="Interactively build an embed with buttons"
    )
    async def embedbuilder(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.manage_messages:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        """Create an embed interactively with editing buttons."""
        view = EmbedBuilderView(self.bot, interaction.user, interaction, self)
        await interaction.response.send_message("Interactive embed builder started! Edit your embed using the buttons below:", embed=view.embed, view=view, ephemeral=True)
        view.message = await interaction.original_response()

async def setup(bot):
    await bot.add_cog(EmbedCreator(bot))
