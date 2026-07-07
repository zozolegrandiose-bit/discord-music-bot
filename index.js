require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const { execFile, spawn } = require('child_process');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const YTDLP = process.platform === 'win32' ? path.join(__dirname, 'yt-dlp.exe') : path.join(__dirname, 'yt-dlp');
const FFMPEG_PATH = require('ffmpeg-static');
const PLAYLISTS_FILE = path.join(__dirname, 'playlists.json');
function loadPlaylists() { try { return JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8')); } catch { return {}; } }
function savePlaylists(d) { fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
const { TIERLISTS, CATEGORIES } = require('./tierlists');
const tierlistSessions = new Map();

const queues = new Map();
const startTime = Date.now();



function parseDuration(str) {
  const match = str.match(/^(\d+)\s*(s|m|h|d|w|sec|min|hour|jour|day|semaine|week)s?$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, sec: 1000, m: 60000, min: 60000, h: 3600000, hour: 3600000, d: 86400000, day: 86400000, jour: 86400000, w: 604800000, week: 604800000, semaine: 604800000 };
  return n * (multipliers[unit] || 60000);
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

const COLORS = {
  PLAY: 0x2ecc71,
  QUEUE: 0x3498db,
  STOP: 0xe74c3c,
  WARN: 0xf39c12,
  INFO: 0x5865f2,
  MUSIC: 0x1db954,
};

const BOT_FOOTER = { text: '𝗪𝗵𝗶𝗽𝗽𝗶𝗻𝗴 𝗕𝗼𝘁 ━━━━━━━━━━━━━━━━━━' };

function embed(color = COLORS.INFO) {
  return new EmbedBuilder().setColor(color).setFooter(BOT_FOOTER).setTimestamp();
}

function getElapsedMs(queue) {
  if (!queue.startedAt) return 0;
  if (queue.paused && queue.pausedAt) return queue.pausedAt - queue.startedAt - queue.totalPausedMs;
  return Date.now() - queue.startedAt - queue.totalPausedMs;
}

function buildProgressBar(elapsedSec, totalSec) {
  if (!totalSec || totalSec <= 0) return null;
  const ratio = Math.min(Math.max(elapsedSec / totalSec, 0), 1);
  const total = 22;
  const pos = Math.round(ratio * total);
  const before = '━'.repeat(Math.max(0, pos));
  const after = '─'.repeat(Math.max(0, total - pos));
  const elapsed = formatDuration(Math.floor(elapsedSec));
  const dur = formatDuration(totalSec);
  return `\`${elapsed}\` ${before}⚪${after} \`${dur}\``;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      tracks: [],
      player: null,
      connection: null,
      volume: 0.5,
      loopMode: 'off',
      textChannel: null,
      idleTimer: null,
      nowPlayingMsg: null,
      paused: false,
      stay247: false,
      history: [],
      startedAt: 0,
      pausedAt: 0,
      totalPausedMs: 0,
    });
  }
  return queues.get(guildId);
}

const LOOP_LABELS = { off: 'Desactivee', track: 'Piste', queue: 'File' };
const LOOP_CYCLE = ['off', 'track', 'queue'];

// ── Tierlist interactive ─────────────────────────────────────────────
const TL_EMOJIS = { S: '🏆', A: '⭐', B: '✅', C: '🔵', D: '❌' };
const TL_LABELS = { S: '🏆 S', A: '⭐ A', B: '✅ B', C: '🔵 C', D: '❌ D' };

function buildTierlistCategoryRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('tl_cat')
      .setPlaceholder('Choisir une catégorie...')
      .addOptions(CATEGORIES.map((cat, i) => ({
        label: `${cat.emoji} ${cat.name}`,
        value: String(i),
        description: `${cat.themes.length} thèmes disponibles`,
      })))
  );
}

function buildItemPlacementContent(session) {
  const item = session.items[session.index];
  const current = session.index + 1;
  const total = session.items.length;
  const filled = Math.round((current / total) * 20);
  const bar = '▰'.repeat(filled) + '▱'.repeat(20 - filled);

  const placed = Object.entries(session.placements)
    .filter(([, arr]) => arr.length)
    .map(([t, arr]) => `${TL_EMOJIS[t]} **${t}** (${arr.length})`)
    .join('  ');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tl_place_S').setLabel('S').setEmoji('🏆').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tl_place_A').setLabel('A').setEmoji('⭐').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tl_place_B').setLabel('B').setEmoji('✅').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tl_place_C').setLabel('C').setEmoji('🔵').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tl_place_D').setLabel('D').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tl_skip').setLabel('Passer').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tl_cancel').setLabel('Annuler').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  );

  return {
    embeds: [new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🎯 ${session.themeName}`)
      .setDescription(`\n**Item ${current} / ${total}**\n\n# ${item}\n\nOù le places-tu ?\n\n\`${bar}\`${placed ? `\n\n${placed}` : ''}`)
      .setFooter({ text: `${current}/${total} items  ┃  ${BOT_FOOTER.text}` })],
    components: [row1, row2],
  };
}

function buildPlayerRows(queue) {
  const loopStyle = queue.loopMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success;
  const loopEmoji = queue.loopMode === 'queue' ? '🔂' : '🔁';
  const volPercent = Math.round(queue.volume * 100);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(!queue.history.length),
    new ButtonBuilder().setCustomId('music_seekback').setEmoji('⏪').setLabel('-10s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_pause_resume').setEmoji(queue.paused ? '▶️' : '⏸️').setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_seekfwd').setEmoji('⏩').setLabel('+10s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_loop').setEmoji(loopEmoji).setLabel(LOOP_LABELS[queue.loopMode]).setStyle(loopStyle),
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary).setDisabled(queue.tracks.length < 3),
    new ButtonBuilder().setCustomId('music_replay').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_247').setEmoji(queue.stay247 ? '🟢' : '🔘').setLabel('24/7').setStyle(queue.stay247 ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_voldown').setLabel(`${volPercent}%`).setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(volPercent <= 0),
    new ButtonBuilder().setCustomId('music_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(volPercent >= 100),
    new ButtonBuilder().setCustomId('music_pl_save').setEmoji('💾').setLabel('Sauvegarder').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music_pl_load').setEmoji('📂').setLabel('Charger').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_pl_list').setEmoji('📋').setLabel('Playlists').setStyle(ButtonStyle.Secondary),
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_tierlist').setEmoji('🎯').setLabel('Tierlist Aléatoire').setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2, row3, row4];
}

function buildNowPlayingEmbed(track, queue) {
  const volPercent = Math.round(queue.volume * 100);
  const volFill = Math.round(volPercent / 5);
  const volBar = '▰'.repeat(volFill) + '▱'.repeat(20 - volFill);

  const statusIcon = queue.paused ? '⏸️' : '▶️';
  const statusText = queue.paused ? 'EN PAUSE' : 'EN LECTURE';

  const e = new EmbedBuilder()
    .setColor(queue.paused ? COLORS.WARN : COLORS.MUSIC)
    .setAuthor({ name: `${statusIcon}  ${statusText}`, iconURL: queue.textChannel?.guild?.iconURL() || undefined })
    .setTitle(track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail || null)
    .setDescription((() => {
      const elapsedMs = getElapsedMs(queue);
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const totalSec = track.durationSec || 0;
      const progressLine = buildProgressBar(elapsedSec, totalSec);
      const lines = [''];
      if (progressLine) lines.push(`> ${progressLine}`);
      else lines.push(`> 🕐  \`${track.duration}\``);
      lines.push(`> 👤  \`${track.requestedBy || '?'}\`  ┃  🔊  ${volBar}  \`${volPercent}%\``);
      lines.push('');
      return lines.join('\n');
    })());

  const tags = [];
  if (queue.loopMode === 'track') tags.push('`🔁 Piste`');
  if (queue.loopMode === 'queue') tags.push('`🔂 File`');
  if (queue.stay247) tags.push('`🟢 24/7`');
  if (tags.length) e.addFields({ name: 'Mode', value: tags.join('  '), inline: true });

  if (queue.tracks.length > 1) {
    const next = queue.tracks.slice(1, 4).map((t, i) => `\`${i + 2}.\` ${t.title} — \`${t.duration}\``).join('\n');
    const remaining = queue.tracks.length - 1;
    e.addFields({ name: `⏭️ A suivre  ━━  ${remaining} piste${remaining > 1 ? 's' : ''}`, value: next });
  }

  e.setFooter({ text: `${BOT_FOOTER.text}  ┃  /help pour l'aide` });
  return e;
}

