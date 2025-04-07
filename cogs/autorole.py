import discord
from discord.ext import commands
from discord import app_commands
from db.autorole_db import AutoRoleDB

class AutoRole(commands.Cog):
    autorole_group = app_commands.Group(
        name="autorole",
        description="Manage auto-role settings"
    )

    def __init__(self, bot):
        self.bot = bot
        self.db = AutoRoleDB()
        self.auto_roles = self.db.get_all_autoroles()  # Load from DB
        self._ready = False
        bot.loop.create_task(self._post_init())

    async def _post_init(self):
        await self.bot.wait_until_ready()
        self._ready = True
        print(f"AutoRole system ready. Tracking {len(self.auto_roles)} guilds")

    def cog_unload(self):
        """Clean up when cog is unloaded"""
        self.db.close()

    @commands.Cog.listener()
    async def on_member_join(self, member):
        """Reliable member join handler with persistence"""
        if not self._ready or member.guild.id not in self.auto_roles:
            return

        role = member.guild.get_role(self.auto_roles[member.guild.id])
        if not role:
            print(f"❌ Configured role not found in {member.guild.name}")
            self.db.remove_autorole(member.guild.id)
            del self.auto_roles[member.guild.id]
            return

        try:
            # Verify permissions
            if not member.guild.me.guild_permissions.manage_roles:
                print("❌ Missing Manage Roles permission")
                return

            if role.position >= member.guild.me.top_role.position:
                print("❌ Bot's role is too low")
                return

            # Attempt assignment
            await member.add_roles(role, reason="Auto-role assignment")
            print(f"✅ Assigned {role.name} to {member.display_name}")

        except discord.Forbidden:
            print("❌ Missing permissions to assign role")
        except discord.HTTPException as e:
            print(f"❌ Assignment failed: {e}")

    @autorole_group.command(name="set", description="Set role for new members")
    @app_commands.describe(role="The role to assign automatically")
    async def set_autorole(self, interaction: discord.Interaction, role: discord.Role):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        if not interaction.guild.me.guild_permissions.manage_roles:
            embed = discord.Embed(
                title="❌ Missing Permissions",
                description="I need **Manage Roles** permission!",
                color=discord.Color.red()
            )
            return await interaction.response.send_message(embed=embed, ephemeral=True)

        if role.position >= interaction.guild.me.top_role.position:
            embed = discord.Embed(
                title="❌ Role Hierarchy Issue",
                description=f"My role must be above {role.mention}!",
                color=discord.Color.red()
            )
            return await interaction.response.send_message(embed=embed, ephemeral=True)

        # Save to database
        self.db.set_autorole(interaction.guild.id, role.id)
        self.auto_roles[interaction.guild.id] = role.id
        
        embed = discord.Embed(
            title="✅ Auto-Role Configured",
            description=f"New members will receive: {role.mention}",
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @autorole_group.command(name="remove", description="Remove auto-role")
    async def remove_autorole(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        if interaction.guild.id in self.auto_roles:
            role = interaction.guild.get_role(self.auto_roles[interaction.guild.id])
            self.db.remove_autorole(interaction.guild.id)
            del self.auto_roles[interaction.guild.id]
            msg = f"Removed auto-role: {role.mention}" if role else "Removed auto-role"
        else:
            msg = "No auto-role was configured"
            
        embed = discord.Embed(
            title="✅ Auto-Role Disabled",
            description=msg,
            color=discord.Color.green()
        )
        await interaction.response.send_message(embed=embed)

    @autorole_group.command(name="status", description="Check auto-role status")
    async def autorole_status(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("You do not have permission to use this command.", ephemeral=True)
            return

        if interaction.guild.id in self.auto_roles:
            role = interaction.guild.get_role(self.auto_roles[interaction.guild.id])
            status = f"✅ Active: {role.mention}" if role else "❌ Role not found"
        else:
            status = "ℹ️ Not configured"
            
        embed = discord.Embed(
            title="🛠️ Auto-Role Status",
            description=status,
            color=discord.Color.blue()
        )
        
        # Add permission info
        perms = interaction.guild.me.guild_permissions
        embed.add_field(
            name="Permissions",
            value=f"Manage Roles: {'✅' if perms.manage_roles else '❌'}",
            inline=False
        )
        
        if interaction.guild.id in self.auto_roles and role:
            embed.add_field(
                name="Role Hierarchy",
                value=f"Bot can assign: {'✅' if role.position < interaction.guild.me.top_role.position else '❌'}",
                inline=False
            )
        
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(AutoRole(bot))
