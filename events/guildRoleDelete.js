const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildRoleDelete,
    once: false,
    async execute(role) {
        // Log the role deletion event
        await modlogCommand.logAction(
            role.client, 
            role.guild.id, 
            'role_delete',
            { role }
        );
    }
};