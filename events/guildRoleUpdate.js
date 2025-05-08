const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildRoleUpdate,
    once: false,
    async execute(oldRole, newRole) {
        // Log the role update event
        await modlogCommand.logAction(
            oldRole.client, 
            oldRole.guild.id, 
            'role_change',
            { before: oldRole, after: newRole }
        );
    }
};