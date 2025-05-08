const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const updateNotifierModel = require('../models/updateNotifierModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updatenotifier')
        .setDescription('Configure update notifications')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check the status of update notifications')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable update notifications')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable update notifications')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setowner')
                .setDescription('Set an override Discord user to receive update notifications')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to receive updates (leave empty to use bot owner)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('settoken')
                .setDescription('Set GitHub API token for higher rate limits')
                .addStringOption(option =>
                    option.setName('token')
                        .setDescription('GitHub API token (leave empty to remove token)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Manually check for updates now')
        ),

    async execute(interaction, client) {
        // Make sure the update service is available
        if (!client.updateNotifier) {
            return await interaction.reply({
                content: 'Update notifier service is not available.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'status':
                await this.handleStatus(interaction);
                break;
            case 'enable':
                await this.handleEnable(interaction);
                break;
            case 'disable':
                await this.handleDisable(interaction);
                break;
            case 'setowner':
                await this.handleSetOwner(interaction);
                break;
            case 'settoken':
                await this.handleSetToken(interaction);
                break;
            case 'check':
                await this.handleCheck(interaction, client);
                break;
        }
    },

    /**
     * Display current update notifier status
     */
    async handleStatus(interaction) {
        try {
            const config = await updateNotifierModel.getConfig();
            
            // Format dates nicely if they exist
            const lastCheckTime = config.last_check_time 
                ? new Date(config.last_check_time).toLocaleString() 
                : 'Never';
                
            const lastNotificationTime = config.last_notification_time 
                ? new Date(config.last_notification_time).toLocaleString() 
                : 'Never';
            
            // Get owner info
            let ownerInfo = 'Default bot owner';
            if (config.owner_id_override) {
                try {
                    const owner = await interaction.client.users.fetch(config.owner_id_override);
                    ownerInfo = `${owner.tag} (${owner.id})`;
                } catch (error) {
                    ownerInfo = `Invalid user: ${config.owner_id_override}`;
                }
            }
            
            // Build embed
            const embed = new EmbedBuilder()
                .setTitle('Update Notifier Status')
                .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Notifications Sent To', value: ownerInfo, inline: true },
                    { name: 'GitHub Token', value: config.github_api_token ? '✅ Configured' : '❌ Not set', inline: true },
                    { name: 'Last Check', value: lastCheckTime, inline: true },
                    { name: 'Last Notification', value: lastNotificationTime, inline: true }
                )
                .setFooter({ text: 'Update checks occur every 24 hours when enabled' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('[UpdateNotifier] Error getting status:', error);
            await interaction.reply({
                content: 'Failed to get update notifier status.',
                ephemeral: true
            });
        }
    },

    /**
     * Enable update notifications
     */
    async handleEnable(interaction) {
        try {
            await updateNotifierModel.setEnabled(true);
            
            // Start the service
            if (interaction.client.updateNotifier) {
                await interaction.client.updateNotifier.start();
            }
            
            await interaction.reply({
                content: '✅ Update notifications have been enabled.',
                ephemeral: true
            });
        } catch (error) {
            console.error('[UpdateNotifier] Error enabling notifier:', error);
            await interaction.reply({
                content: 'Failed to enable update notifier.',
                ephemeral: true
            });
        }
    },

    /**
     * Disable update notifications
     */
    async handleDisable(interaction) {
        try {
            await updateNotifierModel.setEnabled(false);
            
            // Stop the service
            if (interaction.client.updateNotifier) {
                interaction.client.updateNotifier.stop();
            }
            
            await interaction.reply({
                content: '❌ Update notifications have been disabled.',
                ephemeral: true
            });
        } catch (error) {
            console.error('[UpdateNotifier] Error disabling notifier:', error);
            await interaction.reply({
                content: 'Failed to disable update notifier.',
                ephemeral: true
            });
        }
    },

    /**
     * Set owner override
     */
    async handleSetOwner(interaction) {
        try {
            const user = interaction.options.getUser('user');
            
            if (user) {
                await updateNotifierModel.setOwnerIdOverride(user.id);
                await interaction.reply({
                    content: `✅ Update notifications will now be sent to ${user.tag}.`,
                    ephemeral: true
                });
            } else {
                await updateNotifierModel.setOwnerIdOverride(null);
                await interaction.reply({
                    content: '✅ Update notifications will now be sent to the bot owner.',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('[UpdateNotifier] Error setting owner override:', error);
            await interaction.reply({
                content: 'Failed to set owner override.',
                ephemeral: true
            });
        }
    },

    /**
     * Set GitHub API token
     */
    async handleSetToken(interaction) {
        try {
            const token = interaction.options.getString('token');
            
            await updateNotifierModel.setGitHubToken(token || null);
            
            await interaction.reply({
                content: token 
                    ? '✅ GitHub API token has been configured.' 
                    : '✅ GitHub API token has been removed.',
                ephemeral: true
            });
        } catch (error) {
            console.error('[UpdateNotifier] Error setting GitHub token:', error);
            await interaction.reply({
                content: 'Failed to set GitHub API token.',
                ephemeral: true
            });
        }
    },

    /**
     * Force check for updates now
     */
    async handleCheck(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            if (!client.updateNotifier) {
                return await interaction.followUp({
                    content: 'Update notifier service is not available.',
                    ephemeral: true
                });
            }
            
            // Run the update check
            await client.updateNotifier.checkForUpdates();
            
            // Get the updated config with the latest check time
            const config = await updateNotifierModel.getConfig();
            const lastCheckTime = config.last_check_time 
                ? new Date(config.last_check_time).toLocaleString() 
                : 'Just now';
            
            await interaction.followUp({
                content: `✅ Update check completed. Last check time: ${lastCheckTime}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('[UpdateNotifier] Error during manual check:', error);
            await interaction.followUp({
                content: 'Failed to check for updates.',
                ephemeral: true
            });
        }
    }
};