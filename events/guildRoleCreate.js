const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildRoleCreate,
    once: false,
    async execute(role) {
        // Log the role creation event
        await modlogCommand.logAction(
            role.client, 
            role.guild.id, 
            'role_create',
            { role }
        );
    }
};