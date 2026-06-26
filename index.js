const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, TextInputBuilder, ModalBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const { token, BanRoleId, BanReportChannelId, serverid, adminRoleId } = require('./config.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`${client.user.tag} is online!`);
    
    const commands = [
        new SlashCommandBuilder()
            .setName('Ban')
            .setDescription('Bans a user with a specific reason and time.')
            .addUserOption(option => option.setName('user').setDescription('The user to Ban').setRequired(true))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('unBan')
            .setDescription('UnBans a user.')
            .addUserOption(option => option.setName('user').setDescription('The user to unBan').setRequired(true))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('log')
            .setDescription('Displays Ban logs for a user.')
            .addUserOption(option => option.setName('user').setDescription('The user to display logs for').setRequired(true))
            .toJSON(),
    ];
    
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, serverid), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Failed to reload application (/) commands:', error);
    }
    
    checkBanDuration();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;
    if (interaction.isChatInputCommand()) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        
        if (!member.roles.cache.has(adminRoleId)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }
        switch (interaction.commandName) {
            case 'Ban':
                await handleBanCommand(interaction);
                break;
            case 'unBan':
                await handleUnBanCommand(interaction);
                break;
            case 'log':
                await showBanLogs(interaction);
                break;
            default:
                break;
        }
    } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
    }
});

async function handleBanCommand(interaction) {
    if (interaction.commandName !== 'Ban') return;
    const targetUser = interaction.options.getUser('user', true);
    const BanModal = createBanModal();
    await interaction.showModal(BanModal);
    db.set(`BanRequest_${interaction.user.id}`, { targetUserId: targetUser.id });
}

async function handleUnBanCommand(interaction) {
    const targetUser = interaction.options.getUser('user', true);
    await restoreUserRolesAndUnBan(targetUser.id, client.guilds.cache.get(serverid), interaction);
}

function createBanModal() {
    return new ModalBuilder()
        .setCustomId('BanModal')
        .setTitle('Ban User')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel('Reason for Ban')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(100)
                    .setPlaceholder('Enter a reason')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('time')
                    .setLabel('Time for Ban')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(10)
                    .setPlaceholder('e.g., 1m , 1h , 1d')
                    .setRequired(true)
            )
        );
}

async function logAction(userId, action, reason, BanedBy) {
    const logEntry = {
        action,
        reason,
        by: BanedBy,
        timestamp: Date.now()
    };
    const userLogs = await db.get(`logs_${userId}`) || [];
    userLogs.push(logEntry);
    await db.set(`logs_${userId}`, userLogs);
}

async function handleModalSubmit(interaction) {
    if (interaction.customId !== 'BanModal') return;
    const reason = interaction.fields.getTextInputValue('reason');
    const timeInput = interaction.fields.getTextInputValue('time');
    const { targetUserId } = await db.get(`BanRequest_${interaction.user.id}`);
    const duration = parseTimeInput(timeInput);
    
    if (!duration) {
        await interaction.reply({ content: 'Invalid time format. Use 1m for minutes, 1h for hours, or 1d for days.', ephemeral: true });
        return;
    }
    await BanUser(interaction, targetUserId, reason, duration);
}

