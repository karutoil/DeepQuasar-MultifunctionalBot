import discord
from discord.ext import commands
from discord import app_commands
from db.reaction_db import ReactionRolesDB

class ReactionRoles(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.db = ReactionRolesDB()
        self.pending_messages = {}  # {channel_id: (title, color, {emoji: (role_id, description)})}
        self.editing_messages = {}  # {channel_id: message_id}

    def cog_unload(self):
        self.db.close()

    async def _update_reaction_message(self, message_id):
        """Update an existing reaction role message"""
        message_info = self.db.get_message_info(message_id)
        if not message_info:
            return None

        channel_id, guild_id, title, color = message_info
        guild = self.bot.get_guild(guild_id)
        if not guild:
            return None

        channel = guild.get_channel(channel_id)
        if not channel:
            return None

        try:
            message = await channel.fetch_message(message_id)
        except:
            return None

        roles = self.db.get_reaction_roles(message_id)
        if not roles:
            await message.delete()
            self.db.remove_all_message_roles(message_id)
            return None

        # Create new embed
        embed = discord.Embed(
            title=title,
            description="React to get roles!\n\n",
            color=discord.Color(color)
        )

        # Add role explanations
        role_lines = []
        for emoji, role_id, description in roles:
            role = guild.get_role(role_id)
            if role:
                line = f"{emoji} - {role.mention}"
                if description:
                    line += f": {description}"
                role_lines.append(line)

        embed.description += "\n".join(role_lines)

        # Update the message
        await message.edit(embed=embed)

        # Update reactions
        current_reactions = [str(r.emoji) for r in message.reactions]
        desired_reactions = [str(emoji) for emoji, _, _ in roles]

        # Add missing reactions
        for emoji, _, _ in roles:
            if str(emoji) not in current_reactions:
                try:
                    await message.add_reaction(emoji)
                except:
                    print(f"Failed to add reaction {emoji}")

        # Remove extra reactions (except those still in desired reactions)
        for reaction in message.reactions:
            if str(reaction.emoji) not in desired_reactions:
                try:
                    await message.clear_reaction(reaction.emoji)
                except:
                    print(f"Failed to remove reaction {reaction.emoji}")

        return message

    @app_commands.command(name="createreactionroles", description="Start creating a reaction role message")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        title="The title for the reaction role message",
        color="The embed color in hex (e.g. #FF0000)"
    )
    async def create_reaction_roles(self, interaction: discord.Interaction, title: str, color: str = "#3498db"):
        """Initialize a new reaction role message"""
        try:
            color = int(color.lstrip("#"), 16)
        except:
            color = 3447003  # Default discord blue

        self.pending_messages[interaction.channel.id] = (title, color, {})
        await interaction.response.send_message(
            f"Now creating reaction role message: **{title}**\n"
            "Use `/addreactionrole` to add roles to this message.",
            ephemeral=True
        )

    @app_commands.command(name="addreactionrole", description="Add a role to the current reaction role message")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        emoji="The emoji to use",
        role="The role to assign",
        description="Optional description for this role"
    )
    async def add_reaction_role(self, interaction: discord.Interaction, emoji: str, role: discord.Role, description: str = None):
        """Add a reaction role to the pending message"""
        if interaction.channel.id not in self.pending_messages:
            return await interaction.response.send_message(
                "No reaction role message in progress. Use `/createreactionroles` first.",
                ephemeral=True
            )

        # Verify permissions
        if not interaction.guild.me.guild_permissions.manage_roles:
            return await interaction.response.send_message(
                "I need the **Manage Roles** permission to do this!",
                ephemeral=True
            )

        if role.position >= interaction.guild.me.top_role.position:
            return await interaction.response.send_message(
                f"My role must be above {role.mention} to assign it!",
                ephemeral=True
            )

        # Add to pending message
        title, color, roles = self.pending_messages[interaction.channel.id]
        roles[emoji] = (role.id, description)
        
        await interaction.response.send_message(
            f"Added {emoji} → {role.mention} to the reaction role message.",
            ephemeral=True
        )

    @app_commands.command(name="finishreactionroles", description="Post the reaction role message")
    @app_commands.default_permissions(administrator=True)
    async def finish_reaction_roles(self, interaction: discord.Interaction):
        """Post the completed reaction role message"""
        if interaction.channel.id not in self.pending_messages:
            return await interaction.response.send_message(
                "No reaction role message in progress. Use `/createreactionroles` first.",
                ephemeral=True
            )

        title, color, roles = self.pending_messages.pop(interaction.channel.id)
        
        if not roles:
            return await interaction.response.send_message(
                "No roles were added to this message!",
                ephemeral=True
            )

        # Create embed
        embed = discord.Embed(
            title=title,
            description="React to get roles!\n\n",
            color=discord.Color(color)
        )

        # Add role explanations
        role_lines = []
        for emoji, (role_id, description) in roles.items():
            role = interaction.guild.get_role(role_id)
            if role:
                line = f"{emoji} - {role.mention}"
                if description:
                    line += f": {description}"
                role_lines.append(line)
        
        embed.description += "\n".join(role_lines)

        # Send message
        message = await interaction.channel.send(embed=embed)
        
        # Add reactions
        for emoji in roles.keys():
            try:
                await message.add_reaction(emoji)
            except:
                await interaction.followup.send(
                    f"Couldn't add reaction {emoji}. It may be invalid or I don't have access.",
                    ephemeral=True
                )

        # Save to database
        for emoji, (role_id, description) in roles.items():
            self.db.add_reaction_role(
                message.id,
                interaction.channel.id,
                interaction.guild.id,
                title,
                color,
                emoji,
                role_id,
                description
            )

        await interaction.response.send_message(
            "Reaction role message posted!",
            ephemeral=True
        )

    @app_commands.command(name="editreactionroles", description="Add more roles to an existing reaction role message")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(message_id="The ID of the message to edit")
    async def edit_reaction_roles(self, interaction: discord.Interaction, message_id: str):
        """Edit an existing reaction role message"""
        try:
            message_id = int(message_id)
        except:
            return await interaction.response.send_message(
                "Invalid message ID format.",
                ephemeral=True
            )

        # Check if message exists in our system
        message_info = self.db.get_message_info(message_id)
        if not message_info:
            return await interaction.response.send_message(
                "No reaction role message found with that ID.",
                ephemeral=True
            )

        channel_id, guild_id, title, color = message_info
        if guild_id != interaction.guild.id:
            return await interaction.response.send_message(
                "That message is not from this server.",
                ephemeral=True
            )

        if interaction.channel.id != channel_id:
            return await interaction.response.send_message(
                "Please use this command in the same channel as the message.",
                ephemeral=True
            )

        # Load existing roles
        existing_roles = {}
        for emoji, role_id, description in self.db.get_reaction_roles(message_id):
            existing_roles[emoji] = (role_id, description)

        # Start editing session
        self.editing_messages[interaction.channel.id] = message_id
        self.pending_messages[interaction.channel.id] = (title, color, existing_roles)

        await interaction.response.send_message(
            f"Now editing reaction role message: **{title}**\n"
            "Use `/addreactionrole` to add more roles to this message.\n"
            "Use `/finishreactionroles` to save changes.",
            ephemeral=True
        )

    @app_commands.command(name="removereactionrole", description="Remove a reaction role from a message")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(message_id="The ID of the reaction role message", emoji="The emoji to remove")
    async def remove_reaction_role(self, interaction: discord.Interaction, message_id: str, emoji: str):
        """Remove a reaction role from a message"""
        try:
            message_id = int(message_id)
        except:
            return await interaction.response.send_message(
                "Invalid message ID format.",
                ephemeral=True
            )

        # Check if message exists in our system
        message_info = self.db.get_message_info(message_id)
        if not message_info:
            return await interaction.response.send_message(
                "No reaction role message found with that ID.",
                ephemeral=True
            )

        channel_id, guild_id, title, color = message_info
        if guild_id != interaction.guild.id:
            return await interaction.response.send_message(
                "That message is not from this server.",
                ephemeral=True
            )

        # Remove from database
        self.db.remove_reaction_role(message_id, emoji)
        
        # Update the message
        updated_message = await self._update_reaction_message(message_id)
        if not updated_message:
            return await interaction.response.send_message(
                "Message couldn't be updated. It may have been deleted.",
                ephemeral=True
            )

        await interaction.response.send_message(
            f"Removed reaction role {emoji} from message.",
            ephemeral=True
        )

    @commands.Cog.listener()
    async def on_raw_reaction_add(self, payload):
        """Handle when a user reacts to a message"""
        if payload.member and payload.member.bot:
            return

        roles = self.db.get_reaction_roles(payload.message_id)
        if not roles:
            return

        guild = self.bot.get_guild(payload.guild_id)
        if not guild:
            return

        member = guild.get_member(payload.user_id)
        if not member:
            return

        for emoji, role_id, _ in roles:
            if str(payload.emoji) == emoji:
                role = guild.get_role(role_id)
                if role:
                    try:
                        await member.add_roles(role, reason="Reaction role")
                    except:
                        print(f"Failed to assign role to {member.display_name}")

    @commands.Cog.listener()
    async def on_raw_reaction_remove(self, payload):
        """Handle when a user removes a reaction"""
        roles = self.db.get_reaction_roles(payload.message_id)
        if not roles:
            return

        guild = self.bot.get_guild(payload.guild_id)
        if not guild:
            return

        member = guild.get_member(payload.user_id)
        if not member:
            return

        for emoji, role_id, _ in roles:
            if str(payload.emoji) == emoji:
                role = guild.get_role(role_id)
                if role:
                    try:
                        await member.remove_roles(role, reason="Reaction role removed")
                    except:
                        print(f"Failed to remove role from {member.display_name}")

async def setup(bot):
    await bot.add_cog(ReactionRoles(bot))