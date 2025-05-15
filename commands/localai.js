const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const axios = require('axios');
const localAIModel = require('../models/localAIModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chatbot')
        .setDescription('Manage your local AI chatbot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('configure')
                .setDescription('Configure your local AI endpoint')
                .addStringOption(option =>
                    option.setName('api_base')
                        .setDescription('Your local API URL (e.g., http://localhost:11434)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('api_key')
                        .setDescription('API key if required (leave empty if none)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('model_name')
                        .setDescription('Model name to use')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('prompt')
                .setDescription('Set a custom system prompt')
                .addStringOption(option =>
                    option.setName('prompt')
                        .setDescription('System prompt to prepend to all AI requests (leave empty to clear)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable AI responses')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable/disable AI responses')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Add or remove a whitelisted channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to whitelist')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Add or remove from whitelist')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add', value: 'add' },
                            { name: 'Remove', value: 'remove' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('listchannels')
                .setDescription('List all whitelisted channels'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('chance')
                .setDescription('Set AI response chance percentage (0-100)')
                .addNumberOption(option =>
                    option.setName('percentage')
                        .setDescription('Chance percentage (0-100)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Test your AI connection')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Test message to send to the AI')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'configure':
                await this.configureLocalAI(interaction);
                break;
            case 'prompt':
                await this.setSystemPrompt(interaction);
                break;
            case 'toggle':
                await this.toggleAI(interaction);
                break;
            case 'channel':
                await this.manageWhitelist(interaction);
                break;
            case 'listchannels':
                await this.listWhitelistedChannels(interaction);
                break;
            case 'chance':
                await this.setResponseChance(interaction);
                break;
            case 'test':
                await this.testAIConnection(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown subcommand.',
                    flags: 64
                });
        }
    },

    async configureLocalAI(interaction) {
        const apiBase = interaction.options.getString('api_base');
        const apiKey = interaction.options.getString('api_key');
        const modelName = interaction.options.getString('model_name') || 'llama3';

        // Validate URL format
        if (!apiBase.startsWith('http://') && !apiBase.startsWith('https://')) {
            return await interaction.reply({
                content: 'Invalid URL format. Must start with http:// or https://',
                flags: 64
            });
        }

        // Save configuration to database
        await localAIModel.setConfig(
            interaction.guild.id,
            apiBase,
            apiKey,
            modelName
        );

        await interaction.reply({
            content: `Local AI configured!\nEndpoint: \`${apiBase}\`\nModel: \`${modelName}\`\nAPI Key: ${apiKey ? 'Configured' : 'None'}`,
            flags: 64
        });
    },

    async setSystemPrompt(interaction) {
        const prompt = interaction.options.getString('prompt');

        await localAIModel.setSystemPrompt(interaction.guild.id, prompt);

        if (prompt) {
            await interaction.reply({
                content: 'System prompt set! It will be prepended to all AI requests.',
                flags: 64
            });
        } else {
            await interaction.reply({
                content: 'System prompt cleared!',
                flags: 64
            });
        }
    },

    async toggleAI(interaction) {
        const enabled = interaction.options.getBoolean('enabled');

        await localAIModel.setEnabled(interaction.guild.id, enabled);

        await interaction.reply({
            content: `Local AI responses ${enabled ? 'enabled' : 'disabled'}`,
            flags: 64
        });
    },

    async manageWhitelist(interaction) {
        const channel = interaction.options.getChannel('channel');
        const action = interaction.options.getString('action');

        if (action === 'add') {
            await localAIModel.addWhitelistedChannel(interaction.guild.id, channel.id);
            await interaction.reply({
                content: `Added ${channel} to whitelist`,
                flags: 64
            });
        } else if (action === 'remove') {
            await localAIModel.removeWhitelistedChannel(interaction.guild.id, channel.id);
            await interaction.reply({
                content: `Removed ${channel} from whitelist`,
                flags: 64
            });
        }
    },

    async listWhitelistedChannels(interaction) {
        const channels = await localAIModel.getWhitelistedChannels(interaction.guild.id);
        
        if (!channels.length) {
            return await interaction.reply({
                content: 'No whitelisted channels',
                flags: 64
            });
        }

        const channelMentions = [];
        for (const channelId of channels) {
            const channel = interaction.guild.channels.cache.get(channelId);
            if (channel) {
                channelMentions.push(channel.toString());
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('Whitelisted Channels')
            .setDescription(channelMentions.join('\n') || 'None')
            .setColor(0x7289DA);

        await interaction.reply({
            embeds: [embed],
            flags: 64
        });
    },

    async setResponseChance(interaction) {
        const chance = interaction.options.getNumber('percentage');

        await localAIModel.setResponseChance(interaction.guild.id, chance);

        await interaction.reply({
            content: `AI response chance set to ${chance}%`,
            flags: 64
        });
    },

    async testAIConnection(interaction) {
        await interaction.deferReply({ flags: 64 });

        const message = interaction.options.getString('message');
        const config = await localAIModel.getConfig(interaction.guild.id);

        if (!config) {
            return await interaction.editReply('AI is not configured. Use `/chatbot configure` first.');
        }

        try {
            // Get system prompt if configured
            const systemPrompt = await localAIModel.getSystemPrompt(interaction.guild.id);
            
            // Build messages array
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: "system", content: systemPrompt });
            }
            messages.push({ role: "user", content: message });
            
            const headers = {};
            if (config.apiKey) {
                headers.Authorization = `Bearer ${config.apiKey}`;
            }

            // Call the AI API
            const response = await axios.post(
                `${config.apiBase}/v1/chat/completions`,
                {
                    model: config.modelName,
                    messages: messages,
                    temperature: config.temperature || 0.7,
                    max_tokens: config.maxTokens || 1000
                },
                {
                    headers: headers,
                    timeout: 30000
                }
            );

            if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
                const aiResponse = response.data.choices[0].message.content;
                
                // Truncate if needed
                const truncatedResponse = aiResponse.length > 1500 
                    ? aiResponse.substring(0, 1497) + '...' 
                    : aiResponse;
                
                const embed = new EmbedBuilder()
                    .setTitle('AI Test Response')
                    .setDescription(truncatedResponse)
                    .setColor(0x2B82CB)
                    .setFooter({ text: `Model: ${config.modelName}` })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply('Received an unexpected response from the AI service.');
            }
        } catch (error) {
            console.error('AI API Error:', error);
            await interaction.editReply(`Error connecting to AI: ${error.message}`);
        }
    },

    /**
     * Get AI response for a message
     * @param {Client} client - Discord.js client
     * @param {Message} message - Discord message
     * @param {string} prompt - Prompt text
     * @returns {Promise<string|null>} - AI response or null
     */
    async getAIResponse(client, message, prompt) {
        try {
            const config = await localAIModel.getConfig(message.guild.id);
            if (!config || !config.enabled) {
                return null;
            }

            const headers = {};
            if (config.apiKey) {
                headers.Authorization = `Bearer ${config.apiKey}`;
            }

            // Get system prompt if configured
            const systemPrompt = await localAIModel.getSystemPrompt(message.guild.id);
            
            // Build messages array
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: "system", content: systemPrompt });
            }
            messages.push({ role: "user", content: prompt });

            const response = await axios.post(
                `${config.apiBase}/v1/chat/completions`,
                {
                    model: config.modelName,
                    messages: messages,
                    temperature: config.temperature || 0.7,
                    max_tokens: config.maxTokens || 1000
                },
                {
                    headers: headers,
                    timeout: 30000
                }
            );

            if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
                return response.data.choices[0].message.content;
            }
            
            return null;
        } catch (error) {
            console.error('AI Request Failed:', error);
            return null;
        }
    }
};