async function BanUser(interaction, targetUserId, reason, duration) {
    const guild = client.guilds.cache.get(serverid);
    const targetMember = await guild.members.fetch(targetUserId).catch(console.error);
    
    await logAction(targetUserId, 'Baned', reason, interaction.user.id);

    if (!targetMember) {
        await interaction.reply({ content: 'Error: User to Ban not found.', ephemeral: true });
        return;
    }


    const userRoles = targetMember.roles.cache
        .filter(r => r.id !== guild.roles.everyone.id && r.id !== BanRoleId)
        .map(r => r.id);

    try {
        await db.set(targetUserId, {
            userId: targetUserId,
            roles: userRoles,
            reason,
            duration: Date.now() + duration,
            BanerId: interaction.user.id,
            timestamp: Date.now()
        });


        await targetMember.roles.set([BanRoleId]);
        const embed = new EmbedBuilder()
            .setTitle('Ban Report')
            .addFields(
                { name: 'User Baned', value: targetMember.user.tag, inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Duration', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true },
                { name: 'Baned By', value: interaction.user.tag, inline: true }
            )
            .setColor(0xFF0000);

        
        targetMember.send({ content: 'You have been Baned', embeds: [embed] }).catch(error => console.error('Could not send DM to Baned user:', error));

        await interaction.reply({ embeds: [embed], ephemeral: true });
        const reportChannel = await client.channels.fetch(BanReportChannelId);
        reportChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error Baning the user:', error);
        await interaction.reply({ content: 'There was an error trying to Ban the user.', ephemeral: true });
    }
}

async function restoreUserRolesAndUnBan(userId, guild, interaction = null) {
    const userData = await db.get(userId);
    if (!userData) return;

    const member = await guild.members.fetch(userId).catch(console.error);
    if (!member) return;

    await logAction(userId, 'UnBaned', 'N/A', interaction ? interaction.user.id : 'System');
    try {
        await member.roles.set(userData.roles.length ? userData.roles : [guild.roles.everyone.id]);
        await db.delete(userId);

        const unBanEmbed = new EmbedBuilder()
            .setTitle('UnBan Report')
            .addFields(
                { name: 'User UnBaned', value: member.user.tag, inline: true },
                { name: 'UnBaned By', value: interaction ? interaction.user.tag : 'Automated Process', inline: true },
                { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setColor(0x00FF00);

        
        member.send({ content: 'You have been unBaned', embeds: [unBanEmbed] }).catch(error => console.error('Could not send DM to unBaned user:', error));

        const reportChannel = await client.channels.fetch(BanReportChannelId);
        await reportChannel.send({ embeds: [unBanEmbed] });

        if (interaction) {
            await interaction.reply({ content: `Successfully unBaned ${member.user.tag} and restored their roles.`, ephemeral: true });
        }
    } catch (error) {
        console.error('Error restoring roles to the user:', error);
        if (interaction) {
            await interaction.reply({ content: 'There was an error trying to unBan the user and restore their roles.', ephemeral: true });
        }
    }
}


async function showBanLogs(interaction) {
    const user = interaction.options.getUser('user', true);
    const logs = await db.get(`logs_${user.id}`) || [];
    const itemsPerPage = 5;
    let page = 0;

    const pages = logs.reduce((acc, log, i) => {
        const pageIndex = Math.floor(i / itemsPerPage);
        if (!acc[pageIndex]) acc[pageIndex] = [];
        acc[pageIndex].push(log);
        return acc;
    }, []);

    const totalPages = pages.length;

    async function updateEmbed(page) {
        const logsForPage = pages[page] || [];
        let description = logsForPage.map(log => {
            const date = new Date(log.timestamp).toLocaleString();
            return `**Action**: ${log.action}\n**Reason**: ${log.reason}\n**By**: ${log.by}\n**Date**: ${date}`;
        }).join('\n\n');

        if (!description) description = 'No logs available for this user.';

        const embed = new EmbedBuilder()
            .setTitle(`Ban Logs for ${user.tag} (Page ${page + 1} of ${totalPages})`)
            .setDescription(description)
            .setColor(0x0099FF);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages - 1)
            );

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: [buttons] });
        } else {
            await interaction.reply({ embeds: [embed], components: [buttons], fetchReply: true });
        }
    }

    await updateEmbed(page);

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        if (i.customId === 'previous' && page > 0) {
            page--;
            await updateEmbed(page);
            await i.deferUpdate();
        } else if (i.customId === 'next' && page < totalPages - 1) {
            page++;
            await updateEmbed(page);
            await i.deferUpdate();
        }
    });

    collector.on('end', collected => console.log(`Collected ${collected.size} items`));
}
function parseTimeInput(input) {
    const match = input.match(/^(\d+)(m|h|d)$/);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

function checkBanDuration() {
    setInterval(async () => {
        const allBanedUsers = await db.all();
        const guild = client.guilds.cache.get(serverid);
        allBanedUsers.forEach(async user => {
            const { id, value } = user;
            if (value.duration && value.duration < Date.now()) {
                await restoreUserRolesAndUnBan(id, guild);
            }
        });
    }, 10000);
}

client.login(token);
client.on("ready", () => {
  console.log("Code by Mega Team Development®");
  console.log("Join us : discord.gg/2P8UMqYuCf");
});
