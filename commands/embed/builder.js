// Interactive embed builder
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, Colors, ChannelType, PermissionFlagsBits } = require('discord.js');
const embedCreatorModel = require('../../models/embedCreatorModel');
const { checkPermissions } = require('./utils');

/**
 * Start the embed builder with a default embed
 * @param {Interaction} interaction - The Discord interaction object
 */
async function embedBuilder(interaction) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    // Create a sample embed to start with
    const embed = new EmbedBuilder()
        .setTitle('Sample Title')
        .setDescription('Sample description')
        .setColor(Colors.Blue);
    
    await startEmbedBuilder(interaction, embed);
}

/**
 * Start the embed builder with a provided embed
 * @param {Interaction} interaction - The Discord interaction object 
 * @param {EmbedBuilder} initialEmbed - The initial embed to edit
 */
async function startEmbedBuilder(interaction, initialEmbed) {
    // Create the builder buttons - Main row for most common options
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('url')
                .setLabel('URL')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('author')
                .setLabel('Author')
                .setStyle(ButtonStyle.Primary)
        );
        
    // Row for field management
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('add_field')
                .setLabel('Add Field')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('edit_field')
                .setLabel('Edit Field')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('remove_field')
                .setLabel('Remove Field')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('footer')
                .setLabel('Footer')
                .setStyle(ButtonStyle.Secondary)
        );
        
    // Row for visual elements
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
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('timestamp')
                .setLabel('Timestamp')
                .setStyle(ButtonStyle.Secondary)
        );
        
    // Row for saving, sending, template management
    const row4 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('export_json')
                .setLabel('Export JSON')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('save_template')
                .setLabel('Save Template')
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
        embeds: [initialEmbed],
        components: [row1, row2, row3, row4],
        ephemeral: true,
        fetchReply: true
    });
    
    // Create collector for button interactions
    const collector = response.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 900000 // 15 minutes
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
    
    // Create author modal
    const createAuthorModal = (name = '', url = '', iconUrl = '') => {
        const modal = new ModalBuilder()
            .setCustomId('author_modal')
            .setTitle('Set Embed Author');
            
        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Author Name')
            .setStyle(TextInputStyle.Short)
            .setValue(name)
            .setMaxLength(256)
            .setRequired(true);
            
        const urlInput = new TextInputBuilder()
            .setCustomId('url')
            .setLabel('Author URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(url)
            .setMaxLength(2048)
            .setRequired(false);
            
        const iconUrlInput = new TextInputBuilder()
            .setCustomId('icon_url')
            .setLabel('Author Icon URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(iconUrl)
            .setMaxLength(2048)
            .setRequired(false);
            
        const row1 = new ActionRowBuilder().addComponents(nameInput);
        const row2 = new ActionRowBuilder().addComponents(urlInput);
        const row3 = new ActionRowBuilder().addComponents(iconUrlInput);
        
        modal.addComponents(row1, row2, row3);
        
        return modal;
    };
    
    // Create footer modal with icon option
    const createFooterModal = (text = '', iconUrl = '') => {
        const modal = new ModalBuilder()
            .setCustomId('footer_modal')
            .setTitle('Set Embed Footer');
            
        const textInput = new TextInputBuilder()
            .setCustomId('text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(text)
            .setMaxLength(2048)
            .setRequired(true);
            
        const iconUrlInput = new TextInputBuilder()
            .setCustomId('icon_url')
            .setLabel('Footer Icon URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(iconUrl)
            .setMaxLength(2048)
            .setRequired(false);
            
        const row1 = new ActionRowBuilder().addComponents(textInput);
        const row2 = new ActionRowBuilder().addComponents(iconUrlInput);
        
        modal.addComponents(row1, row2);
        
        return modal;
    };
    
    // Create template save modal
    const createTemplateSaveModal = () => {
        const modal = new ModalBuilder()
            .setCustomId('template_save_modal')
            .setTitle('Save as Template');
            
        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Template Name')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true);
            
        const row = new ActionRowBuilder().addComponents(nameInput);
        modal.addComponents(row);
        
        return modal;
    };
    
    // Handle button interactions
    collector.on('collect', async (i) => {
        const id = i.customId;
        let embed = EmbedBuilder.from(initialEmbed);
        
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
                    initialEmbed.data.title = title;
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
                    initialEmbed.data.description = description;
                    await submitted.deferUpdate();
                    await interaction.editReply({ embeds: [embed] });
                }
                break;
            }
            case 'url': {
                const modal = createModal('Set URL', 'URL (users will be linked to this when clicking the title)', embed.data.url || '');
                await i.showModal(modal);
                
                const submitted = await i.awaitModalSubmit({
                    filter: (i) => i.customId === 'set_url',
                    time: 60000
                }).catch(() => null);
                
                if (submitted) {
                    const url = submitted.fields.getTextInputValue('input');
                    if (url) {
                        embed.setURL(url);
                        initialEmbed.data.url = url;
                    } else if (embed.data.url) {
                        // Remove URL if empty input is provided
                        delete embed.data.url;
                        delete initialEmbed.data.url;
                    }
                    await submitted.deferUpdate();
                    await interaction.editReply({ embeds: [embed] });
                }
                break;
            }
            case 'author': {
                // Get current author values if any
                const currentName = embed.data.author ? embed.data.author.name : '';
                const currentUrl = embed.data.author ? embed.data.author.url || '' : '';
                const currentIconUrl = embed.data.author ? embed.data.author.icon_url || '' : '';
                
                const modal = createAuthorModal(currentName, currentUrl, currentIconUrl);
                await i.showModal(modal);
                
                const submitted = await i.awaitModalSubmit({
                    filter: (i) => i.customId === 'author_modal',
                    time: 60000
                }).catch(() => null);
                
                if (submitted) {
                    const name = submitted.fields.getTextInputValue('name');
                    const url = submitted.fields.getTextInputValue('url');
                    const iconUrl = submitted.fields.getTextInputValue('icon_url');
                    
                    const authorOptions = { name };
                    if (url) authorOptions.url = url;
                    if (iconUrl) authorOptions.iconURL = iconUrl;
                    
                    embed.setAuthor(authorOptions);
                    initialEmbed.data.author = {
                        name,
                        url: url || undefined,
                        icon_url: iconUrl || undefined
                    };
                    
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
                    
                    // Update the initialEmbed fields as well
                    if (!initialEmbed.data.fields) initialEmbed.data.fields = [];
                    initialEmbed.data.fields.push({ name, value, inline });
                    
                    await submitted.deferUpdate();
                    await interaction.editReply({ embeds: [embed] });
                }
                break;
            }
            case 'edit_field': {
                // Only show this option if there are fields to edit
                if (!embed.data.fields || embed.data.fields.length === 0) {
                    await i.reply({
                        content: 'There are no fields to edit.',
                        ephemeral: true
                    });
                    break;
                }
                
                // Create options for field selection
                const fieldOptions = embed.data.fields.map((field, index) => ({
                    label: field.name.length > 25 ? field.name.substring(0, 22) + '...' : field.name,
                    description: field.value.length > 50 ? field.value.substring(0, 47) + '...' : field.value,
                    value: index.toString()
                }));
                
                const selectRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('field_select')
                            .setPlaceholder('Select a field to edit')
                            .addOptions(fieldOptions)
                    );
                
                const selectMessage = await i.reply({
                    content: 'Select a field to edit:',
                    components: [selectRow],
                    ephemeral: true,
                    fetchReply: true
                });
                
                const selection = await selectMessage.awaitMessageComponent({
                    filter: (i) => i.user.id === interaction.user.id && i.customId === 'field_select',
                    time: 60000
                }).catch(() => null);
                
                if (selection) {
                    const index = parseInt(selection.values[0]);
                    const field = embed.data.fields[index];
                    
                    // Create a modal to edit the field
                    const modal = new ModalBuilder()
                        .setCustomId(`edit_field_${index}`)
                        .setTitle('Edit Field');
                    
                    const nameInput = new TextInputBuilder()
                        .setCustomId('name')
                        .setLabel('Field Name')
                        .setStyle(TextInputStyle.Short)
                        .setValue(field.name)
                        .setMaxLength(256)
                        .setRequired(true);
                    
                    const valueInput = new TextInputBuilder()
                        .setCustomId('value')
                        .setLabel('Field Value')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(field.value)
                        .setMaxLength(1024)
                        .setRequired(true);
                    
                    const inlineInput = new TextInputBuilder()
                        .setCustomId('inline')
                        .setLabel('Inline? true/false')
                        .setStyle(TextInputStyle.Short)
                        .setValue(field.inline ? 'true' : 'false')
                        .setMaxLength(5)
                        .setRequired(true);
                    
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(nameInput),
                        new ActionRowBuilder().addComponents(valueInput),
                        new ActionRowBuilder().addComponents(inlineInput)
                    );
                    
                    await selection.showModal(modal);
                    
                    const fieldSubmit = await selection.awaitModalSubmit({
                        filter: (i) => i.customId === `edit_field_${index}`,
                        time: 60000
                    }).catch(() => null);
                    
                    if (fieldSubmit) {
                        const newName = fieldSubmit.fields.getTextInputValue('name');
                        const newValue = fieldSubmit.fields.getTextInputValue('value');
                        const newInline = fieldSubmit.fields.getTextInputValue('inline').toLowerCase() === 'true';
                        
                        // Update field in the embed
                        embed.data.fields[index] = { name: newName, value: newValue, inline: newInline };
                        initialEmbed.data.fields[index] = { name: newName, value: newValue, inline: newInline };
                        
                        await fieldSubmit.deferUpdate();
                        await interaction.editReply({ embeds: [embed] });
                    }
                }
                break;
            }
            case 'remove_field': {
                // Only show this option if there are fields to remove
                if (!embed.data.fields || embed.data.fields.length === 0) {
                    await i.reply({
                        content: 'There are no fields to remove.',
                        ephemeral: true
                    });
                    break;
                }
                
                // Create options for field selection
                const fieldOptions = embed.data.fields.map((field, index) => ({
                    label: field.name.length > 25 ? field.name.substring(0, 22) + '...' : field.name,
                    description: field.value.length > 50 ? field.value.substring(0, 47) + '...' : field.value,
                    value: index.toString()
                }));
                
                const selectRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('field_remove')
                            .setPlaceholder('Select a field to remove')
                            .addOptions(fieldOptions)
                    );
                
                const selectMessage = await i.reply({
                    content: 'Select a field to remove:',
                    components: [selectRow],
                    ephemeral: true,
                    fetchReply: true
                });
                
                const selection = await selectMessage.awaitMessageComponent({
                    filter: (i) => i.user.id === interaction.user.id && i.customId === 'field_remove',
                    time: 60000
                }).catch(() => null);
                
                if (selection) {
                    const index = parseInt(selection.values[0]);
                    
                    // Remove the field
                    embed.data.fields.splice(index, 1);
                    initialEmbed.data.fields.splice(index, 1);
                    
                    // If no fields left, clean up the fields array
                    if (embed.data.fields.length === 0) {
                        delete embed.data.fields;
                        delete initialEmbed.data.fields;
                    }
                    
                    await selection.update({
                        content: 'Field removed.',
                        components: []
                    });
                    
                    await interaction.editReply({ embeds: [embed] });
                }
                break;
            }
            case 'footer': {
                // Get current footer values if any
                const currentText = embed.data.footer ? embed.data.footer.text : '';
                const currentIconUrl = embed.data.footer ? embed.data.footer.icon_url || '' : '';
                
                const modal = createFooterModal(currentText, currentIconUrl);
                await i.showModal(modal);
                
                const submitted = await i.awaitModalSubmit({
                    filter: (i) => i.customId === 'footer_modal',
                    time: 60000
                }).catch(() => null);
                
                if (submitted) {
                    const text = submitted.fields.getTextInputValue('text');
                    const iconUrl = submitted.fields.getTextInputValue('icon_url');
                    
                    const footerOptions = { text };
                    if (iconUrl) footerOptions.iconURL = iconUrl;
                    
                    embed.setFooter(footerOptions);
                    initialEmbed.data.footer = {
                        text,
                        icon_url: iconUrl || undefined
                    };
                    
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
                        initialEmbed.data.thumbnail = { url };
                    } else {
                        delete embed.data.thumbnail;
                        delete initialEmbed.data.thumbnail;
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
                        initialEmbed.data.image = { url };
                    } else {
                        delete embed.data.image;
                        delete initialEmbed.data.image;
                    }
                    await submitted.deferUpdate();
                    await interaction.editReply({ embeds: [embed] });
                }
                break;
            }
            case 'color': {
                // Create color selection menu with common colors
                const colorOptions = [
                    { label: 'Red', value: '#FF0000' },
                    { label: 'Green', value: '#00FF00' },
                    { label: 'Blue', value: '#0000FF' },
                    { label: 'Yellow', value: '#FFFF00' },
                    { label: 'Purple', value: '#800080' },
                    { label: 'Aqua', value: '#00FFFF' },
                    { label: 'Orange', value: '#FFA500' },
                    { label: 'Gold', value: '#FFD700' },
                    { label: 'Navy', value: '#000080' },
                    { label: 'Lime', value: '#32CD32' },
                    { label: 'Pink', value: '#FFC0CB' },
                    { label: 'Teal', value: '#008080' },
                    { label: 'Indigo', value: '#4B0082' },
                    { label: 'Brown', value: '#A52A2A' },
                    { label: 'Black', value: '#000000' },
                    { label: 'White', value: '#FFFFFF' },
                    { label: 'Grey', value: '#808080' },
                    { label: 'Custom...', value: 'custom' }
                ];
                
                const selectRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('color_select')
                            .setPlaceholder('Select a color')
                            .addOptions(colorOptions)
                    );
                
                const selectMessage = await i.reply({
                    content: 'Select a color:',
                    components: [selectRow],
                    ephemeral: true,
                    fetchReply: true
                });
                
                const selection = await selectMessage.awaitMessageComponent({
                    filter: (i) => i.user.id === interaction.user.id && i.customId === 'color_select',
                    time: 60000
                }).catch(() => null);
                
                if (selection) {
                    if (selection.values[0] === 'custom') {
                        // Show custom color input modal
                        const currentColor = embed.data.color ? `#${embed.data.color.toString(16).padStart(6, '0')}` : '#3498db';
                        const modal = createModal('Set Embed Color (#hex)', 'Hex color', currentColor);
                        await selection.showModal(modal);
                        
                        const submitted = await selection.awaitModalSubmit({
                            filter: (i) => i.customId === 'set_embed_color_(#hex)',
                            time: 60000
                        }).catch(() => null);
                        
                        if (submitted) {
                            const color = submitted.fields.getTextInputValue('input');
                            try {
                                embed.setColor(color.startsWith('#') ? color : `#${color}`);
                                initialEmbed.data.color = parseInt(color.replace('#', ''), 16);
                            } catch (error) {
                                console.error('Invalid color:', error);
                            }
                            await submitted.deferUpdate();
                            await interaction.editReply({ embeds: [embed] });
                        }
                    } else {
                        // Set selected color
                        const color = selection.values[0];
                        embed.setColor(color);
                        initialEmbed.data.color = parseInt(color.replace('#', ''), 16);
                        
                        await selection.update({
                            content: `Color set to ${color}`,
                            components: []
                        });
                        
                        await interaction.editReply({ embeds: [embed] });
                    }
                }
                break;
            }
            case 'timestamp': {
                // Create timestamp options
                const timestampOptions = [
                    { label: 'Current time', value: 'now' },
                    { label: 'Custom date/time', value: 'custom' },
                    { label: 'No timestamp', value: 'none' }
                ];
                
                const selectRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('timestamp_select')
                            .setPlaceholder('Select a timestamp option')
                            .addOptions(timestampOptions)
                    );
                
                const selectMessage = await i.reply({
                    content: 'Select a timestamp option:',
                    components: [selectRow],
                    ephemeral: true,
                    fetchReply: true
                });
                
                const selection = await selectMessage.awaitMessageComponent({
                    filter: (i) => i.user.id === interaction.user.id && i.customId === 'timestamp_select',
                    time: 60000
                }).catch(() => null);
                
                if (selection) {
                    if (selection.values[0] === 'now') {
                        // Set current timestamp
                        embed.setTimestamp();
                        initialEmbed.data.timestamp = new Date().toISOString();
                        
                        await selection.update({
                            content: 'Timestamp set to current time',
                            components: []
                        });
                        
                        await interaction.editReply({ embeds: [embed] });
                    } else if (selection.values[0] === 'custom') {
                        // Show custom timestamp input modal
                        const modal = createModal('Custom Timestamp', 'Enter date/time (ISO format: YYYY-MM-DDTHH:MM:SSZ)', 
                            embed.data.timestamp || new Date().toISOString());
                        await selection.showModal(modal);
                        
                        const submitted = await selection.awaitModalSubmit({
                            filter: (i) => i.customId === 'custom_timestamp',
                            time: 60000
                        }).catch(() => null);
                        
                        if (submitted) {
                            try {
                                const timestamp = submitted.fields.getTextInputValue('input');
                                const date = new Date(timestamp);
                                
                                if (isNaN(date.getTime())) {
                                    throw new Error('Invalid date');
                                }
                                
                                embed.setTimestamp(date);
                                initialEmbed.data.timestamp = date.toISOString();
                                
                                await submitted.deferUpdate();
                                await interaction.editReply({ embeds: [embed] });
                            } catch (error) {
                                console.error('Invalid timestamp:', error);
                                await submitted.reply({
                                    content: 'Invalid timestamp format. Please use ISO format (YYYY-MM-DDTHH:MM:SSZ).',
                                    ephemeral: true
                                });
                            }
                        }
                    } else if (selection.values[0] === 'none') {
                        // Remove timestamp
                        delete embed.data.timestamp;
                        delete initialEmbed.data.timestamp;
                        
                        await selection.update({
                            content: 'Timestamp removed',
                            components: []
                        });
                        
                        await interaction.editReply({ embeds: [embed] });
                    }
                }
                break;
            }
            case 'save_template': {
                const modal = createTemplateSaveModal();
                await i.showModal(modal);
                
                const submitted = await i.awaitModalSubmit({
                    filter: (i) => i.customId === 'template_save_modal',
                    time: 60000
                }).catch(() => null);
                
                if (submitted) {
                    const name = submitted.fields.getTextInputValue('name');
                    const embedJson = JSON.stringify(embed.toJSON());
                    
                    try {
                        await embedCreatorModel.saveTemplate(
                            name,
                            interaction.guildId,
                            embedJson,
                            interaction.user.id
                        );
                        
                        await submitted.reply({
                            content: `Template "${name}" saved successfully!`,
                            ephemeral: true
                        });
                    } catch (error) {
                        console.error('Error saving template:', error);
                        await submitted.reply({
                            content: 'An error occurred while saving the template.',
                            ephemeral: true
                        });
                    }
                }
                break;
            }
            case 'export_json': {
                const jsonStr = JSON.stringify(embed.toJSON(), null, 2);
                await i.reply({
                    content: `\`\`\`json\n${jsonStr.length > 1900 ? jsonStr.substring(0, 1900) + '\n... (truncated)' : jsonStr}\n\`\`\``,
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

module.exports = {
    embedBuilder,
    startEmbedBuilder
};