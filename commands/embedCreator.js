const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    Colors
} = require('discord.js');
const embedCreatorModel = require('../models/embedCreatorModel');

module.exports = {
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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // Check permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await interaction.reply({ 
                content: "You don't have permission to use this command!", 
                ephemeral: true 
            });
        }

        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'create':
                await this.createEmbed(interaction);
                break;
            case 'edit':
                await this.editEmbed(interaction);
                break;
            case 'get':
                await this.getEmbedJson(interaction);
                break;
            case 'builder':
                await this.embedBuilder(interaction);
                break;
        }
    },

    /**
     * Parse JSON string into an embed
     * @param {string} jsonStr - JSON string to parse
     * @returns {EmbedBuilder|null} Embed object or null if invalid
     */
    parseEmbedJson(jsonStr) {
        try {
            // Parse JSON string
            const data = JSON.parse(jsonStr);
            
            // Check if the JSON has an 'embed' property or is directly an embed
            const embedData = data.embed || data;
            
            // Create embed from data
            return EmbedBuilder.from(embedData);
        } catch (error) {
            console.error('Error parsing embed JSON:', error);
            return null;
        }
    },

    async createEmbed(interaction) {
        // Get options
        const jsonInput = interaction.options.getString('json_input');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        // Parse embed
        const embed = this.parseEmbedJson(jsonInput);
        if (!embed) {
            return await interaction.reply({ 
                content: "Invalid embed JSON. Please check your input.", 
                ephemeral: true 
            });
        }
        
        try {
            // Send the embed
            const message = await channel.send({ embeds: [embed] });
            
            // Store in database
            await embedCreatorModel.storeEmbed(
                message.id,
                channel.id,
                interaction.guildId,
                jsonInput,
                interaction.user.id
            );
            
            await interaction.reply({ 
                content: `Embed posted in ${channel}! Message ID: \`${message.id}\``, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error creating embed:', error);
            await interaction.reply({ 
                content: "I don't have permission to send messages there, or the JSON is malformed.", 
                ephemeral: true 
            });
        }
    },

    async editEmbed(interaction) {
        // Get options
        const messageId = interaction.options.getString('message_id');
        const newJson = interaction.options.getString('new_json');
        
        try {
            // Try to parse the message ID as a number
            const messageIdInt = parseInt(messageId);
            if (isNaN(messageIdInt)) {
                return await interaction.reply({ 
                    content: "Invalid message ID.", 
                    ephemeral: true 
                });
            }
            
            // Get embed from database
            const record = await embedCreatorModel.getEmbed(messageIdInt);
            if (!record) {
                return await interaction.reply({ 
                    content: "Embed not found in database.", 
                    ephemeral: true 
                });
            }
            
            // Check if user is allowed to edit
            if (interaction.user.id !== record.authorId && 
                !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({ 
                    content: "You can only edit embeds you created unless you're an administrator.", 
                    ephemeral: true 
                });
            }
            
            // Get channel and message
            const channel = await interaction.client.channels.fetch(record.channelId).catch(() => null);
            if (!channel) {
                return await interaction.reply({ 
                    content: "Channel not found.", 
                    ephemeral: true 
                });
            }
            
            const message = await channel.messages.fetch(messageIdInt).catch(() => null);
            if (!message) {
                return await interaction.reply({ 
                    content: "Message not found.", 
                    ephemeral: true 
                });
            }
            
            // Parse new embed
            const embed = this.parseEmbedJson(newJson);
            if (!embed) {
                return await interaction.reply({ 
                    content: "Invalid embed JSON.", 
                    ephemeral: true 
                });
            }
            
            // Edit the message
            await message.edit({ embeds: [embed] });
            
            // Update in database
            await embedCreatorModel.updateEmbed(messageIdInt, newJson);
            
            await interaction.reply({ 
                content: "Embed updated successfully!", 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error editing embed:', error);
            await interaction.reply({ 
                content: "An error occurred while editing the embed.", 
                ephemeral: true 
            });
        }
    },

    async getEmbedJson(interaction) {
        const messageId = interaction.options.getString('message_id');
        
        try {
            // Try to parse the message ID as a number
            const messageIdInt = parseInt(messageId);
            if (isNaN(messageIdInt)) {
                return await interaction.reply({ 
                    content: "Invalid message ID.", 
                    ephemeral: true 
                });
            }
            
            // Try to get from database first
            const data = await embedCreatorModel.getEmbed(messageIdInt);
            if (data) {
                return await interaction.reply({ 
                    content: `\`\`\`json\n${data.embedJson}\n\`\`\``, 
                    ephemeral: true 
                });
            }
            
            // If not in database, try to find in guild channels
            let found = false;
            for (const [, channel] of interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
                try {
                    const message = await channel.messages.fetch(messageIdInt).catch(() => null);
                    if (message && message.embeds && message.embeds.length > 0) {
                        const embedJson = JSON.stringify(message.embeds[0].toJSON(), null, 2);
                        await interaction.reply({ 
                            content: `\`\`\`json\n${embedJson}\n\`\`\``, 
                            ephemeral: true 
                        });
                        found = true;
                        break;
                    }
                } catch (error) {
                    // Continue to next channel
                }
            }
            
            if (!found) {
                await interaction.reply({ 
                    content: "Message not found or no embed.", 
                    ephemeral: true 
                });
            }
        } catch (error) {
            console.error('Error getting embed JSON:', error);
            await interaction.reply({ 
                content: "An error occurred while trying to get the embed JSON.", 
                ephemeral: true 
            });
        }
    },

    async embedBuilder(interaction) {
        // Create a sample embed to start with
        const embed = new EmbedBuilder()
            .setTitle('Sample Title')
            .setDescription('Sample description')
            .setColor(Colors.Blue);
        
        // Create the builder buttons
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('description')
                    .setLabel('Description')
                    .setStyle(ButtonStyle.Primary)
            );
            
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('add_field')
                    .setLabel('Add Field')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('footer')
                    .setLabel('Footer')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('thumbnail')
                    .setLabel('Thumbnail')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('image')
                    .setLabel('Image')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('color')
                    .setLabel('Color')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        const row4 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('export_json')
                    .setLabel('Export JSON')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('send')
                    .setLabel('Send')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );
        
        // Send the initial message with builder UI
        const response = await interaction.reply({
            content: 'Interactive embed builder started! Edit your embed using the buttons below:',
            embeds: [embed],
            components: [row1, row2, row3, row4],
            ephemeral: true,
            fetchReply: true
        });
        
        // Create collector for button interactions
        const collector = response.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 600000 // 10 minutes
        });
        
        // Helper functions for modals
        const createModal = (title, label, value = '', maxLength = 2048) => {
            const modal = new ModalBuilder()
                .setCustomId(`${title.toLowerCase().replace(/\s+/g, '_')}`)
                .setTitle(title);
                
            const input = new TextInputBuilder()
                .setCustomId('input')
                .setLabel(label)
                .setStyle(TextInputStyle.Paragraph)
                .setValue(value)
                .setMaxLength(maxLength)
                .setRequired(false);
                
            const row = new ActionRowBuilder().addComponents(input);
            modal.addComponents(row);
            
            return modal;
        };
        
        const createFieldModal = () => {
            const modal = new ModalBuilder()
                .setCustomId('field_modal')
                .setTitle('Add Embed Field');
                
            const nameInput = new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Field Name')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(256)
                .setRequired(true);
                
            const valueInput = new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Field Value')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1024)
                .setRequired(true);
                
            const inlineInput = new TextInputBuilder()
                .setCustomId('inline')
                .setLabel('Inline? true/false')
                .setStyle(TextInputStyle.Short)
                .setValue('true')
                .setMaxLength(5)
                .setRequired(true);
                
            const row1 = new ActionRowBuilder().addComponents(nameInput);
            const row2 = new ActionRowBuilder().addComponents(valueInput);
            const row3 = new ActionRowBuilder().addComponents(inlineInput);
            
            modal.addComponents(row1, row2, row3);
            
            return modal;
        };
        
        // Handle button interactions
        collector.on('collect', async (i) => {
            const id = i.customId;
            
            switch (id) {
                case 'title': {
                    const modal = createModal('Edit Title', 'Title', embed.data.title || '');
                    await i.showModal(modal);
                    
                    const submitted = await i.awaitModalSubmit({
                        filter: (i) => i.customId === 'edit_title',
                        time: 60000
                    }).catch(() => null);
                    
                    if (submitted) {
                        const title = submitted.fields.getTextInputValue('input');
                        embed.setTitle(title);
                        await submitted.deferUpdate();
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'description': {
                    const modal = createModal('Edit Description', 'Description', embed.data.description || '');
                    await i.showModal(modal);
                    
                    const submitted = await i.awaitModalSubmit({
                        filter: (i) => i.customId === 'edit_description',
                        time: 60000
                    }).catch(() => null);
                    
                    if (submitted) {
                        const description = submitted.fields.getTextInputValue('input');
                        embed.setDescription(description);
                        await submitted.deferUpdate();
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'add_field': {
                    const modal = createFieldModal();
                    await i.showModal(modal);
                    
                    const submitted = await i.awaitModalSubmit({
                        filter: (i) => i.customId === 'field_modal',
                        time: 60000
                    }).catch(() => null);
                    
                    if (submitted) {
                        const name = submitted.fields.getTextInputValue('name');
                        const value = submitted.fields.getTextInputValue('value');
                        const inline = submitted.fields.getTextInputValue('inline').toLowerCase() === 'true';
                        
                        embed.addFields({ name, value, inline });
                        await submitted.deferUpdate();
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'footer': {
                    const currentFooter = embed.data.footer ? embed.data.footer.text : '';
                    const modal = createModal('Edit Footer', 'Footer text', currentFooter);
                    await i.showModal(modal);
                    
                    const submitted = await i.awaitModalSubmit({
                        filter: (i) => i.customId === 'edit_footer',
                        time: 60000
                    }).catch(() => null);
                    
                    if (submitted) {
                        const footerText = submitted.fields.getTextInputValue('input');
                        embed.setFooter({ text: footerText });
                        await submitted.deferUpdate();
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'thumbnail': {
                    const currentUrl = embed.data.thumbnail ? embed.data.thumbnail.url : '';
                    const modal = createModal('Set Thumbnail URL', 'Image URL', currentUrl);
                    await i.showModal(modal);
                    
                    const submitted = await i.awaitModalSubmit({
                        filter: (i) => i.customId === 'set_thumbnail_url',
                        time: 60000
                    }).catch(() => null);
                    
                    if (submitted) {
                        const url = submitted.fields.getTextInputValue('input');
                        if (url) {
                            embed.setThumbnail(url);
                        } else {
                            delete embed.data.thumbnail;
                        }
                        await submitted.deferUpdate();
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'image': {
                    const currentUrl = embed.data.image ? embed.data.image.url : '';
                    const modal = createModal('Set Image URL', 'Image URL', currentUrl);
                    await i.showModal(modal);
                    
                    const submitted = await i.awaitModalSubmit({
                        filter: (i) => i.customId === 'set_image_url',
                        time: 60000
                    }).catch(() => null);
                    
                    if (submitted) {
                        const url = submitted.fields.getTextInputValue('input');
                        if (url) {
                            embed.setImage(url);
                        } else {
                            delete embed.data.image;
                        }
                        await submitted.deferUpdate();
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'color': {
                    const currentColor = embed.data.color ? `#${embed.data.color.toString(16).padStart(6, '0')}` : '#3498db';
                    const modal = createModal('Set Embed Color (#hex)', 'Hex color', currentColor);
                    await i.showModal(modal);
                    
                    const submitted = await i.awaitModalSubmit({
                        filter: (i) => i.customId === 'set_embed_color_(#hex)',
                        time: 60000
                    }).catch(() => null);
                    
                    if (submitted) {
                        const color = submitted.fields.getTextInputValue('input');
                        try {
                            embed.setColor(color.startsWith('#') ? color : `#${color}`);
                        } catch (error) {
                            console.error('Invalid color:', error);
                        }
                        await submitted.deferUpdate();
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'export_json': {
                    const jsonStr = JSON.stringify(embed.toJSON(), null, 2);
                    await i.reply({
                        content: `\`\`\`json\n${jsonStr.length > 1900 ? 'Embed JSON too large to display' : jsonStr}\n\`\`\``,
                        ephemeral: true
                    });
                    break;
                }
                case 'send': {
                    // Create a selection menu with available channels
                    const channels = interaction.guild.channels.cache
                        .filter(c => c.type === ChannelType.GuildText && c.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages))
                        .map(c => ({
                            label: c.name,
                            value: c.id
                        }))
                        .slice(0, 25); // Discord limits selection menus to 25 options
                    
                    if (channels.length === 0) {
                        await i.reply({
                            content: "I don't have permission to send messages in any text channels.",
                            ephemeral: true
                        });
                        break;
                    }
                    
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('channel_select')
                                .setPlaceholder('Select a channel')
                                .addOptions(channels)
                        );
                    
                    const selectMsg = await i.reply({
                        content: 'Select the channel to post the embed in:',
                        components: [row],
                        ephemeral: true,
                        fetchReply: true
                    });
                    
                    const selectionCollector = selectMsg.createMessageComponentCollector({
                        filter: (i) => i.user.id === interaction.user.id && i.customId === 'channel_select',
                        time: 60000,
                        max: 1
                    });
                    
                    selectionCollector.on('collect', async (selection) => {
                        const channelId = selection.values[0];
                        const channel = interaction.guild.channels.cache.get(channelId);
                        
                        try {
                            const message = await channel.send({ embeds: [embed] });
                            const embedJson = JSON.stringify(embed.toJSON());
                            
                            // Save to database
                            await embedCreatorModel.storeEmbed(
                                message.id,
                                channel.id,
                                interaction.guild.id,
                                embedJson,
                                interaction.user.id
                            );
                            
                            await selection.update({
                                content: `Embed sent to ${channel}!`,
                                components: []
                            });
                            
                            // Update the original message
                            await interaction.editReply({
                                content: 'Embed finalized.',
                                embeds: [],
                                components: []
                            });
                            
                            // Stop the collector
                            collector.stop();
                        } catch (error) {
                            console.error('Error sending embed:', error);
                            await selection.update({
                                content: `Failed to send embed to ${channel}.`,
                                components: []
                            });
                        }
                    });
                    
                    break;
                }
                case 'cancel': {
                    await i.update({
                        content: 'Embed creation canceled.',
                        embeds: [],
                        components: []
                    });
                    collector.stop();
                    break;
                }
            }
        });
        
        // When the collector ends, clean up if needed
        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    content: 'Embed builder timed out.',
                    embeds: [],
                    components: []
                }).catch(() => {});
            }
        });
    }
};