// Main embed module index file
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

// Import the component modules
const create = require('./create');
const edit = require('./edit');
const get = require('./get');
const builder = require('./builder');
const template = require('./template');

// Export the main module
module.exports = {
    // Command definition - matches the original embedCreator.js
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Embed management commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create an embed from JSON')
                .addStringOption(option => 
                    option.setName('json_input')
                          .setDescription('Embed JSON (use https://embed.discord.website/ to create)')
                          .setRequired(true))
                .addChannelOption(option => 
                    option.setName('channel')
                          .setDescription('Channel to post in (defaults to current)')
                          .addChannelTypes(ChannelType.GuildText)
                          .setRequired(false))
                .addStringOption(option => 
                    option.setName('content')
                          .setDescription('Text content to display with the embed (mentions, etc)')
                          .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing embed by message ID')
                .addStringOption(option => 
                    option.setName('message_id')
                          .setDescription('ID of the message to edit')
                          .setRequired(true))
                .addStringOption(option => 
                    option.setName('new_json')
                          .setDescription('New embed JSON')
                          .setRequired(true))
                .addStringOption(option => 
                    option.setName('content')
                          .setDescription('New message content (leave empty to keep current)')
                          .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('Get the JSON of an existing embed')
                .addStringOption(option => 
                    option.setName('message_id')
                          .setDescription('ID of the message to get JSON from')
                          .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('builder')
                .setDescription('Interactively build an embed with buttons')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('template-save')
                .setDescription('Save an embed as a template')
                .addStringOption(option => 
                    option.setName('message_id')
                          .setDescription('ID of the message with the embed to save')
                          .setRequired(true))
                .addStringOption(option => 
                    option.setName('template_name')
                          .setDescription('Name for the template')
                          .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('template-list')
                .setDescription('List all available embed templates')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('template-load')
                .setDescription('Load an embed template')
                .addStringOption(option => 
                    option.setName('template_name')
                          .setDescription('Name of the template to load')
                          .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('template-delete')
                .setDescription('Delete an embed template')
                .addStringOption(option => 
                    option.setName('template_name')
                          .setDescription('Name of the template to delete')
                          .setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // Main execute function that routes to the appropriate handler
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'create':
                await create.createEmbed(interaction);
                break;
            case 'edit':
                await edit.editEmbed(interaction);
                break;
            case 'get':
                await get.getEmbedJson(interaction);
                break;
            case 'builder':
                await builder.embedBuilder(interaction);
                break;
            case 'template-save':
                await template.saveTemplate(interaction);
                break;
            case 'template-list':
                await template.listTemplates(interaction);
                break;
            case 'template-load':
                // Pass the builder module for template editing
                await template.loadTemplate(interaction, builder);
                break;
            case 'template-delete':
                await template.deleteTemplate(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown subcommand',
                    flags: 64
                });
        }
    }
};