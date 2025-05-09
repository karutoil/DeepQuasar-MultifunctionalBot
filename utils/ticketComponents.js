const { 
    ActionRowBuilder,
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const ticketModel = require('../models/ticketModel');

/**
 * Class representing the ticket panel view with "Open Ticket" button
 */
class TicketPanelView {
    constructor() {
        this.components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket_button')
                    .setLabel('Open Ticket')
                    .setStyle(ButtonStyle.Success)
            )
        ];
    }

    /**
     * Handle the interaction when the "Open Ticket" button is clicked
     * @param {Interaction} interaction - The Discord interaction
     */
    static async handleOpenTicket(interaction) {
        // Create and show a modal for the user to describe their issue
        const modal = new ModalBuilder()
            .setCustomId('ticket_issue_modal')
            .setTitle('Open Support Ticket');

        const descriptionInput = new TextInputBuilder()
            .setCustomId('ticket_description')
            .setLabel('Describe your issue/request')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000)
            .setPlaceholder('Please provide details so staff can help you better.');

        modal.addComponents(
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
    }

    /**
     * Handle the modal submission with ticket description
     * @param {Interaction} interaction - The Discord interaction
     */
    static async handleTicketModal(interaction) {
        const description = interaction.fields.getTextInputValue('ticket_description');
        const ticketsCommand = require('../commands/tickets');
        
        await ticketsCommand.createTicketFromModal(
            interaction.client,
            interaction,
            description
        );
    }
}

/**
 * Class representing the ticket control view with Claim, Close, and Delete buttons
 */
class TicketControlView {
    constructor() {
        this.components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_claim')
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_delete')
                    .setLabel('Delete')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
    }

    /**
     * Handle the "Claim" button interaction
     * @param {Interaction} interaction - The Discord interaction
     */
    static async handleClaimTicket(interaction) {
        // Get ticket data from the database
        const ticket = await ticketModel.getTicket(interaction.channelId);
        if (!ticket) {
            return await interaction.reply({
                content: 'This channel is not a ticket.',
                ephemeral: true
            });
        }

        // Get guild settings
        const settings = await ticketModel.getGuildSettings(interaction.guildId);
        if (!settings) {
            return await interaction.reply({
                content: 'Ticket system is not properly configured.',
                ephemeral: true
            });
        }

        // Check if user has support role
        const hasSupport = interaction.member.roles.cache.some(
            role => settings.supportRoles.includes(role.id)
        );

        if (!hasSupport) {
            return await interaction.reply({
                content: 'You do not have permission to claim tickets.',
                ephemeral: true
            });
        }

        // Update ticket with claimer
        await ticketModel.updateTicket(interaction.channelId, {
            claimedBy: interaction.user.id
        });

        await interaction.reply({
            content: `Ticket claimed by ${interaction.user}.`,
            ephemeral: false
        });

        // Log claim action
        const ticketsCommand = require('../commands/tickets');
        await ticketsCommand.sendLog(
            interaction.client,
            interaction.guildId,
            `📝 Ticket ${interaction.channel} claimed by ${interaction.user}`,
            {
                color: 0x3498DB, // Blue
                author: {
                    name: `Ticket Claimed | ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                },
                fields: [
                    { name: 'Ticket', value: `${interaction.channel.name}`, inline: true },
                    { name: 'Claimed By', value: `${interaction.user}`, inline: true },
                ]
            }
        );
    }

    /**
     * Handle the "Close" button interaction
     * @param {Interaction} interaction - The Discord interaction
     */
    static async handleCloseTicket(interaction) {
        // Get ticket data from the database
        const ticket = await ticketModel.getTicket(interaction.channelId);
        if (!ticket) {
            return await interaction.reply({
                content: 'This channel is not a ticket.',
                ephemeral: true
            });
        }

        // Get guild settings
        const settings = await ticketModel.getGuildSettings(interaction.guildId);
        if (!settings || !settings.categoryArchive) {
            return await interaction.reply({
                content: 'Ticket system is not properly configured.',
                ephemeral: true
            });
        }

        // Get the archive category
        const archiveCategory = interaction.guild.channels.cache.get(settings.categoryArchive);
        if (!archiveCategory) {
            return await interaction.reply({
                content: 'Archive category not found. Please contact an administrator.',
                ephemeral: true
            });
        }

        // Move ticket to archive category
        await interaction.channel.setParent(archiveCategory.id, {
            reason: `Ticket closed by ${interaction.user.tag}`
        });

        // Update ticket status
        await ticketModel.updateTicket(interaction.channelId, {
            status: 'closed'
        });

        await interaction.reply({
            content: 'Ticket closed and moved to archive.',
            ephemeral: false
        });

        // Log ticket close action
        const ticketsCommand = require('../commands/tickets');
        await ticketsCommand.sendLog(
            interaction.client,
            interaction.guildId,
            `📁 Ticket ${interaction.channel} closed by ${interaction.user}`,
            {
                color: 0xF1C40F, // Yellow/Gold
                author: {
                    name: `Ticket Closed | ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                },
                fields: [
                    { name: 'Ticket', value: `${interaction.channel.name}`, inline: true },
                    { name: 'Closed By', value: `${interaction.user}`, inline: true },
                    { name: 'Status', value: 'Archived', inline: true }
                ]
            }
        );
    }

    /**
     * Handle the "Delete" button interaction
     * @param {Interaction} interaction - The Discord interaction
     */
    static async handleDeleteTicket(interaction) {
        // Get ticket data from the database
        const ticket = await ticketModel.getTicket(interaction.channelId);
        if (!ticket) {
            return await interaction.reply({
                content: 'This channel is not a ticket.',
                ephemeral: true
            });
        }

        // Get guild settings
        const settings = await ticketModel.getGuildSettings(interaction.guildId);
        if (!settings) {
            return await interaction.reply({
                content: 'Ticket system is not properly configured.',
                ephemeral: true
            });
        }

        // Check if user has permission to delete
        const hasSupport = interaction.member.roles.cache.some(
            role => settings.supportRoles.includes(role.id)
        );

        const isClaimedByUser = ticket.claimedBy === interaction.user.id;
        
        if (!hasSupport && !isClaimedByUser) {
            return await interaction.reply({
                content: 'You do not have permission to delete this ticket.',
                ephemeral: true
            });
        }

        // Log delete action before deleting the channel
        const ticketsCommand = require('../commands/tickets');
        await ticketsCommand.sendLog(
            interaction.client,
            interaction.guildId,
            `❌ Ticket ${interaction.channel.name} deleted by ${interaction.user}`,
            {
                color: 0xE74C3C, // Red
                author: {
                    name: `Ticket Deleted | ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                },
                fields: [
                    { name: 'Ticket', value: `${interaction.channel.name}`, inline: true },
                    { name: 'Deleted By', value: `${interaction.user}`, inline: true },
                    { name: 'Ticket Creator', value: `<@${ticket.creatorId}>`, inline: true }
                ]
            }
        );

        // Delete ticket from database
        await ticketModel.deleteTicket(interaction.channelId);

        // Notify before deletion
        await interaction.reply({
            content: 'This ticket will be deleted in 5 seconds...',
            ephemeral: false
        });

        // Delete the channel after a short delay
        setTimeout(async () => {
            try {
                await interaction.channel.delete(`Deleted by ${interaction.user.tag}`);
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
    }
}

module.exports = { TicketPanelView, TicketControlView };