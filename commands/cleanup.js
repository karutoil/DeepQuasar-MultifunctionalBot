const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    Collection 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('Bulk delete messages')
        .addSubcommand(subcommand =>
            subcommand
                .setName('messages')
                .setDescription('Delete the last X messages in this channel')
                .addIntegerOption(option => 
                    option.setName('amount')
                          .setDescription('The number of messages to delete')
                          .setRequired(true)
                          .setMinValue(1)
                          .setMaxValue(100))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('Delete all messages in this channel')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Delete a number of messages from a specific user')
                .addUserOption(option => 
                    option.setName('user')
                          .setDescription('The user whose messages to delete')
                          .setRequired(true))
                .addIntegerOption(option => 
                    option.setName('amount')
                          .setDescription('The number of messages to delete')
                          .setRequired(true)
                          .setMinValue(1)
                          .setMaxValue(100))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // Check if the bot has permission to manage messages
        if (!interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
            return await interaction.reply({ 
                content: "I don't have permission to delete messages in this channel!", 
                ephemeral: true 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'messages':
                await this.cleanupMessages(interaction);
                break;
            case 'all':
                await this.cleanupAll(interaction);
                break;
            case 'user':
                await this.cleanupUser(interaction);
                break;
        }
    },

    async cleanupMessages(interaction) {
        const amount = interaction.options.getInteger('amount');
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // Discord.js bulk delete is limited to messages not older than 14 days
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            const filteredMessages = messages.filter(msg => !msg.pinned && Date.now() - msg.createdTimestamp < 1209600000);
            
            if (filteredMessages.size === 0) {
                return await interaction.followUp({ 
                    content: "No messages found that can be deleted. Messages older than 14 days cannot be bulk deleted.", 
                    ephemeral: true 
                });
            }
            
            const deletedCount = await interaction.channel.bulkDelete(filteredMessages, true)
                .then(deleted => deleted.size);
            
            await interaction.followUp({ 
                content: `Deleted ${deletedCount} messages.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error deleting messages:', error);
            await interaction.followUp({ 
                content: "An error occurred while trying to delete messages.", 
                ephemeral: true 
            });
        }
    },

    async cleanupAll(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            let totalDeleted = 0;
            let lastBatchSize = 100;
            
            // Continue fetching and deleting messages until we get fewer than the batch size
            while (lastBatchSize === 100) {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const filteredMessages = messages.filter(msg => !msg.pinned && Date.now() - msg.createdTimestamp < 1209600000);
                
                if (filteredMessages.size === 0) break;
                
                const deletedCount = await interaction.channel.bulkDelete(filteredMessages, true)
                    .then(deleted => deleted.size);
                
                totalDeleted += deletedCount;
                lastBatchSize = filteredMessages.size;
                
                // If we deleted fewer messages than we fetched, we've hit the 14-day limit
                if (deletedCount < filteredMessages.size) break;
            }
            
            await interaction.followUp({ 
                content: `Deleted ${totalDeleted} messages. Messages older than 14 days cannot be bulk deleted.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error deleting all messages:', error);
            await interaction.followUp({ 
                content: "An error occurred while trying to delete messages.", 
                ephemeral: true 
            });
        }
    },

    async cleanupUser(interaction) {
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // First, fetch the full history up to 1000 messages to find user messages
            let messagesCollection = new Collection();
            let lastId = null;
            let userMessageCount = 0;
            
            // Keep fetching messages until we have enough from the specified user
            // or until we've gone through 1000 messages total
            while (userMessageCount < amount && messagesCollection.size < 1000) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;
                
                const messages = await interaction.channel.messages.fetch(options);
                if (messages.size === 0) break;
                
                messagesCollection = messagesCollection.concat(messages);
                lastId = messages.last().id;
                
                // Count the target user's messages
                userMessageCount = messagesCollection.filter(msg => msg.author.id === user.id).size;
            }
            
            // Filter messages by the specified user and limit to requested amount
            const userMessages = messagesCollection
                .filter(msg => msg.author.id === user.id && !msg.pinned && Date.now() - msg.createdTimestamp < 1209600000)
                .first(amount);
            
            if (userMessages.length === 0) {
                return await interaction.followUp({ 
                    content: `No recent messages from ${user.tag} found that can be deleted.`, 
                    ephemeral: true 
                });
            }
            
            // Delete the messages in batches to avoid rate limits
            let totalDeleted = 0;
            const batchSize = 50;
            
            for (let i = 0; i < userMessages.length; i += batchSize) {
                const batch = userMessages.slice(i, i + batchSize);
                if (batch.length === 0) break;
                
                try {
                    // Try bulk delete first
                    await interaction.channel.bulkDelete(batch, true);
                    totalDeleted += batch.length;
                } catch (error) {
                    // Fallback to individual deletion if bulk delete fails
                    for (const msg of batch) {
                        try {
                            await msg.delete();
                            totalDeleted++;
                        } catch (e) {
                            // Skip messages that can't be deleted
                        }
                    }
                }
                
                // Add a short delay between batches to avoid rate limits
                if (i + batchSize < userMessages.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            await interaction.followUp({ 
                content: `Deleted ${totalDeleted} messages from ${user.tag}.`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error deleting user messages:', error);
            await interaction.followUp({ 
                content: "An error occurred while trying to delete messages.", 
                ephemeral: true 
            });
        }
    }
};