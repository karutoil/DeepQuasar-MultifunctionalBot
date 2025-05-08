const { Events } = require('discord.js');
const modlogCommand = require('../commands/modlog');

module.exports = {
    name: Events.GuildEmojiDelete,
    once: false,
    async execute(emoji) {
        // Log the emoji deletion event
        await modlogCommand.logAction(
            emoji.client,
            emoji.guild.id,
            'emoji_update',
            { emoji, action: 'deleted' }
        );
    }
};