const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder,
    Colors
} = require('discord.js');
const reactionRolesModel = require('../models/reactionRolesModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionroles')
        .setDescription('Manage reaction role messages')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Start creating a reaction role message')
                .addStringOption(option => 
                    option.setName('title')
                          .setDescription('The title for the reaction role message')
                          .setRequired(true))
                .addStringOption(option => 
                    option.setName('color')
                          .setDescription('The embed color in hex (e.g. #FF0000)')
                          .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a role to the current reaction role message')
                .addStringOption(option => 
                    option.setName('emoji')
                          .setDescription('The emoji to use')
                          .setRequired(true))
                .addRoleOption(option => 
                    option.setName('role')
                          .setDescription('The role to assign')
                          .setRequired(true))
                .addStringOption(option => 
                    option.setName('description')
                          .setDescription('Optional description for this role')
                          .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('finish')
                .setDescription('Post the reaction role message')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Add more roles to an existing reaction role message')
                .addStringOption(option => 
                    option.setName('message_id')
                          .setDescription('The ID of the message to edit')
                          .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a reaction role from a message')
                .addStringOption(option => 
                    option.setName('message_id')
                          .setDescription('The ID of the reaction role message')
                          .setRequired(true))
                .addStringOption(option => 
                    option.setName('emoji')
                          .setDescription('The emoji to remove')
                          .setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // In-memory state for pending reaction role messages
    pendingMessages: {}, // {channelId: {title, color, roles: {emoji: {roleId, description}}}}
    editingMessages: {}, // {channelId: messageId}

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'create':
                await this.createReactionRoles(interaction);
                break;
            case 'add':
                await this.addReactionRole(interaction);
                break;
            case 'finish':
                await this.finishReactionRoles(interaction);
                break;
            case 'edit':
                await this.editReactionRoles(interaction);
                break;
            case 'remove':
                await this.removeReactionRole(interaction);
                break;
        }
    },

    /**
     * Update an existing reaction role message
     * @param {string} messageId - The Discord message ID
     * @param {object} client - Discord.js client
     * @returns {Promise<Message|null>} Updated message or null if not found
     */
    async updateReactionMessage(messageId, client) {
        // Get message info from database
        const messageInfo = await reactionRolesModel.getMessageInfo(messageId);
        if (!messageInfo) return null;

        const [channelId, guildId, title, color] = messageInfo;
        
        // Get guild and channel
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return null;
        
        const channel = guild.channels.cache.get(channelId);
        if (!channel) return null;

        // Get message
        let message;
        try {
            message = await channel.messages.fetch(messageId);
        } catch (error) {
            return null;
        }

        // Get roles from database
        const roles = await reactionRolesModel.getReactionRoles(messageId);
        if (!roles || roles.length === 0) {
            // If no roles, delete the message and cleanup DB
            await message.delete().catch(() => {});
            await reactionRolesModel.removeAllMessageRoles(messageId);
            return null;
        }

        // Create new embed
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription("React to get roles!\n\n")
            .setColor(color);

        // Add role explanations
        const roleLines = [];
        for (const [emoji, roleId, description] of roles) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                let line = `${emoji} - ${role}`;
                if (description) {
                    line += `: ${description}`;
                }
                roleLines.push(line);
            }
        }

        embed.setDescription(embed.data.description + roleLines.join('\n'));

        // Update the message
        await message.edit({ embeds: [embed] });

        // Get current reactions and desired reactions
        const currentReactions = message.reactions.cache.map(r => r.emoji.toString());
        const desiredReactions = roles.map(([emoji]) => emoji);

        // Add missing reactions
        for (const [emoji] of roles) {
            if (!currentReactions.includes(emoji)) {
                try {
                    await message.react(emoji);
                } catch (error) {
                    console.error(`Failed to add reaction ${emoji}:`, error);
                }
            }
        }

        // Remove extra reactions
        for (const reaction of message.reactions.cache.values()) {
            if (!desiredReactions.includes(reaction.emoji.toString())) {
                try {
                    await reaction.remove();
                } catch (error) {
                    console.error(`Failed to remove reaction ${reaction.emoji}:`, error);
                }
            }
        }

        return message;
    },

    async createReactionRoles(interaction) {
        // Get options
        const title = interaction.options.getString('title');
        let colorStr = interaction.options.getString('color') || '#3498db';
        
        // Parse color
        let color;
        try {
            color = parseInt(colorStr.replace('#', ''), 16);
        } catch (error) {
            color = 0x3498db; // Default blue
        }

        // Store in pending messages
        this.pendingMessages[interaction.channelId] = {
            title,
            color,
            roles: {}
        };

        await interaction.reply({
            content: `Now creating reaction role message: **${title}**\nUse \`/reactionroles add\` to add roles to this message.`,
            ephemeral: true
        });
    },

    async addReactionRole(interaction) {
        // Get channel's pending message
        const pending = this.pendingMessages[interaction.channelId];
        if (!pending) {
            return await interaction.reply({
                content: "No reaction role message in progress. Use `/reactionroles create` first.",
                ephemeral: true
            });
        }

        // Get options
        const emoji = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role');
        const description = interaction.options.getString('description');

        // Verify bot permissions
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return await interaction.reply({
                content: "I need the **Manage Roles** permission to do this!",
                ephemeral: true
            });
        }

        // Check role hierarchy
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return await interaction.reply({
                content: `My role must be above ${role} to assign it!`,
                ephemeral: true
            });
        }

        // Add to pending roles
        pending.roles[emoji] = {
            roleId: role.id,
            description
        };

        await interaction.reply({
            content: `Added ${emoji} → ${role} to the reaction role message.`,
            ephemeral: true
        });
    },

    async finishReactionRoles(interaction) {
        // Get channel's pending message
        const pending = this.pendingMessages[interaction.channelId];
        if (!pending) {
            return await interaction.reply({
                content: "No reaction role message in progress. Use `/reactionroles create` first.",
                ephemeral: true
            });
        }

        // Check if there are any roles
        if (Object.keys(pending.roles).length === 0) {
            return await interaction.reply({
                content: "No roles were added to this message!",
                ephemeral: true
            });
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(pending.title)
            .setDescription("React to get roles!\n\n")
            .setColor(pending.color);

        // Add role explanations
        const roleLines = [];
        for (const [emoji, { roleId, description }] of Object.entries(pending.roles)) {
            const role = interaction.guild.roles.cache.get(roleId);
            if (role) {
                let line = `${emoji} - ${role}`;
                if (description) {
                    line += `: ${description}`;
                }
                roleLines.push(line);
            }
        }

        embed.setDescription(embed.data.description + roleLines.join('\n'));

        // Send message
        let message;
        try {
            message = await interaction.channel.send({ embeds: [embed] });
        } catch (error) {
            return await interaction.reply({
                content: "Failed to send the reaction role message. Check my permissions.",
                ephemeral: true
            });
        }

        // Add reactions
        for (const emoji of Object.keys(pending.roles)) {
            try {
                await message.react(emoji);
            } catch (error) {
                await interaction.followUp({
                    content: `Couldn't add reaction ${emoji}. It may be invalid or I don't have access.`,
                    ephemeral: true
                });
            }
        }

        // Save to database
        for (const [emoji, { roleId, description }] of Object.entries(pending.roles)) {
            await reactionRolesModel.addReactionRole(
                message.id,
                interaction.channelId,
                interaction.guildId,
                pending.title,
                pending.color,
                emoji,
                roleId,
                description
            );
        }

        // Clean up
        if (this.editingMessages[interaction.channelId]) {
            delete this.editingMessages[interaction.channelId];
        }
        delete this.pendingMessages[interaction.channelId];

        await interaction.reply({
            content: "Reaction role message posted!",
            ephemeral: true
        });
    },

    async editReactionRoles(interaction) {
        // Get options
        const messageIdStr = interaction.options.getString('message_id');
        
        // Parse message ID
        let messageId;
        try {
            messageId = BigInt(messageIdStr);
        } catch (error) {
            return await interaction.reply({
                content: "Invalid message ID format.",
                ephemeral: true
            });
        }

        // Check if message exists in our system
        const messageInfo = await reactionRolesModel.getMessageInfo(messageId);
        if (!messageInfo) {
            return await interaction.reply({
                content: "No reaction role message found with that ID.",
                ephemeral: true
            });
        }

        const [channelId, guildId, title, color] = messageInfo;
        
        // Verify it's in this guild
        if (guildId !== interaction.guildId) {
            return await interaction.reply({
                content: "That message is not from this server.",
                ephemeral: true
            });
        }

        // Verify it's in this channel
        if (channelId !== interaction.channelId) {
            return await interaction.reply({
                content: "Please use this command in the same channel as the message.",
                ephemeral: true
            });
        }

        // Load existing roles
        const existingRoles = await reactionRolesModel.getReactionRoles(messageId);
        const roles = {};
        
        for (const [emoji, roleId, description] of existingRoles) {
            roles[emoji] = {
                roleId,
                description
            };
        }

        // Start editing session
        this.editingMessages[interaction.channelId] = messageId;
        this.pendingMessages[interaction.channelId] = {
            title,
            color,
            roles
        };

        await interaction.reply({
            content: `Now editing reaction role message: **${title}**\n` +
                     "Use `/reactionroles add` to add more roles to this message.\n" +
                     "Use `/reactionroles finish` to save changes.",
            ephemeral: true
        });
    },

    async removeReactionRole(interaction) {
        // Get options
        const messageIdStr = interaction.options.getString('message_id');
        const emoji = interaction.options.getString('emoji');
        
        // Parse message ID
        let messageId;
        try {
            messageId = BigInt(messageIdStr);
        } catch (error) {
            return await interaction.reply({
                content: "Invalid message ID format.",
                ephemeral: true
            });
        }

        // Check if message exists in our system
        const messageInfo = await reactionRolesModel.getMessageInfo(messageId);
        if (!messageInfo) {
            return await interaction.reply({
                content: "No reaction role message found with that ID.",
                ephemeral: true
            });
        }

        const [, guildId] = messageInfo;
        
        // Verify it's in this guild
        if (guildId !== interaction.guildId) {
            return await interaction.reply({
                content: "That message is not from this server.",
                ephemeral: true
            });
        }

        // Remove from database
        await reactionRolesModel.removeReactionRole(messageId, emoji);
        
        // Update the message
        const updatedMessage = await this.updateReactionMessage(messageId, interaction.client);
        if (!updatedMessage) {
            return await interaction.reply({
                content: "Message couldn't be updated. It may have been deleted.",
                ephemeral: true
            });
        }

        await interaction.reply({
            content: `Removed reaction role ${emoji} from message.`,
            ephemeral: true
        });
    }
};