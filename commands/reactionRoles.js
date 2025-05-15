const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle
} = require('discord.js');
const reactionRolesModel = require('../models/reactionRolesModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionroles')
        .setDescription('Manage button-based role messages')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Start creating a button-based role message')
                .addStringOption(option => 
                    option.setName('title')
                          .setDescription('The title for the role message')
                          .setRequired(true))
                .addStringOption(option => 
                    option.setName('color')
                          .setDescription('The embed color in hex (e.g. #FF0000)')
                          .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a role to the current role message')
                .addStringOption(option => 
                    option.setName('label')
                          .setDescription('The label for the button')
                          .setRequired(true))
                .addStringOption(option => 
                    option.setName('color')
                          .setDescription('The button color (primary, secondary, success, danger)')
                          .setRequired(true))
                .addRoleOption(option => 
                    option.setName('role')
                          .setDescription('The role to assign')
                          .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('finish')
                .setDescription('Post the button-based role message')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    pendingMessages: {},

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'create':
                await this.createRoleMessage(interaction);
                break;
            case 'add':
                await this.addRoleButton(interaction);
                break;
            case 'finish':
                await this.finishRoleMessage(interaction);
                break;
        }
    },

    async createRoleMessage(interaction) {
        const title = interaction.options.getString('title');
        let colorStr = interaction.options.getString('color') || '#3498db';
        
        let color;
        try {
            color = parseInt(colorStr.replace('#', ''), 16);
        } catch (error) {
            color = 0x3498db;
        }

        this.pendingMessages[interaction.channelId] = {
            title,
            color,
            buttons: []
        };

        await interaction.reply({
            content: `Now creating a button-based role message: **${title}**\nUse \\\`/reactionroles add\\\` to add buttons to this message.`,
            ephemeral: true
        });
    },

    async addRoleButton(interaction) {
        const pending = this.pendingMessages[interaction.channelId];
        if (!pending) {
            return await interaction.reply({
                content: "No role message in progress. Use `/reactionroles create` first.",
                ephemeral: true
            });
        }

        const label = interaction.options.getString('label');
        const color = interaction.options.getString('color');
        const role = interaction.options.getRole('role');

        const validColors = {
            primary: ButtonStyle.Primary,
            secondary: ButtonStyle.Secondary,
            success: ButtonStyle.Success,
            danger: ButtonStyle.Danger
        };

        const buttonStyle = validColors[color.toLowerCase()];
        if (!buttonStyle) {
            return await interaction.reply({
                content: `Invalid button color: ${color}. Use one of: primary, secondary, success, danger.`,
                ephemeral: true
            });
        }

        pending.buttons.push({
            label,
            color,
            roleId: role.id
        });

        await interaction.reply({
            content: `Added button **${label}** → ${role} to the role message.`,
            ephemeral: true
        });
    },

    async finishRoleMessage(interaction) {
        const pending = this.pendingMessages[interaction.channelId];
        if (!pending) {
            return await interaction.reply({
                content: "No role message in progress. Use `/reactionroles create` first.",
                ephemeral: true
            });
        }

        if (pending.buttons.length === 0) {
            return await interaction.reply({
                content: "No buttons were added to this message!",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(pending.title)
            .setDescription("Click a button to get a role!")
            .setColor(pending.color);

        const actionRow = new ActionRowBuilder();
        for (const { label, color, roleId } of pending.buttons) {
            const validColors = {
                primary: ButtonStyle.Primary,
                secondary: ButtonStyle.Secondary,
                success: ButtonStyle.Success,
                danger: ButtonStyle.Danger
            };

            const buttonStyle = validColors[color.toLowerCase()];
            if (!buttonStyle) {
                continue;
            }

            const button = new ButtonBuilder()
                .setLabel(label)
                .setStyle(buttonStyle)
                .setCustomId(`role_${roleId}`);
            actionRow.addComponents(button);
        }

        let message;
        try {
            message = await interaction.channel.send({
                embeds: [embed],
                components: [actionRow]
            });
        } catch (error) {
            return await interaction.reply({
                content: "Failed to send the role message. Check my permissions.",
                ephemeral: true
            });
        }

        for (const { label, color, roleId } of pending.buttons) {
            await reactionRolesModel.addRoleButton(
                message.id,
                interaction.channelId,
                interaction.guildId,
                pending.title,
                pending.color,
                label,
                color,
                roleId
            );
        }

        delete this.pendingMessages[interaction.channelId];

        await interaction.reply({
            content: "Button-based role message posted!",
            ephemeral: true
        });
    }
};