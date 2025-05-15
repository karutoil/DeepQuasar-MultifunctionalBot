const { Events } = require('discord.js');
const reactionRolesModel = require('../models/reactionRolesModel');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {
        // Check if the interaction is a button
        if (!interaction.isButton()) return;

        // Extract role ID from the button's custom ID
        const customId = interaction.customId;
        if (!customId.startsWith('role_')) return;

        const roleId = customId.split('_')[1];

        // Get the guild and member
        const guild = interaction.guild;
        const member = interaction.member;

        if (!guild || !member) return;

        // Fetch the role
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
            return await interaction.reply({
                content: "The role associated with this button no longer exists.",
                flags: 64
            });
        }

        // Check if the member already has the role
        if (member.roles.cache.has(roleId)) {
            // Remove the role
            try {
                await member.roles.remove(role, 'Button role removed');
                await interaction.reply({
                    content: `Removed the role **${role.name}** from you.`,
                    flags: 64
                });
            } catch (error) {
                console.error(`Failed to remove role: ${error}`);
                await interaction.reply({
                    content: "Failed to remove the role. Please try again later.",
                    flags: 64
                });
            }
        } else {
            // Add the role
            try {
                await member.roles.add(role, 'Button role added');
                await interaction.reply({
                    content: `Assigned the role **${role.name}** to you.`,
                    flags: 64
                });
            } catch (error) {
                console.error(`Failed to assign role: ${error}`);
                await interaction.reply({
                    content: "Failed to assign the role. Please try again later.",
                    flags: 64
                });
            }
        }
    }
};