const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstatus')
        .setDescription('Displays the bot\'s RAM usage, CPU usage, and uptime.'),
    async execute(interaction) {
        const memoryUsage = process.memoryUsage();
        const usedMemory = (memoryUsage.rss / 1024 / 1024).toFixed(2); // Convert to MB
        const cpuUsage = require('os').loadavg()[0].toFixed(2); // 1-minute load average
        const uptime = process.uptime(); // Uptime in seconds

        const uptimeString = new Date(uptime * 1000).toISOString().substr(11, 8); // Format as HH:mm:ss

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('Bot Status')
            .addFields(
                { name: 'RAM Usage', value: `${usedMemory} MB`, inline: true },
                { name: 'CPU Load (1m avg)', value: `${cpuUsage}`, inline: true },
                { name: 'Uptime', value: `${uptimeString}`, inline: false },
                { name: 'Made By', value: `Karutoil, Cluade, ChatGPT, and DeepSeek`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Bot Status Information', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};