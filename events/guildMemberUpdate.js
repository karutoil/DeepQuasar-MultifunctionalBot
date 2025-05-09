const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildMemberUpdate,
    once: false,
    async execute(oldMember, newMember) {
        // Only log if there's a relevant change (nickname or roles)
        if (oldMember.nickname === newMember.nickname && 
            oldMember.roles.cache.size === newMember.roles.cache.size &&
            [...oldMember.roles.cache.keys()].every(role => newMember.roles.cache.has(role))) {
            return;
        }
        
        // Log the member update event
        await modlogCommand.logAction(
            oldMember.client, 
            oldMember.guild.id, 
            'member_update',
            { before: oldMember, after: newMember }
        );
    }
};