const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildUpdate,
    once: false,
    async execute(oldGuild, newGuild) {
        // Skip if no significant changes
        if (oldGuild.name === newGuild.name && 
            oldGuild.iconURL() === newGuild.iconURL() &&
            oldGuild.bannerURL() === newGuild.bannerURL() &&
            oldGuild.description === newGuild.description &&
            oldGuild.verificationLevel === newGuild.verificationLevel) {
            return;
        }
        
        // Log the guild update event
        await modlogCommand.logAction(
            oldGuild.client,
            oldGuild.id,
            'guild_update',
            { before: oldGuild, after: newGuild }
        );
    }
};