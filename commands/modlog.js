const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } = require('discord.js');
const { modLogModel, DEFAULT_EVENTS } = require('../models/modLogModel');

// Settings cache to reduce database load
const settingsCache = new Map();
const EVENT_TYPES_DISPLAY = {
    message_edit: 'Message Edits',
    message_delete: 'Message Deletions',
    member_update: 'Member Updates (nickname, roles)',
    role_change: 'Role Updates',
    role_create: 'Role Creation',
    role_delete: 'Role Deletion',
    voice_state_update: 'Voice Channel Activity',
    member_join: 'Member Joins',
    member_remove: 'Member Leaves',
    channel_update: 'Channel Updates',
    channel_create: 'Channel Creation',
    channel_delete: 'Channel Deletion',
    guild_update: 'Server Updates',
    emoji_update: 'Emoji Changes',
    sticker_update: 'Sticker Changes',
    invite_create: 'Invite Creation',
    invite_delete: 'Invite Deletion',
    thread_create: 'Thread Creation',
    thread_delete: 'Thread Deletion',
    thread_update: 'Thread Updates',
    admin_command: 'Admin Command Usage',
    command: 'All Command Usage'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modlog')
        .setDescription('Configure modlog settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Set the channel for logging server events')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to send logs to')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Toggle specific events')
                .addStringOption(option =>
                    option
                        .setName('event')
                        .setDescription('The event to toggle')
                        .setRequired(true)
                        .addChoices(
                            ...Object.entries(EVENT_TYPES_DISPLAY).map(([value, name]) => ({ name, value }))
                        ))
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable the event')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggleall')
                .setDescription('Enable or disable all events')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable all events')
                        .setRequired(true))),
    
    async execute(interaction) {
        const { options, guildId } = interaction;
        const subcommand = options.getSubcommand();
        
        // Initialize the model if it hasn't been initialized
        await modLogModel.init();
        
        switch (subcommand) {
            case 'setchannel':
                await this.handleSetChannel(interaction);
                break;
            case 'toggle':
                await this.handleToggle(interaction);
                break;
            case 'toggleall':
                await this.handleToggleAll(interaction);
                break;
        }
    },
    
    async handleSetChannel(interaction) {
        const channel = interaction.options.getChannel('channel');
        const { guildId } = interaction;
        
        // Check if the channel is a text channel and in the same guild
        if (!channel.isTextBased() || channel.guildId !== guildId) {
            return interaction.reply({
                content: '❌ Please select a text channel from this server.',
                ephemeral: true
            });
        }
        
        // Check if bot has permission to send messages in the channel
        try {
            const permissions = channel.permissionsFor(interaction.client.user);
            if (!permissions.has('SendMessages') || !permissions.has('EmbedLinks')) {
                return interaction.reply({
                    content: `❌ I don't have permission to send messages or embeds in ${channel}.`,
                    ephemeral: true
                });
            }
            
            // Set the channel in the database
            await modLogModel.setLogChannel(guildId, channel.id);
            
            // Update cache
            let settings = settingsCache.get(guildId) || {};
            settings.logChannelId = channel.id;
            settingsCache.set(guildId, settings);
            
            // Confirm to the user
            return interaction.reply({
                content: `✅ Modlog channel set to ${channel}.`,
                ephemeral: false
            });
            
        } catch (error) {
            console.error(`Error setting modlog channel for ${guildId}:`, error);
            return interaction.reply({
                content: '❌ An error occurred while setting the modlog channel.',
                ephemeral: true
            });
        }
    },
    
    async handleToggle(interaction) {
        const event = interaction.options.getString('event');
        const enabled = interaction.options.getBoolean('enabled');
        const { guildId } = interaction;
        
        // Verify that the event is valid
        if (!Object.keys(EVENT_TYPES_DISPLAY).includes(event)) {
            return interaction.reply({
                content: '❌ Invalid event type.',
                ephemeral: true
            });
        }
        
        try {
            // Toggle the event in the database
            await modLogModel.toggleEvent(guildId, event, enabled);
            
            // Update cache
            let settings = settingsCache.get(guildId);
            if (settings) {
                if (!settings.enabledEvents) settings.enabledEvents = {};
                settings.enabledEvents[event] = enabled;
                settingsCache.set(guildId, settings);
            }
            
            // Confirm to the user
            return interaction.reply({
                content: `✅ ${EVENT_TYPES_DISPLAY[event]} logs have been ${enabled ? 'enabled' : 'disabled'}.`,
                ephemeral: false
            });
            
        } catch (error) {
            console.error(`Error toggling modlog event for ${guildId}:`, error);
            return interaction.reply({
                content: '❌ An error occurred while updating the modlog settings.',
                ephemeral: true
            });
        }
    },
    
    async handleToggleAll(interaction) {
        const enabled = interaction.options.getBoolean('enabled');
        const { guildId } = interaction;
        
        try {
            // Create a map of all events set to the specified value
            const enabledEvents = {};
            for (const event of Object.keys(EVENT_TYPES_DISPLAY)) {
                enabledEvents[event] = enabled;
            }
            
            // Set all events in the database
            await modLogModel.setEnabledEvents(guildId, enabledEvents);
            
            // Update cache
            let settings = settingsCache.get(guildId) || {};
            settings.enabledEvents = enabledEvents;
            settingsCache.set(guildId, settings);
            
            // Confirm to the user
            return interaction.reply({
                content: `✅ All modlog events have been ${enabled ? 'enabled' : 'disabled'}.`,
                ephemeral: false
            });
            
        } catch (error) {
            console.error(`Error setting all modlog events for ${guildId}:`, error);
            return interaction.reply({
                content: '❌ An error occurred while updating the modlog settings.',
                ephemeral: true
            });
        }
    },
    
    /**
     * Check if a specific event type is enabled for a guild
     * @param {string} guildId - The Discord guild ID
     * @param {string} eventType - The event type to check
     * @returns {Promise<boolean>} Whether the event is enabled
     */
    async isEventEnabled(guildId, eventType) {
        // Check if we have cached settings
        if (settingsCache.has(guildId)) {
            const settings = settingsCache.get(guildId);
            if (settings.enabledEvents && settings.enabledEvents[eventType] !== undefined) {
                return settings.enabledEvents[eventType];
            }
        }
        
        // Get settings from database
        const settings = await modLogModel.getGuildSettings(guildId);
        if (!settings) return DEFAULT_EVENTS[eventType] || false;
        
        // Cache the settings
        settingsCache.set(guildId, settings);
        
        // Return the event setting
        return settings.enabledEvents && settings.enabledEvents[eventType] !== undefined
            ? settings.enabledEvents[eventType]
            : DEFAULT_EVENTS[eventType] || false;
    },
    
    /**
     * Get the log channel for a guild
     * @param {string} guildId - The Discord guild ID
     * @returns {Promise<string|null>} The channel ID or null
     */
    async getLogChannel(guildId) {
        // Check if we have cached settings
        if (settingsCache.has(guildId)) {
            const settings = settingsCache.get(guildId);
            if (settings.logChannelId) {
                return settings.logChannelId;
            }
        }
        
        // Get settings from database
        const settings = await modLogModel.getGuildSettings(guildId);
        if (!settings || !settings.logChannelId) return null;
        
        // Cache the settings
        settingsCache.set(guildId, settings);
        
        return settings.logChannelId;
    },
    
    /**
     * Log an action to the modlog channel
     * @param {Client} client - The Discord.js client
     * @param {string} guildId - The Discord guild ID
     * @param {string} eventType - The type of event
     * @param {object} data - Data related to the event
     */
    async logAction(client, guildId, eventType, data) {
        try {
            // Check if event is enabled
            const enabled = await this.isEventEnabled(guildId, eventType);
            if (!enabled) return;
            
            // Get the log channel
            const channelId = await this.getLogChannel(guildId);
            if (!channelId) return;
            
            // Get the guild
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (!guild) return;
            
            // Get the channel
            const channel = await guild.channels.fetch(channelId).catch(() => null);
            if (!channel) return;
            
            // Create and send the log embed
            const embed = await this.createLogEmbed(eventType, data, guild);
            if (embed) {
                await channel.send({ embeds: [embed] }).catch(error => {
                    console.error(`Failed to send modlog to channel ${channelId} in guild ${guildId}:`, error);
                });
            }
        } catch (error) {
            console.error(`Error in modlog.logAction for ${guildId}:`, error);
        }
    },
    
    /**
     * Create an embed for a log event
     * @param {string} eventType - The type of event
     * @param {object} data - Data related to the event
     * @param {Guild} guild - The Discord guild
     * @returns {Promise<EmbedBuilder|null>} The created embed
     */
    async createLogEmbed(eventType, data, guild) {
        const embed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Guild ID: ${guild.id}` });
            
        switch (eventType) {
            case 'message_edit': {
                const { before, after, channel } = data;
                if (!before.content || !after.content || before.content === after.content) return null;
                
                embed.setAuthor({ 
                    name: `Message edited by ${before.author.tag}`, 
                    iconURL: before.author.displayAvatarURL() 
                })
                .setDescription(`Message edited in ${channel}`)
                .addFields(
                    { name: 'Before', value: before.content.substring(0, 1024) || 'Empty', inline: false },
                    { name: 'After', value: after.content.substring(0, 1024) || 'Empty', inline: false },
                    { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                    { name: 'Message ID', value: before.id, inline: true },
                    { name: 'User ID', value: before.author.id, inline: true }
                )
                .setColor(Colors.Blue);
                break;
            }
                
            case 'message_delete': {
                const { message } = data;
                if (!message.content && (!message.attachments || message.attachments.size === 0)) return null;
                
                embed.setAuthor({ 
                    name: message.author ? `Message deleted from ${message.author.tag}` : 'Message deleted', 
                    iconURL: message.author ? message.author.displayAvatarURL() : null 
                })
                .setDescription(`Message deleted in <#${message.channel.id}>`)
                .setColor(Colors.Red);
                
                if (message.content) {
                    embed.addFields({ name: 'Content', value: message.content.substring(0, 1024) || 'Empty', inline: false });
                }
                
                if (message.attachments && message.attachments.size > 0) {
                    const attachmentList = Array.from(message.attachments.values())
                        .map(a => `[${a.name}](${a.url})`)
                        .join('\n');
                    embed.addFields({ name: 'Attachments', value: attachmentList.substring(0, 1024) || 'None', inline: false });
                }
                
                embed.addFields(
                    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Message ID', value: message.id, inline: true },
                    { name: 'User ID', value: message.author ? message.author.id : 'Unknown', inline: true }
                );
                break;
            }
                
            case 'member_join': {
                const { member } = data;
                const accountAge = Date.now() - member.user.createdTimestamp;
                const accountAgeInDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
                
                embed.setAuthor({ 
                    name: `Member joined: ${member.user.tag}`, 
                    iconURL: member.user.displayAvatarURL() 
                })
                .setDescription(`${member} joined the server`)
                .addFields(
                    { name: 'User ID', value: member.id, inline: true },
                    { name: 'Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'Account age', value: `${accountAgeInDays} days`, inline: true }
                )
                .setColor(Colors.Green)
                .setThumbnail(member.user.displayAvatarURL());
                break;
            }
                
            case 'member_remove': {
                const { member } = data;
                const joinedAge = member.joinedTimestamp ? Date.now() - member.joinedTimestamp : null;
                const joinedAgeInDays = joinedAge ? Math.floor(joinedAge / (1000 * 60 * 60 * 24)) : null;
                
                embed.setAuthor({ 
                    name: `Member left: ${member.user.tag}`, 
                    iconURL: member.user.displayAvatarURL() 
                })
                .setDescription(`${member} left the server`)
                .addFields(
                    { name: 'User ID', value: member.id, inline: true }
                )
                .setColor(Colors.Red)
                .setThumbnail(member.user.displayAvatarURL());
                
                if (joinedAgeInDays !== null) {
                    embed.addFields(
                        { name: 'Joined at', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Time in server', value: `${joinedAgeInDays} days`, inline: true }
                    );
                }
                break;
            }
            
            case 'member_update': {
                const { before, after } = data;
                
                // Determine what changed
                let changes = [];
                if (before.nickname !== after.nickname) {
                    changes.push(`Nickname: "${before.nickname || 'None'}" → "${after.nickname || 'None'}"`);
                }
                
                // Check role changes
                const addedRoles = after.roles.cache.filter(role => !before.roles.cache.has(role.id));
                const removedRoles = before.roles.cache.filter(role => !after.roles.cache.has(role.id));
                
                if (addedRoles.size > 0) {
                    changes.push(`Added roles: ${addedRoles.map(r => `<@&${r.id}>`).join(', ')}`);
                }
                
                if (removedRoles.size > 0) {
                    changes.push(`Removed roles: ${removedRoles.map(r => `<@&${r.id}>`).join(', ')}`);
                }
                
                if (changes.length === 0) return null;
                
                embed.setAuthor({ 
                    name: `Member updated: ${after.user.tag}`, 
                    iconURL: after.user.displayAvatarURL() 
                })
                .setDescription(`${after} was updated\n${changes.join('\n')}`)
                .addFields(
                    { name: 'User ID', value: after.id, inline: true }
                )
                .setColor(Colors.Blue);
                break;
            }
            
            case 'role_create': {
                const { role } = data;
                embed.setAuthor({ 
                    name: 'Role created', 
                    iconURL: guild.iconURL() 
                })
                .setDescription(`Role created: ${role}`)
                .addFields(
                    { name: 'Role name', value: role.name, inline: true },
                    { name: 'Role ID', value: role.id, inline: true },
                    { name: 'Color', value: role.hexColor, inline: true },
                    { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
                    { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true }
                )
                .setColor(role.color || Colors.Green);
                break;
            }
            
            case 'role_delete': {
                const { role } = data;
                embed.setAuthor({ 
                    name: 'Role deleted', 
                    iconURL: guild.iconURL() 
                })
                .setDescription(`Role deleted: ${role.name}`)
                .addFields(
                    { name: 'Role name', value: role.name, inline: true },
                    { name: 'Role ID', value: role.id, inline: true },
                    { name: 'Color', value: role.hexColor, inline: true }
                )
                .setColor(Colors.Red);
                break;
            }
            
            case 'role_change': {
                const { before, after } = data;
                
                // Determine what changed
                let changes = [];
                if (before.name !== after.name) {
                    changes.push(`Name: "${before.name}" → "${after.name}"`);
                }
                
                if (before.color !== after.color) {
                    changes.push(`Color: ${before.hexColor} → ${after.hexColor}`);
                }
                
                if (before.hoist !== after.hoist) {
                    changes.push(`Hoisted: ${before.hoist ? 'Yes' : 'No'} → ${after.hoist ? 'Yes' : 'No'}`);
                }
                
                if (before.mentionable !== after.mentionable) {
                    changes.push(`Mentionable: ${before.mentionable ? 'Yes' : 'No'} → ${after.mentionable ? 'Yes' : 'No'}`);
                }
                
                if (changes.length === 0) return null;
                
                embed.setAuthor({ 
                    name: 'Role updated', 
                    iconURL: guild.iconURL() 
                })
                .setDescription(`Role updated: ${after} \n${changes.join('\n')}`)
                .addFields(
                    { name: 'Role name', value: after.name, inline: true },
                    { name: 'Role ID', value: after.id, inline: true }
                )
                .setColor(after.color || Colors.Blue);
                break;
            }
            
            case 'channel_create': {
                const { channel } = data;
                embed.setAuthor({ 
                    name: 'Channel created', 
                    iconURL: guild.iconURL() 
                })
                .setDescription(`Channel created: ${channel}`)
                .addFields(
                    { name: 'Channel name', value: channel.name, inline: true },
                    { name: 'Channel ID', value: channel.id, inline: true },
                    { name: 'Type', value: String(channel.type), inline: true }
                )
                .setColor(Colors.Green);
                break;
            }
            
            case 'channel_delete': {
                const { channel } = data;
                embed.setAuthor({ 
                    name: 'Channel deleted', 
                    iconURL: guild.iconURL() 
                })
                .setDescription(`Channel deleted: #${channel.name}`)
                .addFields(
                    { name: 'Channel name', value: channel.name, inline: true },
                    { name: 'Channel ID', value: channel.id, inline: true },
                    { name: 'Type', value: String(channel.type), inline: true }
                )
                .setColor(Colors.Red);
                break;
            }
            
            case 'channel_update': {
                const { before, after } = data;
                
                // Determine what changed
                let changes = [];
                if (before.name !== after.name) {
                    changes.push(`Name: "#${before.name}" → "#${after.name}"`);
                }
                
                if (before.topic !== after.topic) {
                    changes.push(`Topic: "${before.topic || 'None'}" → "${after.topic || 'None'}"`);
                }
                
                if (before.nsfw !== after.nsfw) {
                    changes.push(`NSFW: ${before.nsfw ? 'Yes' : 'No'} → ${after.nsfw ? 'Yes' : 'No'}`);
                }
                
                if (before.rateLimitPerUser !== after.rateLimitPerUser) {
                    changes.push(`Slowmode: ${before.rateLimitPerUser}s → ${after.rateLimitPerUser}s`);
                }
                
                if (before.parentId !== after.parentId) {
                    const oldCategory = before.parent ? before.parent.name : 'None';
                    const newCategory = after.parent ? after.parent.name : 'None';
                    changes.push(`Category: ${oldCategory} → ${newCategory}`);
                }
                
                if (changes.length === 0) return null;
                
                embed.setAuthor({ 
                    name: 'Channel updated', 
                    iconURL: guild.iconURL() 
                })
                .setDescription(`Channel updated: ${after} \n${changes.join('\n')}`)
                .addFields(
                    { name: 'Channel name', value: after.name, inline: true },
                    { name: 'Channel ID', value: after.id, inline: true },
                    { name: 'Type', value: String(after.type), inline: true }
                )
                .setColor(Colors.Blue);
                break;
            }
            
            case 'voice_state_update': {
                const { member, before, after } = data;
                
                let action = '';
                if (!before.channelId && after.channelId) {
                    // Member joined a voice channel
                    action = `joined voice channel <#${after.channelId}>`;
                    embed.setColor(Colors.Green);
                } else if (before.channelId && !after.channelId) {
                    // Member left a voice channel
                    action = `left voice channel <#${before.channelId}>`;
                    embed.setColor(Colors.Red);
                } else if (before.channelId !== after.channelId) {
                    // Member moved voice channels
                    action = `moved from voice channel <#${before.channelId}> to <#${after.channelId}>`;
                    embed.setColor(Colors.Blue);
                } else if (before.mute !== after.mute) {
                    // Member was server muted/unmuted
                    action = after.mute ? 'was server muted' : 'was server unmuted';
                    embed.setColor(after.mute ? Colors.Yellow : Colors.Green);
                } else if (before.deaf !== after.deaf) {
                    // Member was server deafened/undeafened
                    action = after.deaf ? 'was server deafened' : 'was server undeafened';
                    embed.setColor(after.deaf ? Colors.Yellow : Colors.Green);
                } else {
                    return null; // No relevant change to log
                }
                
                embed.setAuthor({ 
                    name: `Voice update: ${member.user.tag}`, 
                    iconURL: member.user.displayAvatarURL() 
                })
                .setDescription(`${member} ${action}`)
                .addFields(
                    { name: 'User ID', value: member.id, inline: true }
                );
                break;
            }
            
            case 'guild_update': {
                const { before, after } = data;
                
                // Determine what changed
                let changes = [];
                if (before.name !== after.name) {
                    changes.push(`Name: "${before.name}" → "${after.name}"`);
                }
                
                if (before.description !== after.description) {
                    changes.push(`Description: "${before.description || 'None'}" → "${after.description || 'None'}"`);
                }
                
                if (before.iconURL() !== after.iconURL()) {
                    changes.push(`Server icon was updated`);
                }
                
                if (before.bannerURL() !== after.bannerURL()) {
                    changes.push(`Server banner was updated`);
                }
                
                if (before.verificationLevel !== after.verificationLevel) {
                    changes.push(`Verification level: ${before.verificationLevel} → ${after.verificationLevel}`);
                }
                
                if (changes.length === 0) return null;
                
                embed.setAuthor({ 
                    name: 'Server updated', 
                    iconURL: after.iconURL() 
                })
                .setDescription(`Server settings updated\n${changes.join('\n')}`)
                .setColor(Colors.Blue);
                
                if (after.iconURL()) {
                    embed.setThumbnail(after.iconURL());
                }
                break;
            }
            
            case 'emoji_update': {
                const { emoji, action, before, after } = data;
                
                if (action === 'created') {
                    embed.setAuthor({ 
                        name: 'Emoji created', 
                        iconURL: guild.iconURL() 
                    })
                    .setDescription(`Emoji created: ${emoji}`)
                    .addFields(
                        { name: 'Emoji name', value: emoji.name, inline: true },
                        { name: 'Emoji ID', value: emoji.id, inline: true }
                    )
                    .setColor(Colors.Green)
                    .setThumbnail(emoji.url);
                }
                else if (action === 'deleted') {
                    embed.setAuthor({ 
                        name: 'Emoji deleted', 
                        iconURL: guild.iconURL() 
                    })
                    .setDescription(`Emoji deleted: ${emoji.name}`)
                    .addFields(
                        { name: 'Emoji name', value: emoji.name, inline: true },
                        { name: 'Emoji ID', value: emoji.id, inline: true }
                    )
                    .setColor(Colors.Red)
                    .setThumbnail(emoji.url);
                }
                else if (action === 'updated') {
                    // Check what changed
                    if (before.name !== after.name) {
                        embed.setAuthor({ 
                            name: 'Emoji updated', 
                            iconURL: guild.iconURL() 
                        })
                        .setDescription(`Emoji updated: ${after}`)
                        .addFields(
                            { name: 'Old name', value: before.name, inline: true },
                            { name: 'New name', value: after.name, inline: true },
                            { name: 'Emoji ID', value: after.id, inline: true }
                        )
                        .setColor(Colors.Blue)
                        .setThumbnail(after.url);
                    } else {
                        return null; // No relevant changes to log
                    }
                }
                break;
            }
            
            default:
                // Unknown event type
                return null;
        }
        
        return embed;
    }
};