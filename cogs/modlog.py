import discord
from discord.ext import commands
from discord import app_commands
from datetime import datetime
from db.modlog_db import ModLogDB
from typing import Optional

DEFAULT_EVENTS = {
    'message_edit': True,
    'message_delete': True,
    'member_update': True,
    'role_change': True,
    'role_create': True,
    'role_delete': True,
    'voice_state_update': True,
    'member_join': True,
    'member_remove': True,
    'channel_update': True,
    'channel_create': True,
    'channel_delete': True,
    'guild_update': True,
    'emoji_update': True,
    'sticker_update': True,
    'invite_create': True,
    'invite_delete': True,
    'thread_create': True,
    'thread_delete': True,
    'thread_update': True,
    'admin_command': True,
    'command': True
}

class ModLog(commands.Cog):
    modlog_group = app_commands.Group(
        name="modlog",
        description="Moderation log configuration"
    )

    def __init__(self, bot):
        self.bot = bot
        self.db = ModLogDB()
        
        # Initialize per-guild settings cache
        self.guild_settings = {}

    def cog_unload(self):
        pass

    async def load_guild_settings(self, guild_id: int):
        """Load settings from database or use defaults"""
        settings = self.db.get_guild_settings(guild_id)
        
        if settings:
            # Merge defaults with stored enabled_events
            enabled_events = settings.get('enabled_events') or {}
            merged_events = DEFAULT_EVENTS.copy()
            merged_events.update(enabled_events)
            self.guild_settings[guild_id] = {
                'log_channel_id': settings['log_channel_id'],
                'enabled_events': merged_events
            }
        else:
            self.guild_settings[guild_id] = {
                'log_channel_id': None,
                'enabled_events': DEFAULT_EVENTS.copy()
            }

    def get_log_channel(self, guild_id: int) -> Optional[discord.TextChannel]:
        """Get the log channel for a guild"""
        if guild_id not in self.guild_settings:
            return None

        channel_id = self.guild_settings[guild_id]['log_channel_id']
        return self.bot.get_channel(channel_id) if channel_id else None

    def is_event_enabled(self, guild_id: int, event: str) -> bool:
        """Check if an event is enabled for a guild"""
        if guild_id not in self.guild_settings:
            return False
        return self.guild_settings[guild_id]['enabled_events'].get(event, False)

    async def log_action(self, guild_id: int, action: str, **kwargs):
        """Main logging function with persistence check"""
        if guild_id not in self.guild_settings:
            await self.load_guild_settings(guild_id)

        log_channel = self.get_log_channel(guild_id)
        event_enabled = self.is_event_enabled(guild_id, action)

        if not log_channel or not event_enabled:
            return

        embed = discord.Embed(
            color=0x3498db,
            timestamp=datetime.utcnow()
        )
        embed.set_footer(text=f"Event: {action.replace('_', ' ').title()}")

        # Admin command event logging
        if action == "admin_command":
            user = kwargs.get("user")
            command_name = kwargs.get("command")
            details = kwargs.get("details", "")

            embed.title = "⚙️ Admin Command Executed"
            embed.add_field(name="User", value=f"{user.mention} (`{user.id}`)", inline=False)
            embed.add_field(name="Command", value=command_name, inline=False)
            if details:
                embed.add_field(name="Details", value=details, inline=False)

            try:
                await log_channel.send(embed=embed)
            except Exception:
                pass
            return

        # Message Events
        if action == "message_edit":
            before, after = kwargs['before'], kwargs['after']
            embed.title = "✏️ Message Edited"
            embed.add_field(name="Author", value=before.author.mention, inline=False)
            embed.add_field(name="Before", value=before.content[:1000] or "[No Content]", inline=False)
            embed.add_field(name="After", value=after.content[:1000] or "[No Content]", inline=False)
            embed.add_field(name="Channel", value=before.channel.mention)
            if before.guild:
                embed.add_field(name="Message ID", value=before.id)

        elif action == "message_delete":
            message = kwargs['message']
            embed.title = "🗑️ Message Deleted"
            embed.add_field(name="Author", value=message.author.mention, inline=False)
            embed.add_field(name="Content", value=message.content[:1000] or "[No Content]", inline=False)
            embed.add_field(name="Channel", value=message.channel.mention)
            if message.guild:
                embed.add_field(name="Message ID", value=message.id)

        # Member Events
        elif action == "member_join":
            member = kwargs['member']
            embed.title = "🆕 Member Joined"
            embed.description = f"{member.mention} (`{member.id}`)"
            embed.set_thumbnail(url=member.display_avatar.url)
            embed.add_field(name="Account Created", value=discord.utils.format_dt(member.created_at, 'R'))

        elif action == "member_remove":
            member = kwargs['member']
            embed.title = "🚪 Member Left"
            embed.description = f"{member.mention} (`{member.id}`)"
            embed.set_thumbnail(url=member.display_avatar.url)
            if member.joined_at:
                embed.add_field(name="Joined", value=discord.utils.format_dt(member.joined_at, 'R'))

        elif action == "member_update":
            before, after = kwargs['before'], kwargs['after']
            embed.title = "👤 Member Updated"
            
            if before.nick != after.nick:
                embed.add_field(name="Nickname Changed", 
                              value=f"**Before:** {before.nick or 'None'}\n**After:** {after.nick or 'None'}", 
                              inline=False)
            
            if before.roles != after.roles:
                added = [r.mention for r in after.roles if r not in before.roles]
                removed = [r.mention for r in before.roles if r not in after.roles]
                
                if added:
                    embed.add_field(name="Roles Added", value=", ".join(added) or "None", inline=False)
                if removed:
                    embed.add_field(name="Roles Removed", value=", ".join(removed) or "None", inline=False)

        # Role Events
        elif action == "role_create":
            role = kwargs['role']
            embed.title = "🆕 Role Created"
            embed.description = f"{role.mention} (`{role.id}`)"
            embed.color = role.color if role.color.value != 0 else 0x3498db

        elif action == "role_delete":
            role = kwargs['role']
            embed.title = "🗑️ Role Deleted"
            embed.description = f"`{role.name}` (`{role.id}`)"
            embed.color = role.color if role.color.value != 0 else 0x3498db

        elif action == "role_change":
            before, after = kwargs['before'], kwargs['after']
            embed.title = "🔄 Role Updated"
            embed.description = f"{after.mention} (`{after.id}`)"
            
            changes = []
            if before.name != after.name:
                changes.append(f"**Name:** {before.name} → {after.name}")
            if before.color != after.color:
                changes.append(f"**Color:** {before.color} → {after.color}")
            if before.permissions != after.permissions:
                changed_perms = [
                    f"`{perm}`" for perm, (before_val, after_val) 
                    in zip(before.permissions, after.permissions)
                    if before_val != after_val
                ]
                if changed_perms:
                    changes.append(f"**Permissions Changed:** {', '.join(changed_perms)}")
            
            if changes:
                embed.add_field(name="Changes", value="\n".join(changes), inline=False)

        # Channel Events
        elif action == "channel_create":
            channel = kwargs['channel']
            embed.title = "🆕 Channel Created"
            embed.description = f"{channel.mention} (`{channel.id}`)"
            embed.add_field(name="Type", value=str(channel.type).title())

        elif action == "channel_delete":
            channel = kwargs['channel']
            embed.title = "🗑️ Channel Deleted"
            embed.description = f"`{channel.name}` (`{channel.id}`)"
            embed.add_field(name="Type", value=str(channel.type).title())

        elif action == "channel_update":
            before, after = kwargs['before'], kwargs['after']
            embed.title = "🔄 Channel Updated"
            embed.description = f"{after.mention} (`{after.id}`)"
            
            changes = []
            if before.name != after.name:
                changes.append(f"**Name:** {before.name} → {after.name}")
            if getattr(before, 'topic', None) != getattr(after, 'topic', None):
                changes.append(f"**Topic:** {before.topic or 'None'} → {after.topic or 'None'}")
            if hasattr(before, 'slowmode_delay') and before.slowmode_delay != after.slowmode_delay:
                changes.append(f"**Slowmode:** {before.slowmode_delay}s → {after.slowmode_delay}s")
            
            if changes:
                embed.add_field(name="Changes", value="\n".join(changes), inline=False)

        # Voice Events
        elif action == "voice_state_update":
            member, before, after = kwargs['member'], kwargs['before'], kwargs['after']
            embed.title = "🎤 Voice State Update"
            embed.description = f"{member.mention} (`{member.id}`)"
            
            if not before.channel and after.channel:
                embed.add_field(name="Joined", value=after.channel.mention)
            elif before.channel and not after.channel:
                embed.add_field(name="Left", value=before.channel.mention)
            elif before.channel != after.channel:
                embed.add_field(name="Moved", value=f"{before.channel.mention} → {after.channel.mention}")
            
            if before.mute != after.mute:
                embed.add_field(name="Mute", value=f"{before.mute} → {after.mute}")
            if before.deaf != after.deaf:
                embed.add_field(name="Deafen", value=f"{before.deaf} → {after.deaf}")
            if before.self_mute != after.self_mute:
                embed.add_field(name="Self Mute", value=f"{before.self_mute} → {after.self_mute}")
            if before.self_deaf != after.self_deaf:
                embed.add_field(name="Self Deafen", value=f"{before.self_deaf} → {after.self_deaf}")

        # Guild Events
        elif action == "guild_update":
            before, after = kwargs['before'], kwargs['after']
            embed.title = "🔄 Server Updated"
            
            changes = []
            if before.name != after.name:
                changes.append(f"**Name:** {before.name} → {after.name}")
            if before.icon != after.icon:
                changes.append("**Icon:** Changed")
                if after.icon:
                    embed.set_thumbnail(url=after.icon.url)
            if before.banner != after.banner:
                changes.append("**Banner:** Changed")
            if before.afk_channel != after.afk_channel:
                changes.append(f"**AFK Channel:** {before.afk_channel.mention if before.afk_channel else 'None'} → {after.afk_channel.mention if after.afk_channel else 'None'}")
            
            if changes:
                embed.description = "\n".join(changes)

        # Invite Events
        elif action == "invite_create":
            invite = kwargs['invite']
            embed.title = "➕ Invite Created"
            embed.description = f"**Code:** `{invite.code}`"
            if invite.inviter:
                embed.add_field(name="Inviter", value=invite.inviter.mention)
            if invite.channel:
                embed.add_field(name="Channel", value=invite.channel.mention)
            if invite.max_age:
                embed.add_field(name="Expires", value=discord.utils.format_dt(datetime.utcnow() + invite.max_age, 'R'))
            if invite.max_uses:
                embed.add_field(name="Max Uses", value=invite.max_uses)

        elif action == "invite_delete":
            invite = kwargs['invite']
            embed.title = "➖ Invite Deleted"
            embed.description = f"**Code:** `{invite.code}`"
            if invite.channel:
                embed.add_field(name="Channel", value=invite.channel.mention)

        # Thread Events
        elif action == "thread_create":
            thread = kwargs['thread']
            embed.title = "🆕 Thread Created"
            embed.description = f"{thread.mention} (`{thread.id}`)"
            embed.add_field(name="Parent", value=thread.parent.mention)

        elif action == "thread_delete":
            thread = kwargs['thread']
            embed.title = "🗑️ Thread Deleted"
            embed.description = f"`{thread.name}` (`{thread.id}`)"
            if hasattr(thread, 'parent'):
                embed.add_field(name="Parent", value=thread.parent.mention)

        elif action == "thread_update":
            before, after = kwargs['before'], kwargs['after']
            embed.title = "🔄 Thread Updated"
            embed.description = f"{after.mention} (`{after.id}`)"
            
            changes = []
            if before.name != after.name:
                changes.append(f"**Name:** {before.name} → {after.name}")
            if before.archived != after.archived:
                changes.append(f"**Archived:** {before.archived} → {after.archived}")
            if before.locked != after.locked:
                changes.append(f"**Locked:** {before.locked} → {after.locked}")
            
            if changes:
                embed.add_field(name="Changes", value="\n".join(changes), inline=False)

        # Emoji/Sticker Events
        elif action == "emoji_update":
            before, after = kwargs['before'], kwargs['after']
            embed.title = "🔄 Emoji Updated"
            embed.description = f"{after} (`{after.id}`)"
            
            changes = []
            if before.name != after.name:
                changes.append(f"**Name:** {before.name} → {after.name}")
            
            if changes:
                embed.add_field(name="Changes", value="\n".join(changes), inline=False)

        elif action == "sticker_update":
            before, after = kwargs['before'], kwargs['after']
            embed.title = "🔄 Sticker Updated"
            embed.description = f"{after.name} (`{after.id}`)"
            
            changes = []
            if before.name != after.name:
                changes.append(f"**Name:** {before.name} → {after.name}")
            if before.description != after.description:
                changes.append(f"**Description:** {before.description or 'None'} → {after.description or 'None'}")
            
            if changes:
                embed.add_field(name="Changes", value="\n".join(changes), inline=False)

        await log_channel.send(embed=embed)

    @modlog_group.command(name="setchannel", description="Set the channel for moderation logs")
    async def set_modlog_channel(self, interaction: discord.Interaction, channel: discord.TextChannel):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        guild_id = interaction.guild.id
        
        # Initialize if not loaded
        if guild_id not in self.guild_settings:
            await self.load_guild_settings(guild_id)
            
        self.guild_settings[guild_id]['log_channel_id'] = channel.id
        self.db.update_settings(guild_id, channel_id=channel.id)
        
        await interaction.response.send_message(
            f"Moderation logs will now be sent to {channel.mention}",
            ephemeral=True
        )

        # Log admin command usage
        await self.log_action(
            guild_id,
            "admin_command",
            user=interaction.user,
            command="setmodlog",
            details=f"Set log channel to {channel.mention} (ID: {channel.id})"
        )

    @modlog_group.command(name="toggle", description="Enable or disable a specific log event")
    @app_commands.describe(event="The event to toggle")
    async def toggle_modlog_event(self, interaction: discord.Interaction, event: str):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        guild_id = interaction.guild.id
        
        if guild_id not in self.guild_settings:
            await self.load_guild_settings(guild_id)
            
        if event in DEFAULT_EVENTS:
            current_state = self.guild_settings[guild_id]['enabled_events'][event]
            self.guild_settings[guild_id]['enabled_events'][event] = not current_state
            
            # Update database
            self.db.set_enabled_events(
                guild_id,
                self.guild_settings[guild_id]['enabled_events']
            )
            
            status = "enabled" if not current_state else "disabled"
            await interaction.response.send_message(
                f"Event '{event.replace('_', ' ')}' is now {status}",
                ephemeral=True
            )

            # Log admin command usage
            await self.log_action(
                guild_id,
                "admin_command",
                user=interaction.user,
                command="togglemodlog",
                details=f"Toggled event '{event}' to {status}"
            )
        else:
            await interaction.response.send_message(
                f"Invalid event. Available events: {', '.join(DEFAULT_EVENTS.keys())}",
                ephemeral=True
            )

    @modlog_group.command(name="toggleall", description="Enable or disable all moderation log events")
    async def toggle_all_modlog_events(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        guild_id = interaction.guild.id

        if guild_id not in self.guild_settings:
            await self.load_guild_settings(guild_id)

        enabled_events = self.guild_settings[guild_id]['enabled_events']

        # Determine if any event is currently disabled
        any_disabled = any(not state for state in enabled_events.values())

        # If any event is disabled, enable all; else disable all
        new_state = True if any_disabled else False

        for event_name in DEFAULT_EVENTS.keys():
            enabled_events[event_name] = new_state

        # Persist changes
        self.db.set_enabled_events(guild_id, enabled_events)

        status = "enabled" if new_state else "disabled"
        await interaction.response.send_message(
            f"All moderation log events have been {status}.",
            ephemeral=True
        )

        # Log admin command usage
        await self.log_action(
            guild_id,
            "admin_command",
            user=interaction.user,
            command="toggleallmodlog",
            details=f"Set all events to {status}"
        )


    # Event Listeners

    @commands.Cog.listener()
    async def on_message_delete(self, message):
        if not message.guild or message.author.bot:
            return
        await self.log_action(message.guild.id, "message_delete", message=message)

    @commands.Cog.listener()
    async def on_message_edit(self, before, after):
        if not before.guild or before.author.bot or before.content == after.content:
            return
        await self.log_action(before.guild.id, "message_edit", before=before, after=after)

    @commands.Cog.listener()
    async def on_member_join(self, member):
        await self.log_action(member.guild.id, "member_join", member=member)

    @commands.Cog.listener()
    async def on_member_remove(self, member):
        await self.log_action(member.guild.id, "member_remove", member=member)

    @commands.Cog.listener()
    async def on_member_update(self, before, after):
        if before.nick != after.nick or before.roles != after.roles:
            await self.log_action(before.guild.id, "member_update", before=before, after=after)

    @commands.Cog.listener()
    async def on_guild_role_create(self, role):
        await self.log_action(role.guild.id, "role_create", role=role)

    @commands.Cog.listener()
    async def on_guild_role_delete(self, role):
        await self.log_action(role.guild.id, "role_delete", role=role)

    @commands.Cog.listener()
    async def on_guild_role_update(self, before, after):
        await self.log_action(before.guild.id, "role_change", before=before, after=after)

    @commands.Cog.listener()
    async def on_voice_state_update(self, member, before, after):
        if member.guild:
            await self.log_action(member.guild.id, "voice_state_update", member=member, before=before, after=after)

    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel):
        await self.log_action(channel.guild.id, "channel_create", channel=channel)

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel):
        await self.log_action(channel.guild.id, "channel_delete", channel=channel)

    @commands.Cog.listener()
    async def on_guild_channel_update(self, before, after):
        await self.log_action(before.guild.id, "channel_update", before=before, after=after)

    @commands.Cog.listener()
    async def on_guild_update(self, before, after):
        await self.log_action(before.id, "guild_update", before=before, after=after)

    @commands.Cog.listener()
    async def on_invite_create(self, invite):
        if invite.guild:
            await self.log_action(invite.guild.id, "invite_create", invite=invite)

    @commands.Cog.listener()
    async def on_invite_delete(self, invite):
        if invite.guild:
            await self.log_action(invite.guild.id, "invite_delete", invite=invite)

    @commands.Cog.listener()
    async def on_thread_create(self, thread):
        if thread.guild:
            await self.log_action(thread.guild.id, "thread_create", thread=thread)

    @commands.Cog.listener()
    async def on_thread_delete(self, thread):
        if thread.guild:
            await self.log_action(thread.guild.id, "thread_delete", thread=thread)

    @commands.Cog.listener()
    async def on_thread_update(self, before, after):
        if before.guild:
            await self.log_action(before.guild.id, "thread_update", before=before, after=after)

    @commands.Cog.listener()
    async def on_guild_emojis_update(self, guild, before, after):
        for emoji in after:
            before_emoji = next((e for e in before if e.id == emoji.id), None)
            if before_emoji and before_emoji.name != emoji.name:
                await self.log_action(guild.id, "emoji_update", before=before_emoji, after=emoji)

    @commands.Cog.listener()
    async def on_guild_stickers_update(self, guild, before, after):
        for sticker in after:
            before_sticker = next((s for s in before if s.id == sticker.id), None)
            if before_sticker and (before_sticker.name != sticker.name or before_sticker.description != sticker.description):
                await self.log_action(guild.id, "sticker_update", before=before_sticker, after=sticker)

    @commands.Cog.listener()
    async def on_app_command_completion(self, interaction: discord.Interaction, command: app_commands.Command):
        try:
            guild = interaction.guild
            if not guild:
                return

            params_list = interaction.data.get("options", []) if interaction.data else []
            params = ", ".join(f"{opt['name']}={opt.get('value')}" for opt in params_list)

            await self.log_action(
                guild.id,
                "command",
                user=interaction.user,
                command=command.qualified_name,
                details=f"Parameters: {params}"
            )
        except Exception:
            pass

    @commands.Cog.listener()
    async def on_app_command_error(self, interaction: discord.Interaction, error):
        try:
            guild = interaction.guild
            if not guild:
                return

            command_name = "unknown"
            if hasattr(interaction, "command") and interaction.command:
                command_name = interaction.command.qualified_name

            params_list = interaction.data.get("options", []) if interaction.data else []
            params = ", ".join(f"{opt['name']}={opt.get('value')}" for opt in params_list)

            await self.log_action(
                guild.id,
                "command",
                user=interaction.user,
                command=command_name,
                details=f"Parameters: {params}\nError: {error}"
            )
        except Exception:
            pass

async def setup(bot):
    cog = ModLog(bot)
    await bot.add_cog(cog)
    
    # Preload settings for all guilds the bot is in
    for guild in bot.guilds:
        await cog.load_guild_settings(guild.id)
