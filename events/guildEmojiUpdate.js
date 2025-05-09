const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildEmojiUpdate,
    once: false,
    async execute(oldEmoji, newEmoji) {
        // Log the emoji update event
        await modlogCommand.logAction(
            oldEmoji.client,
            oldEmoji.guild.id,
            'emoji_update',
            { before: oldEmoji, after: newEmoji, action: 'updated' }
        );
    }
};