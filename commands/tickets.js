const { 
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const ticketModel = require('../models/ticketModel');
const { TicketPanelView, TicketControlView } = require('../utils/ticketComponents');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Manage the ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configure the ticket system')
                .addChannelOption(option =>
                    option.setName('open_category')
                        .setDescription('Category for open tickets')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory))
                .addChannelOption(option =>
                    option.setName('archive_category')
                        .setDescription('Category for closed tickets')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory))
                .addRoleOption(option =>
                    option.setName('support_role')
                        .setDescription('Role for support staff who can manage tickets')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('log_channel')
                        .setDescription('Channel for ticket logs')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Create a ticket panel with an open button')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to post the ticket panel in')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText))
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Title for the ticket panel')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Description for the ticket panel')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to the current ticket')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add to the ticket')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from the current ticket')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove from the ticket')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'setup':
                await this.setupTickets(interaction);
                break;
            case 'panel':
                await this.createPanel(interaction);
                break;
            case 'add':
                await this.addUserToTicket(interaction);
                break;
            case 'remove':
                await this.removeUserFromTicket(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown subcommand.',
                    flags: 64
                });
        }
    },

    async setupTickets(interaction) {
        const openCategory = interaction.options.getChannel('open_category');
        const archiveCategory = interaction.options.getChannel('archive_category');
        const supportRole = interaction.options.getRole('support_role');
        const logChannel = interaction.options.getChannel('log_channel');

        // Save settings to database
        await ticketModel.setGuildSettings(
            interaction.guild.id,
            openCategory.id,
            archiveCategory.id,
            [supportRole.id],
            logChannel.id
        );

        await interaction.reply({
            content: `✅ Ticket system configured:\n- Open tickets category: ${openCategory}\n- Archive category: ${archiveCategory}\n- Support role: ${supportRole}\n- Log channel: ${logChannel}`,
            flags: 64
        });
    },

    async createPanel(interaction) {
        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');

        // Create embed for ticket panel
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(0x2B82CB)
            .setFooter({ 
                text: `${interaction.guild.name} • Support Tickets`, 
                iconURL: interaction.guild.iconURL() 
            })
            .setTimestamp();

        // Create panel with ticket button
        const ticketPanel = new TicketPanelView();

        // Send the panel to the specified channel
        await channel.send({
            embeds: [embed],
            components: ticketPanel.components
        });

        await interaction.reply({
            content: `✅ Ticket panel created in ${channel}`,
            flags: 64
        });
    },

    async createTicketFromModal(client, interaction, description) {
        // Get guild settings
        const settings = await ticketModel.getGuildSettings(interaction.guildId);
        if (!settings) {
            return await interaction.reply({
                content: 'Ticket system is not configured. Please contact an administrator.',
                flags: 64
            });
        }

        // Get the open tickets category
        const category = interaction.guild.channels.cache.get(settings.categoryOpen);
        if (!category) {
            return await interaction.reply({
                content: 'Tickets category not found. Please contact an administrator.',
                flags: 64
            });
        }

        // Check if user already has an open ticket
        const userTickets = await ticketModel.getUserTickets(interaction.guildId, interaction.user.id);
        const openUserTickets = userTickets.filter(t => t.status === 'open');
        
        if (openUserTickets.length > 0) {
            const existingTicket = interaction.guild.channels.cache.get(openUserTickets[0].channelId);
            if (existingTicket) {
                return await interaction.reply({
                    content: `You already have an open ticket: ${existingTicket}`,
                    flags: 64
                });
            }
        }

        // Create a unique ticket name
        const ticketNumber = Math.floor(Math.random() * 10000);
        const ticketName = `ticket-${interaction.user.username}-${ticketNumber}`;

        try {
            // Create ticket channel
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ]
            });

            // Add permissions for support roles
            for (const roleId of settings.supportRoles) {
                await ticketChannel.permissionOverwrites.create(roleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
            }

            // Create ticket in database
            await ticketModel.createTicket(
                ticketChannel.id,
                interaction.guildId,
                interaction.user.id,
                [interaction.user.id]
            );

            // Create welcome message
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('New Support Ticket')
                .setDescription(`
                    Thank you for creating a ticket ${interaction.user}!
                    
                    **Issue Description:**
                    ${description}
                    
                    A support team member will assist you shortly.
                    Please provide any additional information that might help us.
                `)
                .setColor(0x2B82CB)
                .setTimestamp();

            // Add ticket control buttons
            const ticketControls = new TicketControlView();

            // Send welcome message with buttons
            await ticketChannel.send({
                content: `${interaction.user}`,
                embeds: [welcomeEmbed],
                components: ticketControls.components
            });

            // Reply to the original interaction
            await interaction.reply({
                content: `✅ Your ticket has been created: ${ticketChannel}`,
                flags: 64
            });

            // Log ticket creation with enhanced embed
            await this.sendLog(
                client,
                interaction.guildId,
                `🎫 New ticket created by ${interaction.user} in ${ticketChannel}`,
                {
                    color: 0x2ECC71, // Green
                    author: {
                        name: `Ticket Created | ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL()
                    },
                    fields: [
                        { name: 'Ticket', value: ticketChannel.name, inline: true },
                        { name: 'Created By', value: `${interaction.user}`, inline: true },
                        { name: 'Description', value: description.substring(0, 100) + (description.length > 100 ? '...' : ''), inline: false }
                    ]
                }
            );
        } catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.reply({
                content: 'Failed to create ticket. Please try again later.',
                flags: 64
            });
        }
    },

    async addUserToTicket(interaction) {
        // Get ticket data
        const ticket = await ticketModel.getTicket(interaction.channelId);
        if (!ticket) {
            return await interaction.reply({
                content: 'This command can only be used in a ticket channel.',
                flags: 64
            });
        }

        const user = interaction.options.getUser('user');

        // Check if user is already in the ticket
        if (ticket.participants.includes(user.id)) {
            return await interaction.reply({
                content: `${user} is already in this ticket.`,
                flags: 64
            });
        }

        // Add user to channel permissions
        await interaction.channel.permissionOverwrites.create(user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        // Update participants in database
        ticket.participants.push(user.id);
        await ticketModel.updateTicket(interaction.channelId, {
            participants: ticket.participants
        });

        await interaction.reply({
            content: `✅ Added ${user} to the ticket.`,
            flags: 0
        });
    },

    async removeUserFromTicket(interaction) {
        // Get ticket data
        const ticket = await ticketModel.getTicket(interaction.channelId);
        if (!ticket) {
            return await interaction.reply({
                content: 'This command can only be used in a ticket channel.',
                flags: 64
            });
        }

        const user = interaction.options.getUser('user');

        // Check if user is the creator (can't remove ticket creator)
        if (user.id === ticket.creatorId) {
            return await interaction.reply({
                content: `You cannot remove the ticket creator.`,
                flags: 64
            });
        }

        // Check if user is in the ticket
        if (!ticket.participants.includes(user.id)) {
            return await interaction.reply({
                content: `${user} is not in this ticket.`,
                flags: 64
            });
        }

        // Remove user from channel permissions
        await interaction.channel.permissionOverwrites.delete(user.id);

        // Update participants in database
        const updatedParticipants = ticket.participants.filter(id => id !== user.id);
        await ticketModel.updateTicket(interaction.channelId, {
            participants: updatedParticipants
        });

        await interaction.reply({
            content: `✅ Removed ${user} from the ticket.`,
            flags: 0
        });
    },

    async sendLog(client, guildId, message, options = {}) {
        try {
            // Get guild settings
            const settings = await ticketModel.getGuildSettings(guildId);
            if (!settings || !settings.logChannel) return;

            // Get log channel
            const logChannel = client.channels.cache.get(settings.logChannel);
            if (!logChannel) return;

            // Create embed
            const embed = new EmbedBuilder()
                .setDescription(message)
                .setColor(options.color || 0x2B82CB)
                .setTimestamp();
            
            // Add author if provided
            if (options.author) {
                embed.setAuthor({ 
                    name: options.author.name || 'Ticket System',
                    iconURL: options.author.iconURL
                });
            } else {
                embed.setAuthor({ 
                    name: 'Ticket System',
                    iconURL: client.user.displayAvatarURL()
                });
            }
            
            // Add footer if provided or default
            if (options.footer) {
                embed.setFooter({ text: options.footer });
            } else {
                embed.setFooter({ text: `Guild ID: ${guildId}` });
            }
            
            // Add fields if provided
            if (options.fields && Array.isArray(options.fields)) {
                embed.addFields(options.fields);
            }

            // Send log message with embed
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error sending ticket log message:', error);
        }
    }
};