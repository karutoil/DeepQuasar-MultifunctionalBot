const { SlashCommandBuilder } = require('discord.js');
const { parse } = require('date-fns');
const { zonedTimeToUtc } = require('date-fns-tz');
const ReminderModel = require('../models/reminderModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a reminder')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('The time or date for the reminder (e.g., 1h, 5/13/2025 @ 1PM EST, 8pm CST)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message for the reminder')
                .setRequired(true)
        ),

    async execute(interaction) {
        const dateInput = interaction.options.getString('date');
        const message = interaction.options.getString('message');
        const channel = interaction.channel;

        try {
            // Parse the date input
            const reminderTime = parseDateInput(dateInput);

            if (!reminderTime) {
                return interaction.reply({
                    content: 'Invalid date or time format. Please try again.',
                    flags: 64
                });
            }

            const now = new Date();
            if (reminderTime <= now) {
                return interaction.reply({
                    content: 'The specified time is in the past. Please provide a future time.',
                    flags: 64
                });
            }

            // Save the reminder to the database
            const reminder = {
                userId: interaction.user.id,
                channelId: channel.id,
                guildId: interaction.guild.id,
                message,
                remindAt: reminderTime,
                createdAt: new Date()
            };

            const savedReminder = await ReminderModel.create(reminder);

            // Schedule the reminder
            const delay = reminderTime - now;
            setTimeout(async () => {
                try {
                    await channel.send(`⏰ Reminder for <@${interaction.user.id}>: ${message}`);
                    await ReminderModel.deleteById(savedReminder.insertedId); // Remove the reminder after sending
                } catch (error) {
                    console.error('Error sending reminder:', error);
                }
            }, delay);

            await interaction.reply({
                content: `Reminder set for ${reminderTime.toLocaleString()}: ${message}`,
                flags: 64
            });
        } catch (error) {
            console.error('Error setting reminder:', error);
            interaction.reply({
                content: 'There was an error setting your reminder. Please try again.',
                flags: 64
            });
        }
    }
};

function parseDateInput(input) {
    const now = new Date();

    // Check for relative time (e.g., 1h, 30m)
    const relativeMatch = input.match(/^\s*(\d+)([hms])\s*$/i);
    if (relativeMatch) {
        const value = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();

        switch (unit) {
            case 'h':
                return new Date(now.getTime() + value * 60 * 60 * 1000);
            case 'm':
                return new Date(now.getTime() + value * 60 * 1000);
            case 's':
                return new Date(now.getTime() + value * 1000);
        }
    }

    // Check for specific date and time (e.g., 5/13/2025 @ 1PM EST)
    const specificMatch = input.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*@\s*(\d{1,2}:\d{2}\s*(AM|PM))\s*(\w+)?\s*$/i);
    if (specificMatch) {
        const datePart = specificMatch[1].trim();
        const timePart = specificMatch[2].trim();
        const timezone = specificMatch[4]?.toUpperCase() || 'UTC';

        const dateString = `${datePart} ${timePart}`;
        const parsedDate = new Date(`${dateString} ${timezone}`);

        if (!isNaN(parsedDate)) {
            return parsedDate;
        }
    }

    // Check for time only (e.g., 8pm CST)
    const timeOnlyMatch = input.match(/^\s*(\d{1,2}:\d{2}\s*(AM|PM))\s*(\w+)?\s*$/i);
    if (timeOnlyMatch) {
        const timePart = timeOnlyMatch[1].trim();
        const timezone = timeOnlyMatch[3]?.toUpperCase() || 'UTC';

        const dateString = `${now.toLocaleDateString()} ${timePart}`;
        const parsedDate = new Date(`${dateString} ${timezone}`);

        if (!isNaN(parsedDate)) {
            return parsedDate;
        }
    }

    return null;
}
