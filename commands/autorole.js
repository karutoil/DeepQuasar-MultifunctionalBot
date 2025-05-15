const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    Colors 
} = require('discord.js');
const autoRoleModel = require('../models/autoRoleModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Manage auto-role settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set role for new members')
                .addRoleOption(option => 
                    option.setName('role')
                          .setDescription('The role to assign automatically')
                          .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove auto-role')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check auto-role status')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'set':
                await this.setAutorole(interaction);
                break;
            case 'remove':
                await this.removeAutorole(interaction);
                break;
            case 'status':
                await this.autoroleStatus(interaction);
                break;
        }
    },

    async setAutorole(interaction) {
        const role = interaction.options.getRole('role');
        
        // Check bot permissions
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Missing Permissions')
                .setDescription('I need **Manage Roles** permission!')
                .setColor(Colors.Red);
            
            return await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        // Check role hierarchy
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Role Hierarchy Issue')
                .setDescription(`My role must be above ${role}!`)
                .setColor(Colors.Red);
            
            return await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        // Save to database
        await autoRoleModel.setRoleForGuild(interaction.guild.id, role.id);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Auto-Role Configured')
            .setDescription(`New members will receive: ${role}`)
            .setColor(Colors.Green);
        
        await interaction.reply({ embeds: [embed] });
    },

    async removeAutorole(interaction) {
        const roleId = await autoRoleModel.getRoleForGuild(interaction.guild.id);
        let description = 'No auto-role was configured';
        
        if (roleId) {
            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            description = role ? `Removed auto-role: ${role}` : 'Removed auto-role';
            
            // Remove from database
            await autoRoleModel.removeRoleForGuild(interaction.guild.id);
        }
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Auto-Role Disabled')
            .setDescription(description)
            .setColor(Colors.Green);
        
        await interaction.reply({ embeds: [embed] });
    },

    async autoroleStatus(interaction) {
        const roleId = await autoRoleModel.getRoleForGuild(interaction.guild.id);
        let status = 'ℹ️ Not configured';
        
        if (roleId) {
            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            status = role ? `✅ Active: ${role}` : '❌ Role not found';
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🛠️ Auto-Role Status')
            .setDescription(status)
            .setColor(Colors.Blue);
        
        // Add permission info
        const hasManageRoles = interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles);
        embed.addFields({
            name: 'Permissions',
            value: `Manage Roles: ${hasManageRoles ? '✅' : '❌'}`,
            inline: false
        });
        
        if (roleId) {
            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            if (role) {
                const canAssign = role.position < interaction.guild.members.me.roles.highest.position;
                embed.addFields({
                    name: 'Role Hierarchy',
                    value: `Bot can assign: ${canAssign ? '✅' : '❌'}`,
                    inline: false
                });
            }
        }
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};