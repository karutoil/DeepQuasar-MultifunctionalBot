const { EmbedBuilder } = require('discord.js');
const { getGuildState } = require('./utils');
const musicModel = require('../../models/musicModel');

module.exports = {
    async execute(interaction, client) {
        const guildId = interaction.guildId;
        const guildState = getGuildState(client, guildId);
        const history = guildState.history || [];
        
        // No DJ check needed for read-only commands
        
        if (history.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('ℹ️ No History')
                .setDescription('No tracks have been played yet.')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        const historyItems = history.slice(0, 10).map((item, i) => 
            `**${i + 1}.** [${item.title}](${item.url || '#'})`
        ).join('\n');
        
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📜 Recently Played')
            .setDescription(historyItems)
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};