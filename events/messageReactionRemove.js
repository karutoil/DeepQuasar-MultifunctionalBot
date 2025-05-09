const { Events } = require('discord.js');
const reactionRolesModel = require('../models/reactionRolesModel');

module.exports = {
    name: Events.MessageReactionRemove,
    once: false,
    async execute(reaction, user) {
        // Skip if the reaction was by a bot
        if (user.bot) return;
        
        // If the message is uncached, fetch it
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Error fetching reaction:', error);
                return;
            }
        }
        
        // Get roles for this message
        const roles = await reactionRolesModel.getReactionRoles(reaction.message.id);
        if (!roles || roles.length === 0) return;
        
        // Get the guild
        const guild = reaction.message.guild;
        if (!guild) return;
        
        // Get the member
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;
        
        // Find the matching role
        for (const [emoji, roleId, _] of roles) {
            if (reaction.emoji.toString() === emoji) {
                const role = await guild.roles.fetch(roleId).catch(() => null);
                if (role) {
                    try {
                        await member.roles.remove(role, 'Reaction role removed');
                        console.log(`✅ Removed role ${role.name} from ${member.user.tag} via reaction role`);
                    } catch (error) {
                        console.error(`❌ Failed to remove role from ${member.user.tag}:`, error);
                    }
                    break;
                }
            }
        }
    }
};