const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildEmojiCreate,
    once: false,
    async execute(emoji) {
        // Log the emoji creation event
        await modlogCommand.logAction(
            emoji.client,
            emoji.guild.id,
            'emoji_update',
            { emoji, action: 'created' }
        );
    }
};