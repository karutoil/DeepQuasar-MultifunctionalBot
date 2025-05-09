// Template management for embeds
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const embedCreatorModel = require('../../models/embedCreatorModel');
const { parseEmbedJson, checkPermissions, findEmbedMessage } = require('./utils');

/**
 * Save an embed as a template
 * @param {Interaction} interaction - The Discord interaction object
 */
async function saveTemplate(interaction) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    const messageId = interaction.options.getString('message_id');
    const templateName = interaction.options.getString('template_name');
    
    try {
        // Find the message
        const result = await findEmbedMessage(
            interaction.client,
            messageId,
            interaction.guildId,
            embedCreatorModel
        );
        
        if (!result) {
            return await interaction.reply({ 
                content: "Message not found or no embed.", 
                ephemeral: true 
            });
        }
        
        const { embedJson } = result;
        
        // Save template
        await embedCreatorModel.saveTemplate(
            templateName,
            interaction.guildId,
            embedJson,
            interaction.user.id
        );
        
        await interaction.reply({ 
            content: `Template "${templateName}" saved successfully!`, 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error saving template:', error);
        await interaction.reply({ 
            content: "An error occurred while saving the template.", 
            ephemeral: true 
        });
    }
}

/**
 * List all templates for the guild
 * @param {Interaction} interaction - The Discord interaction object
 */
async function listTemplates(interaction) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    try {
        const templates = await embedCreatorModel.listTemplates(interaction.guildId);
        
        if (templates.length === 0) {
            return await interaction.reply({ 
                content: "No templates found for this guild.", 
                ephemeral: true 
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('Embed Templates')
            .setColor(Colors.Blue)
            .setDescription('Use `/embed template-load <name>` to load a template')
            .addFields(
                templates.map(template => ({
                    name: template.name,
                    value: `Created by: <@${template.authorId}>\nDate: ${template.createdAt.toLocaleDateString()}`,
                    inline: true
                }))
            );
        
        await interaction.reply({ 
            embeds: [embed], 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error listing templates:', error);
        await interaction.reply({ 
            content: "An error occurred while listing templates.", 
            ephemeral: true 
        });
    }
}

/**
 * Load a template
 * @param {Interaction} interaction - The Discord interaction object 
 * @param {Object} builderModule - Reference to the builder module for editing functionality
 */
async function loadTemplate(interaction, builderModule) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    const templateName = interaction.options.getString('template_name');
    
    try {
        const template = await embedCreatorModel.getTemplate(templateName, interaction.guildId);
        
        if (!template) {
            return await interaction.reply({ 
                content: `Template "${templateName}" not found.`, 
                ephemeral: true 
            });
        }
        
        // Parse embed from template
        const embed = parseEmbedJson(template.embedJson);
        if (!embed) {
            return await interaction.reply({ 
                content: "Invalid template data.", 
                ephemeral: true 
            });
        }
        
        // Prepare buttons for template operations
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_template')
                    .setLabel('Edit')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('post_template')
                    .setLabel('Post')
                    .setStyle(ButtonStyle.Success)
            );
        
        // Send preview with buttons
        const response = await interaction.reply({
            content: 'Template loaded!',
            embeds: [embed],
            components: [row],
            ephemeral: true,
            fetchReply: true
        });
        
        // Create collector for button interactions
        const collector = response.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 300000 // 5 minutes
        });
        
        // Current embed data for the session
        const sessionData = {
            embed,
            templateName
        };
        
        // Handle button interactions
        collector.on('collect', async (i) => {
            const id = i.customId;
            
            switch (id) {
                case 'edit_template':
                    await builderModule.startEmbedBuilder(i, sessionData.embed);
                    break;
                case 'post_template':
                    // Create channel selection
                    const channels = interaction.guild.channels.cache
                        .filter(c => c.type === 0 && c.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages))
                        .map(c => ({
                            label: c.name,
                            value: c.id
                        }))
                        .slice(0, 25);
                    
                    if (channels.length === 0) {
                        await i.reply({
                            content: "I don't have permission to send messages in any text channels.",
                            ephemeral: true
                        });
                        break;
                    }
                    
                    const selectRow = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('channel_select_template')
                                .setPlaceholder('Select a channel')
                                .addOptions(channels)
                        );
                    
                    await i.reply({
                        content: 'Select a channel to post the embed in:',
                        components: [selectRow],
                        ephemeral: true
                    });
                    break;
                case 'channel_select_template':
                    const channelId = i.values[0];
                    const channel = interaction.guild.channels.cache.get(channelId);
                    
                    try {
                        const message = await channel.send({ embeds: [sessionData.embed] });
                        const embedJson = JSON.stringify(sessionData.embed.toJSON());
                        
                        // Save to database
                        await embedCreatorModel.storeEmbed(
                            message.id,
                            channel.id,
                            interaction.guild.id,
                            embedJson,
                            interaction.user.id
                        );
                        
                        await i.update({
                            content: `Embed sent to ${channel}!`,
                            components: []
                        });
                    } catch (error) {
                        console.error('Error sending embed:', error);
                        await i.update({
                            content: `Failed to send embed to ${channel}.`,
                            components: []
                        });
                    }
                    break;
            }
        });
    } catch (error) {
        console.error('Error loading template:', error);
        await interaction.reply({ 
            content: "An error occurred while loading the template.", 
            ephemeral: true 
        });
    }
}

/**
 * Delete a template
 * @param {Interaction} interaction - The Discord interaction object
 */
async function deleteTemplate(interaction) {
    // Check permissions
    if (!await checkPermissions(interaction)) return;
    
    const templateName = interaction.options.getString('template_name');
    
    try {
        const template = await embedCreatorModel.getTemplate(templateName, interaction.guildId);
        
        if (!template) {
            return await interaction.reply({ 
                content: `Template "${templateName}" not found.`, 
                ephemeral: true 
            });
        }
        
        // Check if user is allowed to delete
        if (interaction.user.id !== template.authorId && 
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: "You can only delete templates you created unless you're an administrator.", 
                ephemeral: true 
            });
        }
        
        // Delete template
        await embedCreatorModel.deleteTemplate(templateName, interaction.guildId);
        
        await interaction.reply({ 
            content: `Template "${templateName}" deleted successfully!`, 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error deleting template:', error);
        await interaction.reply({ 
            content: "An error occurred while deleting the template.", 
            ephemeral: true 
        });
    }
}

module.exports = {
    saveTemplate,
    listTemplates,
    loadTemplate,
    deleteTemplate
};