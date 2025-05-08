const mongoose = require('mongoose');

// Define schema for ticket system configuration per guild
const ticketSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    categoryOpen: { type: String, required: true },
    categoryArchive: { type: String, required: true },
    supportRoles: [{ type: String }],
    logChannel: { type: String }
});

// Define schema for individual tickets
const ticketSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    creatorId: { type: String, required: true },
    claimedBy: { type: String, default: null },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    participants: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

// Create models
const TicketSettings = mongoose.model('TicketSettings', ticketSettingsSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);

// Functions to interact with the database
module.exports = {
    // Guild settings functions
    async getGuildSettings(guildId) {
        return await TicketSettings.findOne({ guildId });
    },

    async setGuildSettings(guildId, categoryOpen, categoryArchive, supportRoles, logChannel) {
        return await TicketSettings.findOneAndUpdate(
            { guildId },
            { 
                guildId, 
                categoryOpen, 
                categoryArchive, 
                supportRoles, 
                logChannel 
            },
            { upsert: true, new: true }
        );
    },

    // Ticket functions
    async createTicket(channelId, guildId, creatorId, participants) {
        return await Ticket.create({
            channelId,
            guildId,
            creatorId,
            participants
        });
    },

    async getTicket(channelId) {
        return await Ticket.findOne({ channelId });
    },

    async updateTicket(channelId, updateData) {
        return await Ticket.findOneAndUpdate(
            { channelId },
            updateData,
            { new: true }
        );
    },

    async deleteTicket(channelId) {
        return await Ticket.findOneAndDelete({ channelId });
    },

    async getGuildTickets(guildId) {
        return await Ticket.find({ guildId });
    },

    async getOpenTickets(guildId) {
        return await Ticket.find({ guildId, status: 'open' });
    },

    async getClosedTickets(guildId) {
        return await Ticket.find({ guildId, status: 'closed' });
    },

    async getUserTickets(guildId, userId) {
        return await Ticket.find({ 
            guildId, 
            $or: [{ creatorId: userId }, { participants: userId }]
        });
    }
};