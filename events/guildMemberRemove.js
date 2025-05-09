const { Events, EmbedBuilder, Colors } = require('discord.js');
const welcomeLeaveModel = require('../models/welcomeLeaveModel');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(member) {
        try {
            // Handle leave message
            await this.handleLeaveMessage(member);
            
            // Log member leave to modlog
            await modlogCommand.logAction(
                member.client,
                member.guild.id,
                'member_remove',
                { member }
            );
        } catch (error) {
            console.error(`Error in guildMemberRemove event handler for ${member.user.tag}:`, error);
        }
    },
    
    async handleLeaveMessage(member) {
        try {
            // Get leave channel ID for this guild
            const [_, leaveChannelId] = await welcomeLeaveModel.getChannels(member.guild.id);
            if (!leaveChannelId) return;
            
            // Fetch the channel
            const channel = await member.guild.channels.fetch(leaveChannelId).catch(() => null);
            if (!channel) {
                console.error(`❌ Leave channel ${leaveChannelId} not found in ${member.guild.name}`);
                return;
            }
            
            // Create and send the embed
            const embed = this.createLeaveEmbed(member);
            await channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error(`❌ Error sending leave message in ${member.guild.name}:`, error);
        }
    },
    
    createLeaveEmbed(member) {
        const embed = new EmbedBuilder()
            .setDescription(`**${member.user.tag}** (${member.id}) has left the guild\n${member.user.username}`)
            .setColor(Colors.Red)
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
};