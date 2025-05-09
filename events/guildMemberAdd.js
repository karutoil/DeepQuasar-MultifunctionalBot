const { Events, EmbedBuilder, Colors } = require('discord.js');
const autoRoleModel = require('../models/autoRoleModel');
const welcomeLeaveModel = require('../models/welcomeLeaveModel');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        try {
            // Handle autorole assignment
            await this.handleAutorole(member);
            
            // Handle welcome message
            await this.handleWelcomeMessage(member);
            
            // Log member join to modlog
            await modlogCommand.logAction(
                member.client,
                member.guild.id,
                'member_join',
                { member }
            );
        } catch (error) {
            console.error(`Error in guildMemberAdd event handler for ${member.user.tag}:`, error);
        }
    },
    
    async handleAutorole(member) {
        try {
            // Get autorole for this guild
            const roleId = await autoRoleModel.getRoleForGuild(member.guild.id);
            if (!roleId) return;
            
            // Fetch the role
            const role = await member.guild.roles.fetch(roleId).catch(() => null);
            if (!role) {
                console.error(`❌ Configured role ${roleId} not found in ${member.guild.name}`);
                await autoRoleModel.removeRoleForGuild(member.guild.id);
                return;
            }
            
            // Verify permissions
            const botMember = member.guild.members.me;
            if (!botMember.permissions.has('ManageRoles')) {
                console.error(`❌ Missing Manage Roles permission in ${member.guild.name}`);
                return;
            }
            
            if (role.position >= botMember.roles.highest.position) {
                console.error(`❌ Bot's role is too low in ${member.guild.name}`);
                return;
            }
            
            // Assign the role
            await member.roles.add(role, 'Auto-role assignment');
            console.log(`✅ Assigned ${role.name} to ${member.user.tag} in ${member.guild.name}`);
            
        } catch (error) {
            if (error.code === 50013) {
                console.error(`❌ Missing permissions to assign role in ${member.guild.name}`);
            } else {
                console.error(`❌ Error assigning auto-role in ${member.guild.name}:`, error);
            }
        }
    },
    
    async handleWelcomeMessage(member) {
        try {
            // Get welcome channel ID for this guild
            const [welcomeChannelId] = await welcomeLeaveModel.getChannels(member.guild.id);
            if (!welcomeChannelId) return;
            
            // Fetch the channel
            const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
            if (!channel) {
                console.error(`❌ Welcome channel ${welcomeChannelId} not found in ${member.guild.name}`);
                return;
            }
            
            // Create and send the embed
            const embed = this.createEmbed(member, true);
            await channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error(`❌ Error sending welcome message in ${member.guild.name}:`, error);
        }
    },
    
    createEmbed(member, isJoin) {
        const action = isJoin ? 'joined the guild' : 'has left the guild';
        const embed = new EmbedBuilder()
            .setDescription(`**${member.user.tag}** (${member.id}) ${action}\n${member.user.username}`)
            .setColor(isJoin ? Colors.Green : Colors.Red)
            .addFields(
                { name: 'Member', value: member.toString(), inline: true },
                { name: 'Member ID', value: member.id, inline: true },
                { name: 'Total Users', value: member.guild.memberCount.toString(), inline: true },
                { 
                    name: 'Member since', 
                    value: member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    }) : 'Unknown', 
                    inline: false 
                },
                { 
                    name: 'Account created', 
                    value: new Date(member.user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric'
                    }), 
                    inline: false 
                }
            )
            .setThumbnail(member.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
            
        return embed;
    }
}