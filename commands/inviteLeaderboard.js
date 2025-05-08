const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    Colors 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invites')
        .setDescription('Invite management commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Show the top invites leaderboard.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'leaderboard') {
            await this.showLeaderboard(interaction);
        }
    },

    async showLeaderboard(interaction) {
        await interaction.deferReply({ ephemeral: false });
        
        try {
            // Fetch all guild invites
            const invites = await interaction.guild.invites.fetch();
            
            if (!invites || invites.size === 0) {
                return await interaction.followUp("No invites found for this server.");
            }
            
            // Convert to array and sort by uses descending
            const sortedInvites = [...invites.values()]
                .sort((a, b) => (b.uses || 0) - (a.uses || 0))
                .slice(0, 10); // Get top 10
            
            const leaderboardLines = sortedInvites.map((invite, index) => {
                const inviterName = invite.inviter ? invite.inviter.username : 'Unknown';
                const uses = invite.uses || 0;
                return `**${index + 1}.** ${inviterName} - \`${uses}\` uses (Code: \`${invite.code}\`)`;
            });
            
            const embed = new EmbedBuilder()
                .setTitle('📊 Invite Leaderboard')
                .setDescription(leaderboardLines.join('\n'))
                .setColor(Colors.Blue)
                .setFooter({ text: `${interaction.guild.name} | Total invites: ${invites.size}` })
                .setTimestamp();
            
            await interaction.followUp({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching invites:', error);
            await interaction.followUp('Failed to fetch invite information. Make sure I have the "Manage Server" permission.');
        }
    }
};