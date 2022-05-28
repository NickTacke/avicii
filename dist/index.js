"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importStar(require("discord.js"));
const voice_1 = require("@discordjs/voice");
const youtube_search_api = require('youtube-search-api');
const track_1 = require("./music/track");
const subscription_1 = require("./music/subscription");
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const dotenv = require('dotenv').config();
const token = process.env.TOKEN;
const client = new discord_js_1.default.Client({ intents: ['GUILD_VOICE_STATES', 'GUILD_MESSAGES', 'GUILDS'] });
client.on('ready', () => console.log('Ready!'));
// This contains the setup code for creating slash commands in a guild. The owner of the bot can send "!deploy" to create them.
client.on('messageCreate', (message) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    if (!message.guild)
        return;
    if (!((_a = client.application) === null || _a === void 0 ? void 0 : _a.owner))
        yield ((_b = client.application) === null || _b === void 0 ? void 0 : _b.fetch());
    client.application.commands.set([]);
    if (message.content.toLowerCase() === '!deploy' && message.author.id === ((_d = (_c = client.application) === null || _c === void 0 ? void 0 : _c.owner) === null || _d === void 0 ? void 0 : _d.id)) {
        yield message.guild.commands.set([
            {
                name: 'play',
                description: 'Plays a song',
                options: [
                    {
                        name: 'song',
                        type: 'STRING',
                        description: 'The URL of the song to play',
                        required: true,
                    },
                ],
            },
            {
                name: 'skip',
                description: 'Skip to the next song in the queue',
            },
            {
                name: 'queue',
                description: 'See the music queue',
            },
            {
                name: 'pause',
                description: 'Pauses the song that is currently playing',
            },
            {
                name: 'resume',
                description: 'Resume playback of the current song',
            },
            {
                name: 'leave',
                description: 'Leave the voice channel',
            },
        ]);
        yield message.reply('Deployed!');
    }
}));
/**
 * Maps guild IDs to music subscriptions, which exist if the bot has an active VoiceConnection to the guild.
 */
const subscriptions = new Map();
function interactionCreateHandler(interaction) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!interaction.isCommand() || !interaction.guildId)
            return;
        let subscription = subscriptions.get(interaction.guildId);
        if (interaction.commandName === 'play') {
            // Extract the video URL from the command
            var url = interaction.options.get('song').value;
            // If a connection to the guild doesn't already exist and the user is in a voice channel, join that channel
            // and create a subscription.
            if (!subscription) {
                if (interaction.member instanceof discord_js_1.GuildMember && interaction.member.voice.channel) {
                    const channel = interaction.member.voice.channel;
                    subscription = new subscription_1.MusicSubscription((0, voice_1.joinVoiceChannel)({
                        channelId: channel.id,
                        guildId: channel.guild.id,
                        // @ts-ignore
                        adapterCreator: channel.guild.voiceAdapterCreator,
                    }));
                    subscription.voiceConnection.on('error', console.warn);
                    subscriptions.set(interaction.guildId, subscription);
                }
            }
            // If there is no subscription, tell the user they need to join a channel.
            if (!subscription) {
                yield interaction.followUp('Join a voice channel and then try that again!');
                return;
            }
            if (subscription) {
                if (subscription.voiceConnection.state.status == 'disconnected' || subscription.voiceConnection.state.status == 'destroyed') {
                    subscriptions.delete(interaction.guildId);
                    interactionCreateHandler(interaction);
                    return;
                }
            }
            // @ts-ignore
            yield interaction.deferReply();
            // Make sure the connection is ready before processing the user's request
            try {
                yield (0, voice_1.entersState)(subscription.voiceConnection, voice_1.VoiceConnectionStatus.Ready, 20e3);
            }
            catch (error) {
                console.warn(error);
                yield interaction.followUp('Failed to join voice channel within 20 seconds, please try again later!');
                return;
            }
            try {
                if (!url.startsWith("https://")) {
                    const promise = yield youtube_search_api.GetListByKeyword(interaction.options.get('song').value);
                    url = `https://www.youtube.com/watch?v=${promise.items[0].id}`;
                }
                // Attempt to create a Track from the user's video URL
                const track = yield track_1.Track.from(url, {
                    onStart() {
                        interaction.followUp({ content: 'Now playing!', ephemeral: true }).catch(console.warn);
                    },
                    onFinish() {
                        interaction.followUp({ content: 'Now finished!', ephemeral: true }).catch(console.warn);
                    },
                    onError(error) {
                        console.warn(error);
                        interaction.followUp({ content: `Error: ${error.message}`, ephemeral: true }).catch(console.warn);
                    },
                });
                // Enqueue the track and reply a success message to the user
                subscription.enqueue(track);
                yield interaction.followUp(`Enqueued **${track.title}**`);
            }
            catch (error) {
                console.warn(error);
                yield interaction.followUp('Failed to play track, please try again later!');
            }
        }
        else if (interaction.commandName === 'skip') {
            if (subscription) {
                // Calling .stop() on an AudioPlayer causes it to transition into the Idle state. Because of a state transition
                // listener defined in music/subscription.ts, transitions into the Idle state mean the next track from the queue
                // will be loaded and played.
                subscription.audioPlayer.stop();
                yield interaction.reply('Skipped song!');
            }
            else {
                yield interaction.reply('Not playing in this server!');
            }
        }
        else if (interaction.commandName === 'queue') {
            // Print out the current queue, including up to the next 5 tracks to be played.
            if (subscription) {
                const current = subscription.audioPlayer.state.status === voice_1.AudioPlayerStatus.Idle
                    ? `Nothing is currently playing!`
                    : `Playing **${subscription.audioPlayer.state.resource.metadata.title}**`;
                const queue = subscription.queue
                    .slice(0, 5)
                    .map((track, index) => `${index + 1}) ${track.title}`)
                    .join('\n');
                yield interaction.reply(`${current}\n\n${queue}`);
            }
            else {
                yield interaction.reply('Not playing in this server!');
            }
        }
        else if (interaction.commandName === 'pause') {
            if (subscription) {
                subscription.audioPlayer.pause();
                yield interaction.reply({ content: `Paused!`, ephemeral: true });
            }
            else {
                yield interaction.reply('Not playing in this server!');
            }
        }
        else if (interaction.commandName === 'resume') {
            if (subscription) {
                subscription.audioPlayer.unpause();
                yield interaction.reply({ content: `Unpaused!`, ephemeral: true });
            }
            else {
                yield interaction.reply('Not playing in this server!');
            }
        }
        else if (interaction.commandName === 'leave') {
            if (subscription) {
                try {
                    subscription.voiceConnection.destroy();
                    subscriptions.delete(interaction.guildId);
                    yield interaction.reply({ content: `Left channel!`, ephemeral: true });
                }
                catch (err) {
                    console.warn(err);
                }
            }
            else {
                yield interaction.reply('Not playing in this server!');
            }
        }
        else {
            yield interaction.reply('Unknown command');
        }
    });
}
// Handles slash command interactions
client.on('interactionCreate', interactionCreateHandler);
client.on('error', console.warn);
void client.login(token);
