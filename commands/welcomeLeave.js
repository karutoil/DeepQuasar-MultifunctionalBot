const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType
} = require('discord.js');
const welcomeLeaveModel = require('../models/welcomeLeaveModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Welcome and leave message settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setwelcome')
                .setDescription('Set the welcome message channel')
                .addChannelOption(option => 
                    option.setName('channel')
                          .setDescription('The channel to send welcome messages')
                          .addChannelTypes(ChannelType.GuildText)
                          .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setleave')
                .setDescription('Set the leave message channel')
                .addChannelOption(option => 
                    option.setName('channel')
                          .setDescription('The channel to send leave messages')
                          .addChannelTypes(ChannelType.GuildText)
                          .setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'setwelcome':
                await this.setWelcomeChannel(interaction);
                break;
            case 'setleave':
                await this.setLeaveChannel(interaction);
                break;
        }
    },

    async setWelcomeChannel(interaction) {
        const channel = interaction.options.getChannel('channel');
        
        // Verify the bot has permission to send messages in the channel
        if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
            return await interaction.reply({ 
                content: `I don't have permission to send messages in ${channel}!`, 
                ephemeral: true 
            });
        }
        
        // Save to database
        await welcomeLeaveModel.setWelcomeChannel(interaction.guild.id, channel.id);
        
        await interaction.reply({ 
            content: `Welcome channel set to ${channel}`, 
            ephemeral: true 
        });
    },

    async setLeaveChannel(interaction) {
        const channel = interaction.options.getChannel('channel');
        
        // Verify the bot has permission to send messages in the channel
        if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
            return await interaction.reply({ 
                content: `I don't have permission to send messages in ${channel}!`, 
                ephemeral: true 
            });
        }
        
        // Save to database
        await welcomeLeaveModel.setLeaveChannel(interaction.guild.id, channel.id);
        
        await interaction.reply({ 
            content: `Leave channel set to ${channel}`, 
            ephemeral: true 
        });
    }
};