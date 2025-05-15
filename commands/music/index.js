const { SlashCommandBuilder } = require('discord.js');
const { setupTrackEndEvent } = require('./utils');

// Import all command handlers
const play = require('./play');
const queue = require('./queue');
const nowplaying = require('./nowplaying');
const join = require('./join');
const leave = require('./leave');
const pause = require('./pause');
const resume = require('./resume');
const skip = require('./skip');
const stop = require('./stop');
const volume = require('./volume');
const loop = require('./loop');
const shuffle = require('./shuffle');
const clear = require('./clear');
const replay = require('./replay');
const seek = require('./seek');
const history = require('./history');
const autoplay = require('./autoplay');
const djrole = require('./djrole');
const queueManage = require('./queueManage');
const search = require('./search');
const resetmusic = require('./resetmusic');

// Create the composite command
module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('join')
            .setDescription('Join your voice channel'),
        new SlashCommandBuilder()
            .setName('leave')
            .setDescription('Leave the voice channel'),
        new SlashCommandBuilder()
            .setName('play')
            .setDescription('Play a song from YouTube or a URL')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('Song name or URL')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('pause')
            .setDescription('Pause playback'),
        new SlashCommandBuilder()
            .setName('resume')
            .setDescription('Resume playback'),
        new SlashCommandBuilder()
            .setName('skip')
            .setDescription('Skip the current song'),
        new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stop playback and clear the queue'),
        new SlashCommandBuilder()
            .setName('queue')
            .setDescription('Show the current music queue'),
        new SlashCommandBuilder()
            .setName('nowplaying')
            .setDescription('Show the currently playing track'),
        new SlashCommandBuilder()
            .setName('volume')
            .setDescription('Set or get playback volume (0-200%)')
            .addIntegerOption(option =>
                option.setName('level')
                    .setDescription('Volume level (0-200)')
                    .setMinValue(0)
                    .setMaxValue(200)
                    .setRequired(false)),
        new SlashCommandBuilder()
            .setName('loop')
            .setDescription('Toggle looping the current track'),
        new SlashCommandBuilder()
            .setName('shuffle')
            .setDescription('Shuffle the queue'),
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Clear the queue'),
        new SlashCommandBuilder()
            .setName('replay')
            .setDescription('Replay the current track from the beginning'),
        new SlashCommandBuilder()
            .setName('seek')
            .setDescription('Seek to a position in the current track (seconds)')
            .addIntegerOption(option =>
                option.setName('seconds')
                    .setDescription('Number of seconds to seek to')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('history')
            .setDescription('Show recently played tracks'),
        new SlashCommandBuilder()
            .setName('autoplay')
            .setDescription('Toggle autoplay related tracks'),
        new SlashCommandBuilder()
            .setName('setdj')
            .setDescription('Set the DJ role')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('Role to set as DJ')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('cleardj')
            .setDescription('Clear the DJ role'),
        new SlashCommandBuilder()
            .setName('move')
            .setDescription('Move a track in the queue')
            .addIntegerOption(option =>
                option.setName('from_pos')
                    .setDescription('Current position (starting from 1)')
                    .setMinValue(1)
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('to_pos')
                    .setDescription('New position (starting from 1)')
                    .setMinValue(1)
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('remove')
            .setDescription('Remove a track from the queue by position')
            .addIntegerOption(option =>
                option.setName('position')
                    .setDescription('Position in the queue (starting from 1)')
                    .setMinValue(1)
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('search')
            .setDescription('Search for songs or playlists to play')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('Song or playlist name to search for')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('What to search for')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Songs', value: 'song' },
                        { name: 'Playlists', value: 'playlist' }
                    )),
        new SlashCommandBuilder()
            .setName('resetmusic')
            .setDescription('Reset music system if having issues with playlists or songs')
            .addBooleanOption(option =>
                option.setName('confirm')
                    .setDescription('Confirm reset even if music is currently playing')
                    .setRequired(false)),
    ],
    
    // Command handler
    async execute(interaction, client) {
        const command = interaction.commandName;
        
        // Route to the appropriate command handler
        switch (command) {
            case 'play':
                return play.execute(interaction, client);
            case 'queue':
                return queue.execute(interaction, client);
            case 'nowplaying':
                return nowplaying.execute(interaction, client);
            case 'join':
                return join.execute(interaction, client);
            case 'leave':
                return leave.execute(interaction, client);
            case 'pause':
                return pause.execute(interaction, client);
            case 'resume':
                return resume.execute(interaction, client);
            case 'skip':
                return skip.execute(interaction, client);
            case 'stop':
                return stop.execute(interaction, client);
            case 'volume':
                return volume.execute(interaction, client);
            case 'loop':
                return loop.execute(interaction, client);
            case 'shuffle':
                return shuffle.execute(interaction, client);
            case 'clear':
                return clear.execute(interaction, client);
            case 'replay':
                return replay.execute(interaction, client);
            case 'seek':
                return seek.execute(interaction, client);
            case 'history':
                return history.execute(interaction, client);
            case 'autoplay':
                return autoplay.execute(interaction, client);
            case 'setdj':
                return djrole.setDJ(interaction, client);
            case 'cleardj':
                return djrole.clearDJ(interaction, client);
            case 'move':
                return queueManage.move(interaction, client);
            case 'remove':
                return queueManage.remove(interaction, client);
            case 'search':
                return search.execute(interaction, client);
            case 'resetmusic':
                return resetmusic.execute(interaction, client);
            default:
                return interaction.reply({ 
                    content: 'Unknown music command', 
                    flags: 64 
                });
        }
    },
    
    // Initialize music functionality
    init(client) {
        setupTrackEndEvent(client);
    }
};