async function updateNowPlayingMsg(queue) {
  if (!queue.nowPlayingMsg || !queue.tracks.length) return;
  try {
    await queue.nowPlayingMsg.edit({
      embeds: [buildNowPlayingEmbed(queue.tracks[0], queue)],
      components: buildPlayerRows(queue),
    });
  } catch {}
}

function destroyQueue(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;
  clearTimeout(queue.idleTimer);
  if (queue.voiceChannel) queue.voiceChannel.setStatus?.('').catch(() => {});
  queue.player?.stop(true);
  queue.connection?.destroy();
  queues.delete(guildId);
}

function startIdleTimer(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;
  clearTimeout(queue.idleTimer);
  if (queue.stay247) return;
  queue.idleTimer = setTimeout(() => {
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.WARN)
        .setDescription('Inactif depuis 5 minutes, je me deconnecte.')],
    });
    destroyQueue(guildId);
  }, IDLE_TIMEOUT_MS);
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '?:??';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const YTDLP_BASE_ARGS = ['--ffmpeg-location', path.dirname(FFMPEG_PATH), '--no-warnings'];

function ytdlpExec(args) {
  const fullArgs = [...YTDLP_BASE_ARGS, ...args];
  return new Promise((resolve, reject) => {
    execFile(YTDLP, fullArgs, { maxBuffer: 1024 * 1024 * 5, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

async function searchYouTube(query) {
  const raw = await ytdlpExec([
    `ytsearch1:${query}`,
    '--dump-json',
    '--no-download',
    '--no-playlist',
    '--default-search', 'ytsearch',
  ]);
  return JSON.parse(raw);
}

async function getVideoInfo(url) {
  const raw = await ytdlpExec([
    url,
    '--dump-json',
    '--no-download',
    '--no-playlist',
  ]);
  return JSON.parse(raw);
}

function streamAudio(url) {
  const proc = spawn(YTDLP, [
    ...YTDLP_BASE_ARGS,
    url,
    '-f', 'ba[ext=webm]/ba/b',
    '-o', '-',
    '--no-playlist',
    '--quiet',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
  return proc.stdout;
}

async function streamAudioAt(url, startSec) {
  const raw = await ytdlpExec(['--get-url', '-f', 'ba[ext=webm]/ba/b', '--no-playlist', url]);
  const directUrl = raw.split('\n')[0];
  const proc = spawn(FFMPEG_PATH, [
    '-ss', `${Math.floor(startSec)}`,
    '-i', directUrl,
    '-f', 'opus',
    '-ar', '48000',
    '-ac', '2',
    '-b:a', '128k',
    '-loglevel', 'quiet',
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
  return proc.stdout;
}

async function seekTo(guildId, targetSec) {
  const queue = getQueue(guildId);
  if (!queue.tracks.length || !queue.player) return;
  const track = queue.tracks[0];
  const maxSec = track.durationSec || 0;
  const sec = Math.max(0, Math.min(targetSec, maxSec - 1));

  try {
    const audioStream = await streamAudioAt(track.url, sec);
    const resource = createAudioResource(audioStream, { inputType: StreamType.Arbitrary, inlineVolume: true });
    resource.volume?.setVolume(queue.volume);
    queue.forceReplay = true;
    queue.player.play(resource);
    queue.startedAt = Date.now() - (sec * 1000);
    queue.totalPausedMs = 0;
    queue.pausedAt = 0;
    queue.paused = false;
    await updateNowPlayingMsg(queue);
  } catch (err) {
    console.error('Seek error:', err);
  }
}

async function playNext(guildId) {
  const queue = getQueue(guildId);
  if (queue.tracks.length === 0) {
    if (queue.nowPlayingMsg) {
      try {
        await queue.nowPlayingMsg.edit({
          embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('File d\'attente terminee.')],
          components: [],
        });
      } catch {}
      queue.nowPlayingMsg = null;
    }
    if (queue.voiceChannel) queue.voiceChannel.setStatus?.('').catch(() => {});
    startIdleTimer(guildId);
    return;
  }

  clearTimeout(queue.idleTimer);
  queue.paused = false;
  const track = queue.tracks[0];

  try {
    const audioStream = streamAudio(track.url);
    const resource = createAudioResource(audioStream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume?.setVolume(queue.volume);
    queue.player.play(resource);
    queue.startedAt = Date.now();
    queue.pausedAt = 0;
    queue.totalPausedMs = 0;

    if (queue.voiceChannel) queue.voiceChannel.setStatus?.(`🎵 ${track.title}`).catch(() => {});

    const embed = buildNowPlayingEmbed(track, queue);
    const rows = buildPlayerRows(queue);

    if (queue.nowPlayingMsg) {
      try {
        await queue.nowPlayingMsg.edit({ embeds: [embed], components: rows });
      } catch {
        queue.nowPlayingMsg = await queue.textChannel?.send({ embeds: [embed], components: rows });
      }
    } else {
      queue.nowPlayingMsg = await queue.textChannel?.send({ embeds: [embed], components: rows });
    }
  } catch (err) {
    console.error('Erreur lecture :', err);
    queue.textChannel?.send({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.STOP)
        .setDescription(`Impossible de lire **${track.title}**. Passage a la suivante...`)],
    });
    queue.tracks.shift();
    playNext(guildId);
  }
}

async function resolvePlaylist(query) {
  const isUrl = query.startsWith('http://') || query.startsWith('https://');
  let playlistUrl = query;

  if (!isUrl) {
    const searchRaw = await ytdlpExec([
      `ytsearch1:${query} playlist`,
      '--dump-json',
      '--no-download',
      '--flat-playlist',
      '--default-search', 'ytsearch',
    ]);
    const first = JSON.parse(searchRaw.split('\n')[0]);
    playlistUrl = first.webpage_url || first.url;
  }

  const raw = await ytdlpExec([
    playlistUrl,
    '--flat-playlist',
    '--dump-json',
    '--no-download',
  ]);

  const lines = raw.split('\n').filter(Boolean);
  const tracks = lines.map(line => {
    const info = JSON.parse(line);
    return {
      url: info.url || `https://www.youtube.com/watch?v=${info.id}`,
      title: info.title || 'Titre inconnu',
      duration: formatDuration(info.duration),
      durationSec: info.duration || 0,
      thumbnail: info.thumbnails?.[0]?.url || null,
      requestedBy: null,
    };
  });

  return { tracks, title: playlistUrl };
}

async function resolveTrack(query) {
  const isUrl = query.startsWith('http://') || query.startsWith('https://');

  if (isUrl && query.includes('list=')) {
    const raw = await ytdlpExec([
      query,
      '--flat-playlist',
      '--dump-json',
      '--no-download',
    ]);
    const lines = raw.split('\n').filter(Boolean);
    return lines.map(line => {
      const info = JSON.parse(line);
      return {
        url: info.url || `https://www.youtube.com/watch?v=${info.id}`,
        title: info.title || 'Titre inconnu',
        duration: formatDuration(info.duration),
        durationSec: info.duration || 0,
        thumbnail: info.thumbnails?.[0]?.url || null,
        requestedBy: null,
      };
    });
  }

  let info;
  if (isUrl) {
    info = await getVideoInfo(query);
  } else {
    info = await searchYouTube(query);
  }

  return {
    url: info.webpage_url || info.url,
    title: info.title || 'Titre inconnu',
    duration: formatDuration(info.duration),
    durationSec: info.duration || 0,
    thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || null,
    requestedBy: null,
  };
}

function setupConnection(queue, voiceChannel, guild) {
  queue.voiceChannel = voiceChannel;
  queue.connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  queue.player = createAudioPlayer();
  queue.connection.subscribe(queue.player);

  queue.player.on(AudioPlayerStatus.Idle, () => {
    if (queue.forceReplay) {
      queue.forceReplay = false;
    } else if (queue.loopMode === 'off') {
      const played = queue.tracks.shift();
      if (played) queue.history.push(played);
      if (queue.history.length > 50) queue.history.shift();
    } else if (queue.loopMode === 'queue') {
      const played = queue.tracks.shift();
      if (played) {
        queue.history.push(played);
        queue.tracks.push(played);
      }
      if (queue.history.length > 50) queue.history.shift();
    }
    playNext(guild.id);
  });

  queue.player.on('error', (err) => {
    console.error('Player error:', err);
    queue.tracks.shift();
    playNext(guild.id);
  });

  queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(queue.connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      destroyQueue(guild.id);
    }
  });
}

// ─── Interactions ─────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {

  // ─── Boutons du lecteur ───────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('music_')) {
    const queue = getQueue(interaction.guild.id);
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel || !queue.connection) {
      return interaction.reply({ content: 'Tu dois etre dans le salon vocal.', ephemeral: true });
    }

    const action = interaction.customId;

    if (action === 'music_pause_resume') {
      if (queue.paused) {
        queue.player.unpause();
        if (queue.pausedAt) queue.totalPausedMs += Date.now() - queue.pausedAt;
        queue.pausedAt = 0;
        queue.paused = false;
      } else {
        queue.player.pause();
        queue.pausedAt = Date.now();
        queue.paused = true;
      }
      await updateNowPlayingMsg(queue);
      await interaction.deferUpdate();
    }

    else if (action === 'music_skip') {
      queue.loop = false;
      queue.tracks.shift();
      playNext(interaction.guild.id);
      await interaction.deferUpdate();
    }

    else if (action === 'music_stop') {
      const msg = queue.nowPlayingMsg;
      destroyQueue(interaction.guild.id);
      if (msg) {
        try {
          await msg.edit({
            embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Lecture arretee.')],
            components: [],
          });
        } catch {}
      }
      await interaction.deferUpdate();
    }

    else if (action === 'music_prev') {
      if (queue.history.length) {
        const prev = queue.history.pop();
        queue.tracks.unshift(prev);
        queue.forceReplay = true;
        queue.player.stop(true);
      }
      await interaction.deferUpdate();
    }

    else if (action === 'music_loop') {
      const idx = LOOP_CYCLE.indexOf(queue.loopMode);
      queue.loopMode = LOOP_CYCLE[(idx + 1) % LOOP_CYCLE.length];
      await updateNowPlayingMsg(queue);
      await interaction.deferUpdate();
    }

    else if (action === 'music_shuffle') {
      if (queue.tracks.length >= 3) {
        const current = queue.tracks.shift();
        for (let i = queue.tracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
        }
        queue.tracks.unshift(current);
        await updateNowPlayingMsg(queue);
      }
      await interaction.deferUpdate();
    }

    else if (action === 'music_voldown') {
      queue.volume = Math.max(0, queue.volume - 0.1);
      const resource = queue.player?._state?.resource;
      resource?.volume?.setVolume(queue.volume);
      await updateNowPlayingMsg(queue);
      await interaction.deferUpdate();
    }

    else if (action === 'music_volup') {
      queue.volume = Math.min(1, queue.volume + 0.1);
      const resource = queue.player?._state?.resource;
      resource?.volume?.setVolume(queue.volume);
      await updateNowPlayingMsg(queue);
      await interaction.deferUpdate();
    }

    else if (action === 'music_replay') {
      if (queue.tracks.length) {
        queue.forceReplay = true;
        queue.player.stop(true);
      }
      await interaction.deferUpdate();
    }

    else if (action === 'music_seekback' || action === 'music_seekfwd') {
      if (queue.tracks.length) {
        const elapsed = getElapsedMs(queue) / 1000;
        const offset = action === 'music_seekfwd' ? 10 : -10;
        await seekTo(interaction.guild.id, elapsed + offset);
      }
      await interaction.deferUpdate();
    }

    else if (action === 'music_247') {
      queue.stay247 = !queue.stay247;
      if (queue.stay247) clearTimeout(queue.idleTimer);
      await updateNowPlayingMsg(queue);
      await interaction.deferUpdate();
    }

    else if (action === 'music_pl_save') {
      if (!queue.tracks.length) return interaction.reply({ content: 'La file est vide.', ephemeral: true });
      const playlists = loadPlaylists();
      const userKey = interaction.user.id;
      if (!playlists[userKey]) playlists[userKey] = {};
      const count = Object.keys(playlists[userKey]).length;

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('pl_save_name').setPlaceholder('Choisis ou sauvegarder...').addOptions(
          ...(count > 0 ? Object.keys(playlists[userKey]).slice(0, 20).map(name => ({
            label: `📁 ${name} (ecraser)`,
            description: `${playlists[userKey][name].length} pistes`,
            value: `existing_${name}`,
          })) : []),
          { label: '➕ Nouvelle playlist', description: 'Creer une nouvelle playlist', value: 'new_playlist', emoji: '💾' },
        )
      );
      const reply = await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.MUSIC).setDescription(`💾 Sauvegarder **${queue.tracks.length}** piste${queue.tracks.length > 1 ? 's' : ''} dans une playlist :\n\nChoisis une playlist existante ou cree-en une nouvelle.`)], components: [row], ephemeral: true, fetchReply: true });

      const coll = reply.createMessageComponentCollector({ time: 30000 });
      coll.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;
        const val = i.values[0];
        if (val === 'new_playlist') {
          const name = `playlist-${Date.now().toString(36)}`;
          playlists[userKey][name] = queue.tracks.map(t => ({ url: t.url, title: t.title, duration: t.duration, durationSec: t.durationSec, thumbnail: t.thumbnail }));
          savePlaylists(playlists);
          coll.stop();
          return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`💾 Playlist **${name}** creee avec **${queue.tracks.length}** pistes.\n\nRenomme-la avec \`/manage playlist delete\` + \`/manage playlist save\`.`)], components: [] });
        }
        const name = val.replace('existing_', '');
        playlists[userKey][name] = queue.tracks.map(t => ({ url: t.url, title: t.title, duration: t.duration, durationSec: t.durationSec, thumbnail: t.thumbnail }));
        savePlaylists(playlists);
        coll.stop();
        i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`💾 Playlist **${name}** mise a jour avec **${queue.tracks.length}** pistes.`)], components: [] });
      });
      coll.on('end', (_, r) => { if (r === 'time') reply.edit({ components: [] }).catch(() => {}); });
    }

    else if (action === 'music_pl_load') {
      const playlists = loadPlaylists();
      const userKey = interaction.user.id;
      const userPl = playlists[userKey] || {};
      const names = Object.keys(userPl);

      if (!names.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('📂 Tu n\'as aucune playlist sauvegardee.\nUtilise le bouton **💾 Sauvegarder** pour en creer une.')], ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('pl_load_select').setPlaceholder('Choisis une playlist...').addOptions(
          ...names.slice(0, 25).map(name => ({
            label: name,
            description: `${userPl[name].length} pistes`,
            value: name,
            emoji: '📁',
          }))
        )
      );
      const reply = await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.MUSIC).setDescription('📂 Quelle playlist veux-tu charger ?')], components: [row], ephemeral: true, fetchReply: true });

      const coll = reply.createMessageComponentCollector({ time: 30000 });
      coll.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;
        const name = i.values[0];
        const tracks = userPl[name].map(t => ({ ...t, requestedBy: interaction.user.tag }));
        queue.tracks.push(...tracks);
        queue.textChannel = interaction.channel;

        if (!queue.connection) {
          const vc = interaction.member.voice.channel;
          if (!vc) { coll.stop(); return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois etre dans un salon vocal.')], components: [] }); }
          setupConnection(queue, vc, interaction.guild);
          playNext(interaction.guild.id);
        }

        coll.stop();
        const totalDur = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
        i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`📂 **${name}** chargee — **${tracks.length}** pistes ajoutees (\`${formatDuration(totalDur)}\`)`)], components: [] });
      });
      coll.on('end', (_, r) => { if (r === 'time') reply.edit({ components: [] }).catch(() => {}); });
    }

    else if (action === 'music_pl_list') {
      const playlists = loadPlaylists();
      const userPl = playlists[interaction.user.id] || {};
      const names = Object.keys(userPl);

      if (!names.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Tu n\'as aucune playlist.')], ephemeral: true });

      const desc = names.map(name => {
        const tracks = userPl[name];
        const dur = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
        return `> 📁  **${name}** — ${tracks.length} piste${tracks.length > 1 ? 's' : ''} (\`${formatDuration(dur)}\`)`;
      }).join('\n');

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.MUSIC)
          .setAuthor({ name: `Playlists de ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setDescription(desc)
          .setFooter({ text: `${names.length}/25 playlists  ┃  ${BOT_FOOTER.text}` })
          .setTimestamp()],
        ephemeral: true,
      });
    }

    else if (action === 'music_tierlist') {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle('🎯 Créer une Tierlist')
          .setDescription('Choisis une catégorie, puis un thème.\nChaque item s\'affiche un à un — clique sur **S / A / B / C / D** pour le placer !')
          .setFooter({ text: BOT_FOOTER.text })],
        components: [buildTierlistCategoryRow()],
        ephemeral: true,
      });
    }

    return;
  }

  // ── Tierlist: sélection catégorie ──────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'tl_cat') {
    const catIndex = parseInt(interaction.values[0]);
    const cat = CATEGORIES[catIndex];
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('tl_theme')
        .setPlaceholder('Choisir un thème...')
        .addOptions(cat.themes.map((theme, i) => ({
          label: theme[0].length > 100 ? theme[0].slice(0, 97) + '...' : theme[0],
          value: `${catIndex}_${i}`,
        })))
    );
    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`🎯 ${cat.emoji} ${cat.name}`)
        .setDescription('Choisis un thème :')
        .setFooter({ text: BOT_FOOTER.text })],
      components: [row],
    });
    return;
  }

  // ── Tierlist: sélection thème ──────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'tl_theme') {
    const [catIndex, themeIndex] = interaction.values[0].split('_').map(Number);
    const [themeName, items] = CATEGORIES[catIndex].themes[themeIndex];
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    tierlistSessions.set(interaction.user.id, {
      themeName,
      items: shuffled,
      index: 0,
      placements: { S: [], A: [], B: [], C: [], D: [] },
      skipped: [],
      createdAt: Date.now(),
    });
    await interaction.update(buildItemPlacementContent(tierlistSessions.get(interaction.user.id)));
    return;
  }

  // ── Tierlist: placement des items ──────────────────────────────────
  if (interaction.isButton() && (interaction.customId.startsWith('tl_place_') || interaction.customId === 'tl_skip' || interaction.customId === 'tl_cancel')) {
    const session = tierlistSessions.get(interaction.user.id);
    if (!session) {
      return interaction.reply({ content: 'Session expirée. Lance `/tierlist` à nouveau.', ephemeral: true });
    }

    if (interaction.customId === 'tl_cancel') {
      tierlistSessions.delete(interaction.user.id);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Tierlist annulée.')],
        components: [],
      });
    }

    const currentItem = session.items[session.index];
    if (interaction.customId === 'tl_skip') {
      session.skipped.push(currentItem);
    } else {
      const tier = interaction.customId.replace('tl_place_', '');
      session.placements[tier].push(currentItem);
    }
    session.index++;

    if (session.index < session.items.length) {
      await interaction.update(buildItemPlacementContent(session));
    } else {
      tierlistSessions.delete(interaction.user.id);
      const tierLines = Object.entries(session.placements)
        .filter(([, arr]) => arr.length)
        .map(([tier, arr]) => `**${TL_LABELS[tier]}** ┃ ${arr.join(' • ')}`)
        .join('\n');
      const skippedLine = session.skipped.length
        ? `\n**⬜ Non classés** ┃ ${session.skipped.join(' • ')}`
        : '';
      const resultEmbed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`🎯 Tierlist — ${session.themeName}`)
        .setDescription(`\n${tierLines}${skippedLine}\n`)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setFooter({ text: BOT_FOOTER.text })
        .setTimestamp();

      await interaction.update({
        embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('✅ Tierlist terminée ! Résultat posté ci-dessous.')],
        components: [],
      });
      await interaction.followUp({ embeds: [resultEmbed], ephemeral: false });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, member, channel } = interaction;
  const voiceChannel = member.voice.channel;
  const queue = getQueue(guild.id);

  if (commandName === 'play') {
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois etre dans un salon vocal !')],
        ephemeral: true,
      });
    }

    const query = interaction.options.getString('query');
    await interaction.deferReply();

    try {
      const result = await resolveTrack(query);

      if (!result) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucun resultat trouve.')],
        });
      }

      const tracks = Array.isArray(result) ? result : [result];
      tracks.forEach(t => { t.requestedBy = member.user.tag; });
      queue.tracks.push(...tracks);
      queue.textChannel = channel;

      if (!queue.connection) {
        setupConnection(queue, voiceChannel, guild);
        playNext(guild.id);

        const embed = new EmbedBuilder()
          .setColor(COLORS.PLAY)
          .setDescription(
            Array.isArray(result)
              ? `Connecte a **${voiceChannel.name}** — **${tracks.length} pistes** ajoutees depuis la playlist`
              : `Connecte a **${voiceChannel.name}** — lecture de **${tracks[0].title}**`
          );
        await interaction.editReply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(COLORS.QUEUE)
          .setDescription(
            Array.isArray(result)
              ? `**${tracks.length} pistes** ajoutees a la file depuis la playlist`
              : `Ajoute a la file : **${tracks[0].title}** (position ${queue.tracks.length})`
          );
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors de la recherche ou lecture.')],
      });
    }
  }

  else if (commandName === 'skip') {
    if (!queue.player || !queue.tracks.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')],
        ephemeral: true,
      });
    }
    const skipped = queue.tracks[0];
    queue.loopMode = 'off';
    queue.tracks.shift();
    playNext(guild.id);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`Passee : **${skipped.title}**`)],
    });
  }

  else if (commandName === 'stop') {
    if (!queue.connection) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Pas de connexion active.')],
        ephemeral: true,
      });
    }
    destroyQueue(guild.id);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Lecture arretee et file videe.')],
    });
  }

  else if (commandName === 'pause') {
    if (!queue.player) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')],
        ephemeral: true,
      });
    }
    queue.player.pause();
    queue.pausedAt = Date.now();
    queue.paused = true;
    await updateNowPlayingMsg(queue);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('⏸️ Lecture en pause.')],
    });
  }

  else if (commandName === 'resume') {
    if (!queue.player) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')],
        ephemeral: true,
      });
    }
    queue.player.unpause();
    if (queue.pausedAt) queue.totalPausedMs += Date.now() - queue.pausedAt;
    queue.pausedAt = 0;
    queue.paused = false;
    await updateNowPlayingMsg(queue);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('▶️ Lecture reprise !')],
    });
  }

  else if (commandName === 'queue') {
    if (!queue.tracks.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('File d\'attente vide.')],
        ephemeral: true,
      });
    }

    const page = (interaction.options.getInteger('page') || 1) - 1;
    const pageSize = 10;
    const totalPages = Math.ceil(queue.tracks.length / pageSize);
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * pageSize;
    const slice = queue.tracks.slice(start, start + pageSize);

    const totalDuration = queue.tracks.reduce((acc, t) => acc + (t.durationSec || 0), 0);

    const list = slice.map((t, i) => {
      const pos = start + i + 1;
      const prefix = pos === 1 ? '**>>** ' : `**${pos}.** `;
      return `${prefix}[${t.title}](${t.url}) — \`${t.duration}\``;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(COLORS.QUEUE)
      .setTitle(`File d'attente — ${queue.tracks.length} piste${queue.tracks.length > 1 ? 's' : ''}`)
      .setDescription(list)
      .setFooter({ text: `Page ${safePage + 1}/${totalPages} | Duree totale : ${formatDuration(totalDuration)}${queue.loopMode !== 'off' ? ` | Repetition ${LOOP_LABELS[queue.loopMode]}` : ''}` });

    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'volume') {
    const vol = interaction.options.getInteger('level');
    queue.volume = vol / 100;
    const resource = queue.player?._state?.resource;
    resource?.volume?.setVolume(queue.volume);

    const bar = '█'.repeat(Math.round(vol / 10)) + '░'.repeat(10 - Math.round(vol / 10));
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`Volume : ${bar} **${vol}%**`)],
    });
  }

  else if (commandName === 'loop') {
    const idx = LOOP_CYCLE.indexOf(queue.loopMode);
    queue.loopMode = LOOP_CYCLE[(idx + 1) % LOOP_CYCLE.length];
    const labels = { off: 'Repetition desactivee.', track: '🔁 Repetition de la piste activee.', queue: '🔂 Repetition de la file activee.' };
    await updateNowPlayingMsg(queue);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(queue.loopMode !== 'off' ? COLORS.PLAY : COLORS.WARN)
        .setDescription(labels[queue.loopMode])],
    });
  }

  else if (commandName === 'nowplaying') {
    const current = queue.tracks[0];
    if (!current) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')],
        ephemeral: true,
      });
    }
    await interaction.reply({ embeds: [buildNowPlayingEmbed(current, queue)], components: buildPlayerRows(queue) });
  }

  else if (commandName === 'shuffle') {
    if (queue.tracks.length < 3) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Pas assez de pistes pour melanger.')],
        ephemeral: true,
      });
    }
    const current = queue.tracks.shift();
    for (let i = queue.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }
    queue.tracks.unshift(current);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.QUEUE).setDescription(`File d'attente melangee ! (${queue.tracks.length} pistes)`)],
    });
  }

  else if (commandName === 'remove') {
    const pos = interaction.options.getInteger('position');
    if (pos < 1 || pos > queue.tracks.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Position invalide. La file contient ${queue.tracks.length} piste(s).`)],
        ephemeral: true,
      });
    }
    if (pos === 1) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Utilise `/skip` pour passer la piste en cours.')],
        ephemeral: true,
      });
    }
    const removed = queue.tracks.splice(pos - 1, 1)[0];
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`Retiree : **${removed.title}**`)],
    });
  }

  else if (commandName === 'clear') {
    if (queue.tracks.length <= 1) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('La file est deja vide.')],
        ephemeral: true,
      });
    }
    const current = queue.tracks[0];
    queue.tracks = [current];
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription('File d\'attente videe (la piste en cours continue).')],
    });
  }

  else if (commandName === 'skipto') {
    const pos = interaction.options.getInteger('position');
    if (!queue.tracks.length || pos < 1 || pos > queue.tracks.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Position invalide. La file contient ${queue.tracks.length} piste(s).`)],
        ephemeral: true,
      });
    }
    const skipped = queue.tracks.splice(0, pos - 1);
    queue.history.push(...skipped);
    queue.loopMode = 'off';
    queue.player?.stop(true);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`Saute a la piste **#${pos}** : **${queue.tracks[0]?.title}**`)],
    });
  }

  else if (commandName === 'move') {
    const from = interaction.options.getInteger('de');
    const to = interaction.options.getInteger('vers');
    if (from < 2 || from > queue.tracks.length || to < 2 || to > queue.tracks.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Positions invalides. La position 1 est la piste en cours.')],
        ephemeral: true,
      });
    }
    const [moved] = queue.tracks.splice(from - 1, 1);
    queue.tracks.splice(to - 1, 0, moved);
    await updateNowPlayingMsg(queue);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`**${moved.title}** deplacee de #${from} a #${to}.`)],
    });
  }

  else if (commandName === 'replay') {
    if (!queue.player || !queue.tracks.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')],
        ephemeral: true,
      });
    }
    queue.forceReplay = true;
    queue.player.stop(true);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Rejoue : **${queue.tracks[0].title}**`)],
    });
  }

  else if (commandName === '247') {
    queue.stay247 = !queue.stay247;
    if (queue.stay247) clearTimeout(queue.idleTimer);
    await updateNowPlayingMsg(queue);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(queue.stay247 ? COLORS.PLAY : COLORS.WARN)
        .setDescription(queue.stay247 ? '🕐 Mode 24/7 active — le bot reste connecte.' : 'Mode 24/7 desactive — deconnexion apres 5min d\'inactivite.')],
    });
  }

  else if (commandName === 'previous') {
    if (!queue.history.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucune piste precedente.')],
        ephemeral: true,
      });
    }
    const prev = queue.history.pop();
    queue.tracks.unshift(prev);
    queue.forceReplay = true;
    queue.player?.stop(true);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Retour a : **${prev.title}**`)],
    });
  }

  else if (commandName === 'playlist') {
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois etre dans un salon vocal !')],
        ephemeral: true,
      });
    }

    const query = interaction.options.getString('query');
    await interaction.deferReply();

    try {
      const result = await resolvePlaylist(query);
      if (!result.tracks.length) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucune playlist trouvee.')],
        });
      }

      result.tracks.forEach(t => { t.requestedBy = member.user.tag; });
      queue.tracks.push(...result.tracks);
      queue.textChannel = channel;

      const totalDuration = result.tracks.reduce((acc, t) => acc + (t.durationSec || 0), 0);

      if (!queue.connection) {
        setupConnection(queue, voiceChannel, guild);
        playNext(guild.id);
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.QUEUE)
          .setTitle('Playlist ajoutee')
          .setDescription(`**${result.tracks.length}** pistes ajoutees a la file`)
          .addFields(
            { name: 'Duree totale', value: formatDuration(totalDuration), inline: true },
            { name: 'Demande par', value: member.user.tag, inline: true },
          )],
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du chargement de la playlist.')],
      });
    }
  }

  // ─── Aide ────────────────────────────────────────────────────────────

  else if (commandName === 'help') {
    const HELP_PAGES = {
      home: {
        title: '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        color: COLORS.INFO,
        description: [
          '## 📖  Centre d\'aide',
          '',
          '> Choisis une **categorie** dans le menu ci-dessous',
          '> pour voir les commandes disponibles.',
          '',
          '🎵  **Musique**  ━  Lecture, recherche, historique',
          '📋  **File d\'attente**  ━  Queue, skip, shuffle, move',
          '🎛️  **Controles**  ━  Volume, boucle, 24/7, boutons',
          '💾  **Playlists**  ━  Sauvegarder, charger, gerer',
          '🎯  **Tierlist**  ━  Classer des items en S/A/B/C/D',
          '🎉  **Giveaway**  ━  Creer et relancer',
          '📊  **Informations**  ━  Profil, serveur, aide',
        ].join('\n'),
        fields: [],
      },
      music: {
        title: '🎵  Musique',
        color: COLORS.MUSIC,
        description: [
          '> Lecture musicale YouTube — URL, playlist ou recherche',
          '',
          '▸ `/play <recherche ou URL>` — Jouer une musique, playlist ou lien',
          '▸ `/search <recherche>` — Choisir parmi **5 resultats** YouTube',
          '▸ `/playlist <recherche ou URL>` — Charger une **playlist entiere**',
          '▸ `/nowplaying` — Afficher la piste en cours avec les boutons',
          '▸ `/pause` ┃ `/resume` — Mettre en pause / reprendre',
          '▸ `/stop` — Arreter la musique et vider la file',
          '▸ `/replay` — Relancer la piste depuis le debut',
          '▸ `/previous` — Revenir a la piste precedente',
        ].join('\n'),
        fields: [],
      },
      queue: {
        title: '📋  File d\'attente',
        color: COLORS.QUEUE,
        description: [
          '> Gestion de la file d\'attente',
          '',
          '▸ `/queue [page]` — Afficher la file (10 pistes par page)',
          '▸ `/skip` — Passer a la piste suivante',
          '▸ `/skipto <position>` — Sauter directement a une position',
          '▸ `/remove <position>` — Retirer une piste de la file',
          '▸ `/move <de> <vers>` — Deplacer une piste',
          '▸ `/shuffle` — Melanger aleatoirement la file',
          '▸ `/clear` — Vider la file (garde la piste en cours)',
        ].join('\n'),
        fields: [],
      },
      controls: {
        title: '🎛️  Controles',
        color: 0x9b59b6,
        description: [
          '> Volume, boucle, mode 24/7 et boutons du lecteur',
          '',
          '▸ `/volume <0-100>` — Regler le volume',
          '▸ `/loop` — Cycle : **Off** → **Piste** 🔁 → **File** 🔂',
          '▸ `/247` — Rester connecte en permanence dans le salon',
          '',
          '**Boutons du lecteur (sur le panel de musique)**',
          '`⏮️` Precedent  `⏪` -10s  `⏸️` Pause  `⏩` +10s  `⏭️` Suivant',
          '`⏹️` Stop  `🔁` Boucle  `🔀` Shuffle  `🔄` Replay  `🟢` 24/7',
          '`🔉` Vol-  `🔊` Vol+  `💾` Sauver  `📂` Charger  `📋` Playlists',
          '`🎯` Tierlist interactive',
        ].join('\n'),
        fields: [],
      },
      playlists: {
        title: '💾  Playlists personnelles',
        color: COLORS.PLAY,
        description: [
          '> Sauvegarde et chargement de tes propres playlists',
          '',
          '▸ `/playlist-save <nom>` — Sauvegarder la file actuelle',
          '▸ `/playlist-load <nom>` — Charger une playlist sauvegardee',
          '▸ `/playlist-list` — Voir toutes tes playlists',
          '▸ `/playlist-view <nom>` — Voir le contenu d\'une playlist',
          '▸ `/playlist-delete <nom>` — Supprimer une playlist',
          '▸ `/playlist-rename <ancien> <nouveau>` — Renommer une playlist',
          '',
          '> Accessible aussi via les boutons 💾 📂 📋 du lecteur',
        ].join('\n'),
        fields: [],
      },
      tierlist: {
        title: '🎯  Tierlist',
        color: 0x9b59b6,
        description: [
          '> Cree ta propre tierlist en classant des items un par un',
          '',
          '▸ `/tierlist` — Lancer une tierlist interactive',
          '',
          '**Deroulement :**',
          '`1.` Choisis une **categorie** (Anime, Gaming, Musique, Films...)',
          '`2.` Choisis un **theme** (ex: Personnages de Naruto)',
          '`3.` Chaque item s\'affiche — clique **S / A / B / C / D** pour le placer',
          '`4.` Le resultat final est poste dans le salon pour tout le monde',
          '',
          '> Bouton `🎯` dispo directement sur le panel de musique',
        ].join('\n'),
        fields: [],
      },
      giveaway: {
        title: '🎉  Giveaway',
        color: 0xf1c40f,
        description: [
          '> Organiser des tirages au sort sur le serveur',
          '',
          '▸ `/giveaway <prix> <duree> [gagnants]` — Lancer un giveaway',
          '   ↳ Duree : `10m`, `2h`, `1d`, `1w` etc.',
          '   ↳ Les membres reagissent avec 🎉 pour participer',
          '▸ `/giveaway-reroll <id>` — Retirer un nouveau gagnant',
          '   ↳ L\'ID est celui du message du giveaway',
        ].join('\n'),
        fields: [],
      },
      info: {
        title: '📊  Informations',
        color: 0x3498db,
        description: [
          '> Infos sur les membres et le serveur',
          '',
          '▸ `/userinfo [membre]` — ID, dates, pseudo, roles d\'un membre',
          '▸ `/serverinfo` — Proprietaire, membres, roles, salons, boosts',
          '▸ `/help` — Ce menu d\'aide',
        ].join('\n'),
        fields: [],
      },
    };

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Choisis une categorie...')
      .addOptions(
        { label: 'Accueil', description: 'Vue d\'ensemble', value: 'home', emoji: '📖' },
        { label: 'Musique', description: 'Play, search, playlist, replay...', value: 'music', emoji: '🎵' },
        { label: 'File d\'attente', description: 'Queue, skip, shuffle, move...', value: 'queue', emoji: '📋' },
        { label: 'Controles', description: 'Volume, boucle, 24/7, boutons...', value: 'controls', emoji: '🎛️' },
        { label: 'Playlists', description: 'Sauvegarder et charger tes playlists', value: 'playlists', emoji: '💾' },
        { label: 'Tierlist', description: 'Classer des items en S/A/B/C/D', value: 'tierlist', emoji: '🎯' },
        { label: 'Giveaway', description: 'Creer et gerer des giveaways', value: 'giveaway', emoji: '🎉' },
        { label: 'Informations', description: 'Userinfo, serverinfo...', value: 'info', emoji: '📊' },
      );

    const page = HELP_PAGES.home;
    const embed = new EmbedBuilder()
      .setColor(page.color)
      .setTitle(page.title)
      .setDescription(page.description || null)
      .addFields(page.fields)
      .setFooter(BOT_FOOTER).setTimestamp();

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = reply.createMessageComponentCollector({ time: 300_000 });
    collector.on('collect', async (i) => {
      if (!i.isStringSelectMenu() || i.customId !== 'help_select') return;
      const selected = i.values[0];
      const p = HELP_PAGES[selected];
      if (!p) return i.deferUpdate();

      const e = new EmbedBuilder()
        .setColor(p.color)
        .setTitle(p.title)
        .setDescription(p.description || null)
        .addFields(p.fields)
        .setFooter(BOT_FOOTER).setTimestamp();

      await i.update({ embeds: [e], components: [row] });
    });

    collector.on('end', async () => {
      try {
        await reply.edit({ components: [] });
      } catch {}
    });
  }

  else if (commandName === 'userinfo') {
    const user = interaction.options.getUser('membre') || interaction.user;
    const target = await guild.members.fetch(user.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`Infos — ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Compte cree le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
      );

    if (target) {
      embed.addFields(
        { name: 'A rejoint le', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:D>`, inline: true },
        { name: 'Pseudo', value: target.nickname || 'Aucun', inline: true },
        { name: `Roles (${target.roles.cache.size - 1})`, value: target.roles.cache.filter(r => r.id !== guild.id).map(r => `${r}`).join(', ') || 'Aucun' },
      );
      if (target.communicationDisabledUntilTimestamp) {
        embed.addFields({ name: 'Mute jusqu\'au', value: `<t:${Math.floor(target.communicationDisabledUntilTimestamp / 1000)}:f>` });
      }
    }

    embed.addFields({ name: 'Bot', value: user.bot ? 'Oui' : 'Non', inline: true });
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'serverinfo') {
    const owner = await guild.fetchOwner();
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: guild.id, inline: true },
        { name: 'Proprietaire', value: `${owner.user.tag}`, inline: true },
        { name: 'Cree le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Membres', value: `${guild.memberCount}`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Salons', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0} (Niveau ${guild.premiumTier})`, inline: true },
        { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
        { name: 'Verification', value: `${guild.verificationLevel}`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'debug') {
    const DEBUG_USERS = ['576468004863475746', '452381598663573506'];
    if (!DEBUG_USERS.includes(interaction.user.id)) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu n\'as pas acces a cette commande.')], ephemeral: true });
    const up = formatUptime(Date.now() - startTime);
    const mem = process.memoryUsage();
    const playerState = queue.player?._state?.status || 'Aucun';
    const connState = queue.connection?.state?.status || 'Deconnecte';
    const currentTrack = queue.tracks[0];
    const elapsed = currentTrack ? formatDuration(Math.floor(getElapsedMs(queue) / 1000)) : '-';

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('debug_restart').setEmoji('🔄').setLabel('Redemarrer le bot').setStyle(ButtonStyle.Danger),
    );

    const reply = await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('🔧 Debug')
        .setDescription([
          '```',
          `Bot          : ${client.user.tag}`,
          `Uptime       : ${up}`,
          `Memoire      : ${Math.round(mem.heapUsed / 1024 / 1024)} MB / ${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
          `Node.js      : ${process.version}`,
          `OS           : ${process.platform}`,
          `Ping API     : ${Math.round(client.ws.ping)}ms`,
          ``,
          `── Lecteur ──────────────────`,
          `Connexion    : ${connState}`,
          `Player       : ${playerState}`,
          `Piste        : ${currentTrack?.title || 'Aucune'}`,
          `Position     : ${elapsed} / ${currentTrack?.duration || '-'}`,
          `Volume       : ${Math.round(queue.volume * 100)}%`,
          `Loop         : ${queue.loopMode}`,
          `Pause        : ${queue.paused ? 'Oui' : 'Non'}`,
          `24/7         : ${queue.stay247 ? 'Oui' : 'Non'}`,
          `File         : ${queue.tracks.length} piste(s)`,
          `Historique   : ${queue.history.length} piste(s)`,
          `Salon vocal  : ${queue.voiceChannel?.name || 'Aucun'}`,
          '```',
        ].join('\n'))
        .setFooter(BOT_FOOTER)
        .setTimestamp()],
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    const coll = reply.createMessageComponentCollector({ time: 60000 });
    coll.on('collect', async (i) => {
      if (i.customId !== 'debug_restart') return;
      await i.update({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('🔄 Redemarrage du bot...')], components: [] });
      setTimeout(() => process.exit(0), 1000);
    });
    coll.on('end', (_, r) => { if (r === 'time') reply.edit({ components: [] }).catch(() => {}); });
  }

  else if (commandName === 'forcestop') {
    const DEBUG_USERS = ['576468004863475746', '452381598663573506'];
    if (!DEBUG_USERS.includes(interaction.user.id)) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu n\'as pas acces a cette commande.')], ephemeral: true });
    if (queue.voiceChannel) queue.voiceChannel.setStatus?.('').catch(() => {});
    queue.tracks = [];
    queue.history = [];
    queue.player?.stop(true);
    queue.connection?.destroy();
    queues.delete(guild.id);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.STOP)
        .setDescription('⚠️ **Arret force** — lecteur reset, connexion detruite, file et historique vides.')
        .setFooter(BOT_FOOTER)
        .setTimestamp()],
    });
  }

  else if (commandName === 'search') {
    if (!voiceChannel) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois etre dans un salon vocal !')], ephemeral: true });
    const query = interaction.options.getString('query');
    await interaction.deferReply();
    try {
      const raw = await ytdlpExec([`ytsearch5:${query}`, '--dump-json', '--no-download', '--flat-playlist', '--default-search', 'ytsearch']);
      const results = raw.split('\n').filter(Boolean).map(l => JSON.parse(l));
      if (!results.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucun resultat.')] });

      const menu = new StringSelectMenuBuilder().setCustomId('search_select').setPlaceholder('Choisis une piste...');
      const desc = results.map((r, i) => {
        menu.addOptions({ label: (r.title || 'Sans titre').slice(0, 100), description: formatDuration(r.duration), value: `${i}` });
        return `**${i + 1}.** [${r.title}](${r.webpage_url || r.url}) — \`${formatDuration(r.duration)}\``;
      }).join('\n');

      const embed = new EmbedBuilder().setColor(COLORS.QUEUE).setTitle(`Resultats pour "${query}"`).setDescription(desc);
      const row = new ActionRowBuilder().addComponents(menu);
      const reply = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = reply.createMessageComponentCollector({ time: 30_000 });
      collector.on('collect', async (i) => {
        if (!i.isStringSelectMenu()) return;
        const idx = parseInt(i.values[0]);
        const chosen = results[idx];
        const track = { url: chosen.webpage_url || chosen.url, title: chosen.title, duration: formatDuration(chosen.duration), durationSec: chosen.duration || 0, thumbnail: chosen.thumbnails?.[0]?.url, requestedBy: member.user.tag };
        queue.tracks.push(track);
        queue.textChannel = channel;
        if (!queue.connection) { setupConnection(queue, voiceChannel, guild); playNext(guild.id); }
        await i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Ajoute : **${track.title}**`)], components: [] });
        collector.stop();
      });
      collector.on('end', (_, reason) => { if (reason === 'time') interaction.editReply({ components: [] }).catch(() => {}); });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors de la recherche.')] });
    }
  }

  // ─── Playlists perso ─────────────────────────────────────────────────

  else if (commandName === 'playlist-save') {
    const nom = interaction.options.getString('nom').toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    if (!nom) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Nom invalide (lettres, chiffres, tirets).')], ephemeral: true });
    if (!queue.tracks.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('La file d\'attente est vide.')], ephemeral: true });
    const playlists = loadPlaylists();
    if (!playlists[interaction.user.id]) playlists[interaction.user.id] = {};
    if (Object.keys(playlists[interaction.user.id]).length >= 25 && !playlists[interaction.user.id][nom]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Maximum 25 playlists.')], ephemeral: true });
    playlists[interaction.user.id][nom] = queue.tracks.map(t => ({ url: t.url, title: t.title, duration: t.duration, durationSec: t.durationSec, thumbnail: t.thumbnail }));
    savePlaylists(playlists);
    const totalDur = queue.tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.MUSIC).setTitle('💾 Playlist sauvegardee').setDescription(`> 📁  **${nom}**\n> 🎵  **${queue.tracks.length}** pistes\n> 🕐  Duree : **${formatDuration(totalDur)}**`).setFooter(BOT_FOOTER).setTimestamp()] });
  }

  else if (commandName === 'playlist-load') {
    if (!voiceChannel) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois etre dans un salon vocal.')], ephemeral: true });
    const nom = interaction.options.getString('nom').toLowerCase();
    const playlists = loadPlaylists();
    const userPl = playlists[interaction.user.id] || {};
    if (!userPl[nom]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Playlist **${nom}** introuvable. Utilise \`/playlist-list\`.`)], ephemeral: true });
    const tracks = userPl[nom].map(t => ({ ...t, requestedBy: member.user.tag }));
    queue.tracks.push(...tracks);
    queue.textChannel = channel;
    if (!queue.connection) { setupConnection(queue, voiceChannel, guild); playNext(guild.id); }
    const totalDur = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.MUSIC).setTitle('📂 Playlist chargee').setDescription(`> 📁  **${nom}**\n> 🎵  **${tracks.length}** pistes ajoutees\n> 🕐  Duree : **${formatDuration(totalDur)}**`).setFooter(BOT_FOOTER).setTimestamp()] });
  }

  else if (commandName === 'playlist-list') {
    const playlists = loadPlaylists();
    const userPl = playlists[interaction.user.id] || {};
    const names = Object.keys(userPl);
    if (!names.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Tu n\'as aucune playlist.\nUtilise `/playlist-save <nom>` pendant qu\'une file joue.')], ephemeral: true });
    const desc = names.map(name => {
      const tracks = userPl[name];
      const dur = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
      return `> 📁  **${name}** — ${tracks.length} piste${tracks.length > 1 ? 's' : ''} (\`${formatDuration(dur)}\`)`;
    }).join('\n');
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.MUSIC).setAuthor({ name: `Playlists de ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() }).setDescription(desc).setFooter({ text: `${names.length}/25 playlists  ┃  ${BOT_FOOTER.text}` }).setTimestamp()] });
  }

  else if (commandName === 'playlist-view') {
    const nom = interaction.options.getString('nom').toLowerCase();
    const playlists = loadPlaylists();
    const userPl = playlists[interaction.user.id] || {};
    if (!userPl[nom]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Playlist **${nom}** introuvable.`)], ephemeral: true });
    const tracks = userPl[nom];
    const totalDur = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
    const list = tracks.slice(0, 15).map((t, i) => `\`${i + 1}.\` ${t.title} — \`${t.duration}\``).join('\n');
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.MUSIC).setTitle(`📁 ${nom}`).setDescription(list + (tracks.length > 15 ? `\n*...et ${tracks.length - 15} autres*` : '')).setFooter({ text: `${tracks.length} pistes  ┃  ${formatDuration(totalDur)}  ┃  ${BOT_FOOTER.text}` }).setTimestamp()] });
  }

  else if (commandName === 'playlist-delete') {
    const nom = interaction.options.getString('nom').toLowerCase();
    const playlists = loadPlaylists();
    if (!playlists[interaction.user.id]?.[nom]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Playlist **${nom}** introuvable.`)], ephemeral: true });
    delete playlists[interaction.user.id][nom];
    savePlaylists(playlists);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`🗑️ Playlist **${nom}** supprimee.`).setFooter(BOT_FOOTER).setTimestamp()] });
  }

  else if (commandName === 'playlist-rename') {
    const ancien = interaction.options.getString('ancien').toLowerCase();
    const nouveau = interaction.options.getString('nouveau').toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    if (!nouveau) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Nouveau nom invalide.')], ephemeral: true });
    const playlists = loadPlaylists();
    const userPl = playlists[interaction.user.id] || {};
    if (!userPl[ancien]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Playlist **${ancien}** introuvable.`)], ephemeral: true });
    if (userPl[nouveau]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Le nom **${nouveau}** est deja pris.`)], ephemeral: true });
    userPl[nouveau] = userPl[ancien];
    delete userPl[ancien];
    savePlaylists(playlists);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`📁 Playlist **${ancien}** renommee en **${nouveau}**.`).setFooter(BOT_FOOTER).setTimestamp()] });
  }

  // ─── Giveaway ───────────────────────────────────────────────────────

  else if (commandName === 'giveaway') {
    const prix = interaction.options.getString('prix');
    const dureeStr = interaction.options.getString('duree');
    const gagnants = interaction.options.getInteger('gagnants') || 1;
    const ms = parseDuration(dureeStr);
    if (!ms || ms > 30 * 86400000) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Duree invalide. Max 30 jours.')], ephemeral: true });

    const endTimestamp = Math.floor((Date.now() + ms) / 1000);
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(`**${prix}**\n\nReagis avec 🎉 pour participer !\n\n⏰ Fin : <t:${endTimestamp}:R>\n👥 Gagnant(s) : **${gagnants}**`)
      .setFooter({ text: `Par ${member.user.tag}` })
      .setTimestamp(Date.now() + ms);

    await interaction.reply({ content: 'Giveaway lance !', ephemeral: true });
    const gMsg = await channel.send({ embeds: [embed] });
    await gMsg.react('🎉');

    setTimeout(async () => {
      try {
        const fetched = await gMsg.fetch();
        const reaction = fetched.reactions.cache.get('🎉');
        const users = await reaction.users.fetch();
        const participants = users.filter(u => !u.bot);
        if (!participants.size) {
          return gMsg.edit({ embeds: [embed.setDescription(`**${prix}**\n\nAucun participant.`).setColor(0x95a5a6)] });
        }
        const winners = participants.random(Math.min(gagnants, participants.size));
        const winnerList = Array.isArray(winners) ? winners.map(w => `${w}`).join(', ') : `${winners}`;
        const endEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🎉 GIVEAWAY TERMINE 🎉')
          .setDescription(`**${prix}**\n\n🏆 Gagnant(s) : ${winnerList}`)
          .setFooter({ text: `ID: ${gMsg.id}` })
          .setTimestamp();
        await gMsg.edit({ embeds: [endEmbed] });
        channel.send(`Felicitations ${winnerList} ! Vous avez gagne **${prix}** ! 🎉`);
      } catch (err) { console.error('Giveaway error:', err); }
    }, ms);
  }

  else if (commandName === 'giveaway-reroll') {
    const msgId = interaction.options.getString('id');
    try {
      const gMsg = await channel.messages.fetch(msgId);
      const reaction = gMsg.reactions.cache.get('🎉');
      if (!reaction) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Ce message n\'est pas un giveaway.')], ephemeral: true });
      const users = await reaction.users.fetch();
      const participants = users.filter(u => !u.bot);
      if (!participants.size) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucun participant.')], ephemeral: true });
      const winner = participants.random();
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`🎉 Nouveau gagnant : ${winner} !`)] });
    } catch {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Message introuvable. Verifie l\'ID.')], ephemeral: true });
    }
  }

  else if (commandName === 'tierlist') {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('🎯 Créer une Tierlist')
        .setDescription('Choisis une catégorie, puis un thème.\nChaque item s\'affiche un à un — clique sur **S / A / B / C / D** pour le placer !')
        .setFooter({ text: BOT_FOOTER.text })],
      components: [buildTierlistCategoryRow()],
      ephemeral: true,
    });
  }

});


const { ActivityType } = require('discord.js');

client.once('ready', () => {
  console.log(`Connecte en tant que ${client.user.tag}`);

  let statusIndex = 0;
  const updateStatus = () => {
    const nowPlaying = [...queues.values()].find(q => q.tracks.length > 0 && !q.paused);

    if (nowPlaying && nowPlaying.tracks[0]) {
      const title = nowPlaying.tracks[0].title;
      client.user.setActivity(title, { type: ActivityType.Streaming, url: 'https://twitch.tv/whipping' });
      return;
    }

    const up = formatUptime(Date.now() - startTime);
    const statuses = [
      `/help`,
      `Uptime: ${up}`,
      `/play pour ecouter de la musique`,
      `WHP CORE`,
    ];

    client.user.setActivity(statuses[statusIndex % statuses.length], { type: ActivityType.Streaming, url: 'https://twitch.tv/whipping' });
    statusIndex++;
  };

  updateStatus();
  setInterval(updateStatus, 15000);
});

// Health check HTTP server for Render
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: formatUptime(Date.now() - startTime) }));
}).listen(PORT, () => console.log(`Health check sur le port ${PORT}`));

client.on('error', console.error);
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

client.login(process.env.DISCORD_TOKEN);
