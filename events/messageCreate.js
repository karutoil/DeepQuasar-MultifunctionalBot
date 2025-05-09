// filepath: /workspaces/DeepQuasar-MultifunctionalBot/events/messageCreate.js
const { Events } = require('discord.js');
const localAIModel = require('../models/localAIModel');
const localAICommand = require('../commands/localai');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Only process messages in guilds
        if (!message.guild) return;

        try {
            // Check if AI is enabled for this guild
            const isEnabled = await localAIModel.isEnabled(message.guild.id);
            if (!isEnabled) return;

            // Check if this channel is whitelisted
            const isWhitelisted = await localAIModel.isChannelWhitelisted(message.guild.id, message.channel.id);
            if (!isWhitelisted) return;

            let shouldRespond = false;
            let prompt = '';

            // Check if message mentions the bot
            const botMention = message.mentions.users.has(client.user.id);
            
            // Check if message is a reply to bot
            const isReplyToBot = message.reference && 
                message.reference.messageId && 
                (await message.channel.messages.fetch(message.reference.messageId))?.author.id === client.user.id;

            if (botMention || isReplyToBot) {
                shouldRespond = true;
                // Clean the content (remove mentions)
                prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
                
                // If prompt is empty (just a mention), check for referenced message content
                if (!prompt && message.reference) {
                    try {
                        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                        if (referencedMessage) {
                            prompt = `Please respond to: "${referencedMessage.content}"`;
                        }
                    } catch (err) {
                        console.error('Error fetching referenced message:', err);
                    }
                }
                
                // If still empty, use default prompt
                if (!prompt) {
                    prompt = "Hello! How can I help you?";
                }
            } else {
                // Random chance to respond to any message in whitelisted channel
                const responseChance = await localAIModel.getResponseChance(message.guild.id);
                if (Math.random() * 100 <= responseChance) {
                    shouldRespond = true;
                    prompt = message.content;
                }
            }

            if (shouldRespond) {
                // Show typing indicator while processing
                await message.channel.sendTyping();
                
                // Get AI response
                const response = await localAICommand.getAIResponse(client, message, prompt);
                
                if (response) {
                    // Split response if it's too long
                    const maxLength = 2000;
                    if (response.length <= maxLength) {
                        await message.reply(response);
                    } else {
                        // Split into chunks of max length
                        const chunks = [];
                        for (let i = 0; i < response.length; i += maxLength) {
                            chunks.push(response.substring(i, i + maxLength));
                        }
                        
                        // Send the first chunk as a reply
                        await message.reply(chunks[0]);
                        
                        // Send the rest as follow-up messages
                        for (let i = 1; i < chunks.length; i++) {
                            await message.channel.send(chunks[i]);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error in AI message processing: ${error}`);
        }
    },
};