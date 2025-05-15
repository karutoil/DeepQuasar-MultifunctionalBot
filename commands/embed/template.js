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
                flags: 64 // Equivalent to flags: 64
            });
        }
        
        const { embedJson, content, message } = result;
        
        // Debug message content before saving
        /* console.log('Content from message before saving as template:', {
            messageId,
            hasContent: !!content, 
            contentLength: content ? content.length : 0,
            content: content || '(no content found)',
            messageContentRaw: message.content,
            messageContentLength: message.content ? message.content.length : 0,
            hasRawContent: !!message.content
        }) */;
        
        // Save template with raw content from message
        await embedCreatorModel.saveTemplate(
            templateName,
            interaction.guildId,
            embedJson,
            interaction.user.id,
            message.content // Use raw message content
        );
        
        await interaction.reply({ 
            content: `Template "${templateName}" saved successfully!`, 
            flags: 64 // Equivalent to flags: 64
        });
    } catch (error) {
        console.error('Error saving template:', error);
        await interaction.reply({ 
            content: "An error occurred while saving the template.", 
            flags: 64 // Equivalent to flags: 64
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
                flags: 64 // Equivalent to flags: 64
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('Embed Templates')
            .setColor(Colors.Blue)
            .setDescription('Use `/embed template-load <name>` to load a template')
            .addFields(
                templates.map(template => ({
                    name: template.name,
                    value: `Created by: <@${template.authorId}>\nDate: ${template.createdAt.toLocaleDateString()}${template.hasContent ? '\nHas Message Content: ✅' : ''}`,
                    inline: true
                }))
            );
        
        await interaction.reply({ 
            embeds: [embed], 
            flags: 64 // Equivalent to flags: 64
        });
    } catch (error) {
        console.error('Error listing templates:', error);
        await interaction.reply({ 
            content: "An error occurred while listing templates.", 
            flags: 64 // Equivalent to flags: 64
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
                flags: 64 // Equivalent to flags: 64
            });
        }

        // Parse embed from template
        const parsed = parseEmbedJson(template.embedJson);
        if (!parsed) {
            return await interaction.reply({ 
                content: "Invalid template data.", 
                flags: 64 // Equivalent to flags: 64
            });
        }

        // Extract embed and content
        const { embed } = parsed;
        const content = template.content || parsed.content || '';

        // Directly load into edit_template
        await builderModule.startEmbedBuilder(interaction, embed, content);

    } catch (error) {
        console.error('Error loading template:', error);
        await interaction.reply({ 
            content: "An error occurred while loading the template.", 
            flags: 64 // Equivalent to flags: 64
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
                flags: 64 // Equivalent to flags: 64
            });
        }
        
        // Check if user is allowed to delete
        if (interaction.user.id !== template.authorId && 
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({ 
                content: "You can only delete templates you created unless you're an administrator.", 
                flags: 64 // Equivalent to flags: 64
            });
        }
        
        // Delete template
        await embedCreatorModel.deleteTemplate(templateName, interaction.guildId);
        
        await interaction.reply({ 
            content: `Template "${templateName}" deleted successfully!`, 
            flags: 64 // Equivalent to flags: 64
        });
    } catch (error) {
        console.error('Error deleting template:', error);
        await interaction.reply({ 
            content: "An error occurred while deleting the template.", 
            flags: 64 // Equivalent to flags: 64
        });
    }
}

module.exports = {
    saveTemplate,
    listTemplates,
    loadTemplate,
    deleteTemplate
};