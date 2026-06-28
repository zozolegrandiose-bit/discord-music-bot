require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
  ],
});

const YTDLP = process.platform === 'win32' ? path.join(__dirname, 'yt-dlp.exe') : 'yt-dlp';
const WARNINGS_FILE = path.join(__dirname, 'warnings.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const LEVELS_FILE = path.join(__dirname, 'levels.json');
const ECO_FILE = path.join(__dirname, 'economy.json');
const BACKUPS_DIR = path.join(__dirname, 'backups');
const NOTES_FILE = path.join(__dirname, 'notes.json');
const BIRTHDAYS_FILE = path.join(__dirname, 'birthdays.json');
const PROFILES_FILE = path.join(__dirname, 'profiles.json');
const MARRIAGES_FILE = path.join(__dirname, 'marriages.json');
const VOICESTATS_FILE = path.join(__dirname, 'voicestats.json');
const PLAYLISTS_FILE = path.join(__dirname, 'playlists.json');
function loadNotes() { try { return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8')); } catch { return {}; } }
function saveNotes(d) { fs.writeFileSync(NOTES_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadBirthdays() { try { return JSON.parse(fs.readFileSync(BIRTHDAYS_FILE, 'utf8')); } catch { return {}; } }
function saveBirthdays(d) { fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadProfiles() { try { return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')); } catch { return {}; } }
function saveProfiles(d) { fs.writeFileSync(PROFILES_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadMarriages() { try { return JSON.parse(fs.readFileSync(MARRIAGES_FILE, 'utf8')); } catch { return {}; } }
function saveMarriages(d) { fs.writeFileSync(MARRIAGES_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadVoiceStats() { try { return JSON.parse(fs.readFileSync(VOICESTATS_FILE, 'utf8')); } catch { return {}; } }
function saveVoiceStats(d) { fs.writeFileSync(VOICESTATS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadPlaylists() { try { return JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8')); } catch { return {}; } }
function savePlaylists(d) { fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
const voiceSessions = new Map();

function formatVoiceTime(ms) {
  const s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60, h = Math.floor(ms / 3600000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getDailyStreak(data) {
  if (!data.lastDaily) return 0;
  const now = new Date(), last = new Date(data.lastDaily);
  const diffDays = Math.floor((now - last) / 86400000);
  if (diffDays <= 1) return data.streak || 0;
  return 0;
}
const tttGames = new Map();
const TRIVIA = [
  {q:'Quelle est la capitale de l\'Australie ?',a:['Canberra','Sydney','Melbourne','Brisbane'],c:0},
  {q:'Combien d\'os dans le corps humain adulte ?',a:['206','205','208','210'],c:0},
  {q:'Quel est le plus grand ocean ?',a:['Pacifique','Atlantique','Indien','Arctique'],c:0},
  {q:'En quelle annee l\'homme a marche sur la Lune ?',a:['1969','1968','1970','1971'],c:0},
  {q:'Quel element chimique a le symbole Fe ?',a:['Fer','Fluor','Francium','Fermium'],c:0},
  {q:'Combien de planetes dans le systeme solaire ?',a:['8','9','7','10'],c:0},
  {q:'Quel pays a la plus grande population ?',a:['Inde','Chine','USA','Indonesie'],c:0},
  {q:'Qui a peint la Joconde ?',a:['Leonard de Vinci','Michel-Ange','Raphael','Botticelli'],c:0},
  {q:'Quel est le plus long fleuve du monde ?',a:['Nil','Amazone','Yangzi','Mississippi'],c:0},
  {q:'Combien de faces a un dodecaedre ?',a:['12','10','20','8'],c:0},
  {q:'Quelle est la vitesse de la lumiere ?',a:['300 000 km/s','150 000 km/s','1 000 000 km/s','30 000 km/s'],c:0},
  {q:'Quel gaz est le plus present dans l\'atmosphere ?',a:['Azote','Oxygene','CO2','Argon'],c:0},
];
const HANGMAN_WORDS = ['javascript','discord','ordinateur','programmation','musique','guitare','clavier','ecouteurs','internet','serveur','moderation','giveaway','commande','economie','aventure','starboard','suggestion','anniversaire','complement','technologie'];
const JOKES = ['Pourquoi les plongeurs plongent-ils toujours en arriere ? Parce que sinon ils tomberaient dans le bateau.','Que dit un informaticien quand il s\'ennuie ? Je bit.','Un octet entre dans un bar. Le barman : "Ca va ? Vous etes tout pale."','Pourquoi le Wi-Fi est-il si populaire ? Parce qu\'il a aucune attache.','Que fait un geek quand il a froid ? Il ouvre Windows.','C\'est quoi un canif ? Un petit fien.','Pourquoi les maths sont tristes ? Parce qu\'elles ont trop de problemes.','Comment appelle-t-on un chat tombe dans un pot de peinture ? Un chat peint.'];
const FACTS = ['Le miel ne se perime jamais.','Les pieuvres ont trois coeurs.','Un group de flamants roses s\'appelle une "flamboyance".','La Tour Eiffel grandit de 15 cm en ete.','Les dauphins dorment avec un oeil ouvert.','Il y a plus d\'etoiles dans l\'univers que de grains de sable sur Terre.','Le coeur d\'une crevette est dans sa tete.','Les koalas dorment 22 heures par jour.'];
const QUOTES = ['La vie est ce qui arrive quand on est occupe a faire d\'autres plans. — John Lennon','Sois le changement que tu veux voir dans le monde. — Gandhi','L\'imagination est plus importante que le savoir. — Einstein','Le succes c\'est tomber 7 fois et se relever 8. — Proverbe japonais','La seule facon de faire du bon travail est d\'aimer ce que vous faites. — Steve Jobs','Ce n\'est pas la force, mais la perseverance, qui fait les grandes oeuvres. — Samuel Johnson'];
const queues = new Map();
const snipes = new Map();
const editSnipes = new Map();
const afkUsers = new Map();
const spamMap = new Map();
const starboardCache = new Set();
const startTime = Date.now();

function loadEco() { try { return JSON.parse(fs.readFileSync(ECO_FILE, 'utf8')); } catch { return {}; } }
function saveEco(d) { fs.writeFileSync(ECO_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function getEcoUser(guildId, userId) {
  const eco = loadEco();
  const key = `${guildId}-${userId}`;
  if (!eco[key]) eco[key] = { balance: 0, lastDaily: 0, lastWork: 0 };
  return { eco, key, data: eco[key] };
}

function loadLevels() { try { return JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8')); } catch { return {}; } }
function saveLevels(d) { fs.writeFileSync(LEVELS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function xpForLevel(lvl) { return 5 * lvl * lvl + 50 * lvl + 100; }
function getLevelFromXp(xp) { let lvl = 0; while (xp >= xpForLevel(lvl + 1)) { xp -= xpForLevel(lvl + 1); lvl++; } return lvl; }
function getTotalXpForLevel(lvl) { let t = 0; for (let i = 1; i <= lvl; i++) t += xpForLevel(i); return t; }

function loadWarnings() {
  try {
    return JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveWarnings(data) {
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function parseDuration(str) {
  const match = str.match(/^(\d+)\s*(s|m|h|d|w|sec|min|hour|jour|day|semaine|week)s?$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, sec: 1000, m: 60000, min: 60000, h: 3600000, hour: 3600000, d: 86400000, day: 86400000, jour: 86400000, w: 604800000, week: 604800000, semaine: 604800000 };
  return n * (multipliers[unit] || 60000);
}

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return {}; }
}
function saveSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function getGuildSettings(guildId) {
  const all = loadSettings();
  if (!all[guildId]) all[guildId] = {};
  return all[guildId];
}
function setGuildSetting(guildId, key, value) {
  const all = loadSettings();
  if (!all[guildId]) all[guildId] = {};
  all[guildId][key] = value;
  saveSettings(all);
}

async function sendModLog(guild, embed) {
  const settings = getGuildSettings(guild.id);
  if (!settings.logChannel) return;
  const ch = guild.channels.cache.get(settings.logChannel);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
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
  MOD: 0xe74c3c,
  ECO: 0xf1c40f,
  FUN: 0xe91e63,
  CONFIG: 0x1abc9c,
  LEVEL: 0x9b59b6,
  TICKET: 0x3498db,
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

function buildPlayerRows(queue) {
  const loopStyle = queue.loopMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success;
  const loopEmoji = queue.loopMode === 'queue' ? '🔂' : '🔁';
  const volPercent = Math.round(queue.volume * 100);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_pause_resume').setEmoji(queue.paused ? '▶️' : '⏸️').setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(!queue.history.length),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_loop').setEmoji(loopEmoji).setLabel(LOOP_LABELS[queue.loopMode]).setStyle(loopStyle),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_voldown').setLabel(`${volPercent}%`).setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(volPercent <= 0),
    new ButtonBuilder().setCustomId('music_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(volPercent >= 100),
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary).setDisabled(queue.tracks.length < 3),
    new ButtonBuilder().setCustomId('music_replay').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_247').setEmoji(queue.stay247 ? '🟢' : '🔘').setLabel('24/7').setStyle(queue.stay247 ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_pl_save').setEmoji('💾').setLabel('Sauvegarder').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music_pl_load').setEmoji('📂').setLabel('Charger').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_pl_list').setEmoji('📋').setLabel('Mes playlists').setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2, row3];
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

function ytdlpExec(args) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
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
    url,
    '-f', 'ba[ext=webm]/ba/b',
    '-o', '-',
    '--no-playlist',
    '--quiet',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
  return proc.stdout;
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

// ─── Events : snipe, welcome, leave, autorole, antilink ──────────────

client.on('messageDelete', (msg) => {
  if (msg.partial || msg.author?.bot) return;
  snipes.set(msg.channel.id, { content: msg.content, author: msg.author.tag, avatar: msg.author.displayAvatarURL(), time: Date.now(), attachments: msg.attachments.first()?.url || null });
});

client.on('messageUpdate', (old, now) => {
  if (old.partial || old.author?.bot) return;
  editSnipes.set(old.channel.id, { oldContent: old.content, newContent: now.content, author: old.author.tag, avatar: old.author.displayAvatarURL(), time: Date.now() });
});

client.on('guildMemberAdd', async (member) => {
  const s = getGuildSettings(member.guild.id);
  if (s.autorole) {
    const role = member.guild.roles.cache.get(s.autorole);
    if (role) member.roles.add(role).catch(() => {});
  }
  if (s.welcomeChannel) {
    const ch = member.guild.channels.cache.get(s.welcomeChannel);
    if (!ch) return;
    const msg = (s.welcomeMessage || 'Bienvenue {user} sur **{server}** ! Nous sommes maintenant **{count}** membres.')
      .replace(/{user}/g, `${member}`)
      .replace(/{server}/g, member.guild.name)
      .replace(/{count}/g, member.guild.memberCount);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Nouveau membre !')
      .setDescription(msg)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => {});
  }
});

client.on('guildMemberRemove', (member) => {
  const s = getGuildSettings(member.guild.id);
  if (!s.leaveChannel) return;
  const ch = member.guild.channels.cache.get(s.leaveChannel);
  if (!ch) return;
  const msg = (s.leaveMessage || '{user} a quitte **{server}**. Nous sommes maintenant **{count}**.')
    .replace(/{user}/g, `**${member.user.tag}**`)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, member.guild.memberCount);
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('Membre parti')
    .setDescription(msg)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
});

// Voice stats tracking
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const key = `${guildId}-${userId}`;

  if (!oldState.channel && newState.channel) {
    voiceSessions.set(key, Date.now());
  }
  else if (oldState.channel && !newState.channel) {
    const joinedAt = voiceSessions.get(key);
    if (joinedAt) {
      const duration = Date.now() - joinedAt;
      voiceSessions.delete(key);
      const stats = loadVoiceStats();
      if (!stats[key]) stats[key] = { totalMs: 0, sessions: 0 };
      stats[key].totalMs += duration;
      stats[key].sessions++;
      saveVoiceStats(stats);
    }
  }
  else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    if (!voiceSessions.has(key)) voiceSessions.set(key, Date.now());
  }
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  const s = getGuildSettings(msg.guild.id);
  const isMod = msg.member.permissions.has(PermissionFlagsBits.ManageMessages);

  // AFK check - mentions
  if (msg.mentions.users.size) {
    msg.mentions.users.forEach(u => {
      const afk = afkUsers.get(`${msg.guild.id}-${u.id}`);
      if (afk) msg.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`**${u.tag}** est AFK : ${afk.reason}`)], allowedMentions: { repliedUser: false } }).catch(() => {});
    });
  }

  // AFK remove
  const afkKey = `${msg.guild.id}-${msg.author.id}`;
  if (afkUsers.has(afkKey)) {
    afkUsers.delete(afkKey);
    msg.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('Tu n\'es plus AFK.')], allowedMentions: { repliedUser: false } })
      .then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
  }

  // Anti-link
  if (s.antilink && !isMod && /(https?:\/\/|discord\.gg\/)\S+/i.test(msg.content)) {
    await msg.delete().catch(() => {});
    msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`${msg.author}, les liens ne sont pas autorises.`)] })
      .then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
    return;
  }

  // Word filter
  if (s.wordFilter?.length && !isMod) {
    const lower = msg.content.toLowerCase();
    if (s.wordFilter.some(w => lower.includes(w.toLowerCase()))) {
      await msg.delete().catch(() => {});
      msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`${msg.author}, ton message contient un mot interdit.`)] })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
      return;
    }
  }

  // Anti-caps
  if (s.anticaps && !isMod && msg.content.length > 10) {
    const caps = msg.content.replace(/[^A-Z]/g, '').length;
    const letters = msg.content.replace(/[^a-zA-Z]/g, '').length;
    if (letters > 0 && caps / letters > 0.7) {
      await msg.delete().catch(() => {});
      msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`${msg.author}, pas de majuscules excessives.`)] })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
      return;
    }
  }

  // Anti-spam
  if (s.antispam && !isMod) {
    const key = `${msg.guild.id}-${msg.author.id}`;
    const now = Date.now();
    if (!spamMap.has(key)) spamMap.set(key, []);
    const times = spamMap.get(key);
    times.push(now);
    const recent = times.filter(t => now - t < 5000);
    spamMap.set(key, recent);
    if (recent.length >= 5) {
      spamMap.set(key, []);
      await msg.member.timeout(60000, 'Anti-spam').catch(() => {});
      msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`${msg.author} a ete mute 1 min (spam).`)] })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 10000)).catch(() => {});
      return;
    }
  }

  // XP / Levels
  const lvlKey = `${msg.guild.id}-${msg.author.id}`;
  const levels = loadLevels();
  if (!levels[lvlKey]) levels[lvlKey] = { xp: 0, totalMessages: 0, lastXp: 0 };
  const userData = levels[lvlKey];
  userData.totalMessages++;
  if (Date.now() - (userData.lastXp || 0) > 60000) {
    const gained = Math.floor(Math.random() * 11) + 15;
    const oldLevel = getLevelFromXp(userData.xp);
    userData.xp += gained;
    userData.lastXp = Date.now();
    const newLevel = getLevelFromXp(userData.xp);
    if (newLevel > oldLevel) {
      const lvlCh = s.levelChannel ? msg.guild.channels.cache.get(s.levelChannel) : msg.channel;
      if (lvlCh) lvlCh.send({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`🎉 ${msg.author} est passe **niveau ${newLevel}** !`)] }).catch(() => {});
    }
  }
  saveLevels(levels);
});

// Starboard
client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
  if (reaction.emoji.name !== '⭐' || !reaction.message.guild) return;
  const s = getGuildSettings(reaction.message.guild.id);
  if (!s.starboardChannel) return;
  const min = s.starboardMin || 3;
  if (reaction.count < min) return;
  const cacheKey = `${reaction.message.guild.id}-${reaction.message.id}`;
  if (starboardCache.has(cacheKey)) return;
  starboardCache.add(cacheKey);
  const ch = reaction.message.guild.channels.cache.get(s.starboardChannel);
  if (!ch) return;
  const msg = reaction.message;
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
    .setDescription(msg.content || '*pas de texte*')
    .addFields({ name: 'Source', value: `[Aller au message](${msg.url})` })
    .setFooter({ text: `⭐ ${reaction.count}` })
    .setTimestamp(msg.createdTimestamp);
  if (msg.attachments.first()) embed.setImage(msg.attachments.first().url);
  ch.send({ embeds: [embed] }).catch(() => {});
});

// ─── Interactions ─────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {

  // ─── Boutons tickets ─────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
    if (existing) return interaction.reply({ content: `Tu as deja un ticket ouvert : ${existing}`, ephemeral: true });
    try {
      const ch = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ],
      });
      const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close_btn').setLabel('Fermer le ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger));
      await ch.send({ content: `${interaction.user}`, embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setTitle('Ticket ouvert').setDescription('Decris ton probleme ici. Un moderateur te repondra bientot.\nClique sur le bouton ci-dessous pour fermer le ticket.')], components: [closeRow] });
      await interaction.reply({ content: `Ticket cree : ${ch}`, ephemeral: true });
    } catch (err) { console.error(err); await interaction.reply({ content: 'Erreur lors de la creation du ticket.', ephemeral: true }); }
    return;
  }

  if (interaction.isButton() && interaction.customId === 'ticket_close_btn') {
    if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: 'Ce n\'est pas un ticket.', ephemeral: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Ticket ferme. Suppression dans 5 secondes...')] });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    return;
  }

  // ─── Boutons reaction roles ─────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('role_')) {
    const roleId = interaction.customId.replace('role_', '');
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) return interaction.reply({ content: 'Ce role n\'existe plus.', ephemeral: true });
    try {
      if (interaction.member.roles.cache.has(roleId)) {
        await interaction.member.roles.remove(role);
        await interaction.reply({ content: `Role **${role.name}** retire.`, ephemeral: true });
      } else {
        await interaction.member.roles.add(role);
        await interaction.reply({ content: `Role **${role.name}** ajoute !`, ephemeral: true });
      }
    } catch { await interaction.reply({ content: 'Impossible de modifier ce role.', ephemeral: true }); }
    return;
  }

  // ─── Boutons suggestions ────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('suggest_')) {
    const [, action, msgId] = interaction.customId.split('_');
    try {
      const msg = await interaction.channel.messages.fetch(msgId);
      const embed = EmbedBuilder.from(msg.embeds[0]);
      const existingField = embed.data.fields?.find(f => f.name === 'Votes');
      let up = 0, down = 0;
      if (existingField) {
        const match = existingField.value.match(/(\d+).*?(\d+)/);
        if (match) { up = parseInt(match[1]); down = parseInt(match[2]); }
      }
      if (action === 'up') up++; else down++;
      const fields = (embed.data.fields || []).filter(f => f.name !== 'Votes');
      fields.push({ name: 'Votes', value: `👍 ${up} | 👎 ${down}`, inline: true });
      embed.setFields(fields);
      await msg.edit({ embeds: [embed] });
      await interaction.deferUpdate();
    } catch { await interaction.deferUpdate(); }
    return;
  }

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
          '```',
          '   200+ fonctionnalites  ┃  100 commandes slash',
          '```',
          '',
          '🎵  **Musique**  ━  Lecture, recherche, playlists',
          '📋  **File d\'attente**  ━  Queue, shuffle, move',
          '🎛️  **Controles**  ━  Volume, loop, 24/7, boutons',
          '🎮  **Mini-jeux**  ━  Blackjack, morpion, trivia',
          '😂  **Fun**  ━  Social, profils, texte',
          '🛡️  **Moderation**  ━  Ban, kick, mute, snipe, nuke',
          '🔧  **Serveur**  ━  Salons, roles, slowmode',
          '⚙️  **Config**  ━  Logs, bienvenue, autorole',
          '🎉  **Giveaway**  ━  Creer et gerer',
          '🎫  **Tickets**  ━  Support prive',
          '⭐  **Niveaux**  ━  XP, rank, starboard',
          '💡  **Social**  ━  Suggestions, reaction roles',
          '🤖  **Auto-mod**  ━  Anti-spam, caps, mots',
          '💰  **Economie**  ━  Daily, shop, banque',
          '🧰  **Utilitaires**  ━  Avatar, poll, timer, AFK',
          '📊  **Infos**  ━  Membres, serveur, ping',
          '🔨  **Gestion**  ━  Channel, role, voice, emoji',
        ].join('\n'),
        fields: [],
      },
      music: {
        title: '🎵  Musique',
        color: COLORS.MUSIC,
        description: [
          '> Commandes de lecture musicale YouTube',
          '',
          '▸ `/play <recherche ou URL>` — Jouer une musique, playlist ou lien',
          '▸ `/search <recherche>` — Choisir parmi **5 resultats** YouTube',
          '▸ `/playlist <recherche ou URL>` — Charger une **playlist entiere**',
          '▸ `/pause` ┃ `/resume` — Mettre en pause / reprendre',
          '▸ `/stop` — Arreter et deconnecter le bot',
          '▸ `/replay` — Relancer la piste depuis le debut',
          '▸ `/previous` — Piste precedente (historique 50)',
        ].join('\n'),
        fields: [],
      },
      queue: {
        title: '📋  File d\'attente',
        color: COLORS.QUEUE,
        description: [
          '> Gestion de la file d\'attente',
          '',
          '▸ `/queue [page]` — Afficher la file (10/page)',
          '▸ `/skip` — Piste suivante',
          '▸ `/skipto <position>` — Sauter a une position',
          '▸ `/remove <position>` — Retirer une piste',
          '▸ `/move <de> <vers>` — Deplacer une piste',
          '▸ `/shuffle` — Melanger la file',
          '▸ `/clear` — Vider (garde la piste en cours)',
        ].join('\n'),
        fields: [],
      },
      controls: {
        title: '🎛️  Controles',
        color: 0x9b59b6,
        description: [
          '> Volume, boucle, boutons du lecteur',
          '',
          '▸ `/volume <0-100>` — Barre visuelle, boutons ±10%',
          '▸ `/loop` — Cycle : **Off** → **Piste** 🔁 → **File** 🔂',
          '▸ `/nowplaying` — Piste en cours + boutons',
          '▸ `/247` — Rester connecte en permanence',
          '',
          '```',
          '╔══════════ BOUTONS DU LECTEUR ══════════╗',
          '║  ⏸️ Pause  ⏮️ Prec  ⏭️ Suiv  ⏹️ Stop  🔁 Loop  ║',
          '║  🔉 Vol-   🔊 Vol+  🔀 Shuf  🔄 Redo  🟢 24/7  ║',
          '╚═════════════════════════════════════════╝',
          '```',
        ].join('\n'),
        fields: [],
      },
      moderation: {
        title: '🛡️ Moderation',
        color: COLORS.STOP,
        fields: [
          { name: '`/ban <membre> [raison] [supprimer]`', value: 'Bannit un membre. Option de supprimer ses messages (0-7 jours).' },
          { name: '`/unban <id>` / `/banlist`', value: 'Debannit par ID ou affiche la liste des bannis.' },
          { name: '`/kick <membre> [raison]`', value: 'Expulse un membre du serveur.' },
          { name: '`/mute <membre> <duree> [raison]`', value: 'Timeout Discord (max 28j). Exemples : `10m`, `1h`, `1d`, `1w`.' },
          { name: '`/unmute <membre>`', value: 'Retire le timeout d\'un membre.' },
          { name: '`/warn` / `/warnings` / `/clearwarnings`', value: 'Systeme d\'avertissements persistent. Ajouter, consulter, ou effacer les warns.' },
          { name: '`/purge <1-100> [membre]`', value: 'Suppression de messages en masse. Option de filtrer par membre.' },
          { name: '`/snipe`', value: 'Affiche le dernier message supprime dans le salon.' },
          { name: '`/editsnipe`', value: 'Affiche le dernier message modifie (avant/apres).' },
          { name: '`/nuke`', value: 'Recree le salon de zero (supprime tous les messages). Demande confirmation.' },
        ],
      },
      server: {
        title: '🔧 Gestion serveur',
        color: 0xe67e22,
        fields: [
          { name: '`/slowmode <secondes> [salon]`', value: 'Mode lent. Mettre 0 pour desactiver.' },
          { name: '`/lock [salon] [raison]`', value: 'Verrouille un salon (@everyone ne peut plus ecrire).' },
          { name: '`/unlock [salon]`', value: 'Deverrouille un salon.' },
          { name: '`/nick <membre> [pseudo]`', value: 'Change le pseudo. Vide = reinitialiser.' },
          { name: '`/addrole` / `/removerole`', value: 'Ajouter ou retirer un role a un membre.' },
          { name: '`/announce <titre> <message> [salon] [couleur]`', value: 'Envoie une annonce embed.' },
        ],
      },
      config: {
        title: '⚙️ Configuration',
        color: 0x1abc9c,
        fields: [
          { name: '`/setlog [salon]`', value: 'Definit le salon de logs de moderation. Sans salon = desactiver.' },
          { name: '`/setwelcome [salon] [message]`', value: 'Configure les messages de bienvenue. Variables : `{user}` `{server}` `{count}`.' },
          { name: '`/setleave [salon] [message]`', value: 'Configure les messages de depart. Memes variables que welcome.' },
          { name: '`/autorole [role]`', value: 'Role attribue automatiquement aux nouveaux membres. Sans role = desactiver.' },
          { name: '`/antilink`', value: 'Active/desactive la suppression automatique des liens (les moderateurs sont exempts).' },
        ],
      },
      giveaway: {
        title: '🎉 Giveaway',
        color: 0xf1c40f,
        fields: [
          { name: '`/giveaway <prix> <duree> [gagnants]`', value: 'Lance un giveaway. Les membres reagissent avec 🎉 pour participer. Le/les gagnant(s) sont tires au sort a la fin.' },
          { name: '`/giveaway-reroll <id>`', value: 'Relance le tirage d\'un giveaway termine. L\'ID est l\'identifiant du message du giveaway.' },
        ],
      },
      tickets: {
        title: '🎫 Tickets',
        color: 0x3498db,
        fields: [
          { name: '`/ticket-setup [description]`', value: 'Cree un panneau avec un bouton "Ouvrir un ticket". Chaque membre peut ouvrir un salon prive de support.' },
          { name: '`/ticket-close`', value: 'Ferme le ticket actuel. Aussi possible via le bouton 🔒 dans le ticket.' },
        ],
      },
      levels: {
        title: '⭐ Niveaux, XP & Starboard',
        color: 0xf1c40f,
        fields: [
          { name: '`/rank [membre]`', value: 'Affiche le niveau, XP, classement, nombre de messages et barre de progression.' },
          { name: '`/leaderboard`', value: 'Top 10 des membres les plus actifs du serveur.' },
          { name: '`/setlevelchannel [salon]`', value: 'Definit le salon pour les annonces de level-up. Sans salon = annonce dans le meme salon.' },
          { name: '`/setstarboard [salon] [minimum]`', value: 'Quand un message recoit X ⭐, il est poste dans le salon starboard. Defaut : 3 etoiles minimum.' },
          { name: 'Comment ca marche ?', value: 'Chaque message donne 15-25 XP (cooldown 60s). La formule de niveau est progressive : plus tu montes, plus il faut d\'XP.' },
        ],
      },
      social: {
        title: '💡 Suggestions & Reaction Roles',
        color: 0x9b59b6,
        fields: [
          { name: '`/suggest <idee>`', value: 'Soumet une suggestion avec boutons 👍/👎 pour voter.' },
          { name: '`/setsuggestions [salon]`', value: 'Definit le salon des suggestions.' },
          { name: '`/roleboard <titre> <@roles>`', value: 'Cree un panneau avec des boutons pour s\'attribuer des roles. Mentionne les roles dans la commande. Clique = ajoute, re-clique = retire.' },
        ],
      },
      automod: {
        title: '🤖 Auto-moderation',
        color: 0xe74c3c,
        fields: [
          { name: '`/antispam`', value: 'Active/desactive. 5+ messages en 5 secondes = mute 1 minute. Les moderateurs sont exempts.' },
          { name: '`/anticaps`', value: 'Active/desactive. Messages avec >70% de majuscules (min 10 caracteres) = supprimes.' },
          { name: '`/antilink`', value: 'Active/desactive. Supprime les liens (http, discord.gg). Moderateurs exempts.' },
          { name: '`/addword <mot>`', value: 'Ajoute un mot au filtre. Les messages contenant ce mot seront supprimes.' },
          { name: '`/removeword <mot>` / `/wordlist`', value: 'Retire un mot ou affiche la liste des mots filtres.' },
          { name: '`/setdj [role]`', value: 'Seuls les membres avec ce role peuvent utiliser les commandes musique. Sans role = tout le monde.' },
        ],
      },
      utils: {
        title: '🧰 Utilitaires',
        color: 0x3498db,
        fields: [
          { name: '`/avatar [membre]`', value: 'Affiche l\'avatar en haute resolution.' },
          { name: '`/banner [membre]`', value: 'Affiche la banniere de profil.' },
          { name: '`/poll <question> <options>`', value: 'Cree un sondage avec reactions. Options separees par `|` (max 10).' },
          { name: '`/timer <duree> <message>`', value: 'Programme un rappel (max 24h). Tu seras mentionne.' },
          { name: '`/embed <titre> <description> [couleur] [image] [footer] [salon]`', value: 'Cree un embed personnalise complet.' },
          { name: '`/afk [raison]`', value: 'Te met en AFK. Quand quelqu\'un te mentionne, le bot le previent. Tu sors de l\'AFK en envoyant un message.' },
          { name: '`/invites [membre]`', value: 'Nombre d\'invitations d\'un membre (liens et utilisations).' },
        ],
      },
      info: {
        title: '📊 Informations',
        color: 0x3498db,
        fields: [
          { name: '`/userinfo [membre]`', value: 'Infos d\'un membre : ID, dates, pseudo, roles, statut mute.' },
          { name: '`/serverinfo`', value: 'Infos du serveur : proprietaire, membres, roles, salons, boosts.' },
          { name: '`/roleinfo <role>`', value: 'Infos d\'un role : couleur, membres, position, date de creation.' },
          { name: '`/membercount`', value: 'Nombre de membres, humains, et bots.' },
          { name: '`/ping`', value: 'Latence du bot et de l\'API Discord.' },
          { name: '`/uptime`', value: 'Depuis combien de temps le bot est en ligne.' },
          { name: '`/help`', value: 'Affiche ce menu d\'aide interactif.' },
        ],
      },
    };

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Choisis une categorie...')
      .addOptions(
        { label: 'Accueil', description: 'Vue d\'ensemble', value: 'home', emoji: '📖' },
        { label: 'Musique', description: 'Play, search, playlist, replay...', value: 'music', emoji: '🎵' },
        { label: 'File d\'attente', description: 'Queue, skip, shuffle, move...', value: 'queue', emoji: '📋' },
        { label: 'Controles', description: 'Volume, loop, 24/7, boutons...', value: 'controls', emoji: '🎛️' },
        { label: 'Moderation', description: 'Ban, kick, mute, snipe, nuke...', value: 'moderation', emoji: '🛡️' },
        { label: 'Gestion serveur', description: 'Lock, slowmode, roles...', value: 'server', emoji: '🔧' },
        { label: 'Configuration', description: 'Logs, bienvenue, autorole...', value: 'config', emoji: '⚙️' },
        { label: 'Giveaway', description: 'Creer et gerer des giveaways', value: 'giveaway', emoji: '🎉' },
        { label: 'Tickets', description: 'Support par tickets prives', value: 'tickets', emoji: '🎫' },
        { label: 'Niveaux & Starboard', description: 'XP, rank, leaderboard...', value: 'levels', emoji: '⭐' },
        { label: 'Suggestions & Roles', description: 'Idees, reaction roles...', value: 'social', emoji: '💡' },
        { label: 'Auto-moderation', description: 'Spam, caps, mots, DJ...', value: 'automod', emoji: '🤖' },
        { label: 'Utilitaires', description: 'Avatar, poll, AFK, invites...', value: 'utils', emoji: '🧰' },
        { label: 'Informations', description: 'Userinfo, ping, uptime...', value: 'info', emoji: '📊' },
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

  // ─── Moderation ─────────────────────────────────────────────────────

  else if (commandName === 'ban') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
    const deletedays = interaction.options.getInteger('supprimer') || 0;

    if (target && !target.bannable) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Je ne peux pas bannir ce membre (role trop eleve).')],
        ephemeral: true,
      });
    }

    try {
      await guild.members.ban(user.id, { deleteMessageDays: deletedays, reason: raison });
      const banEmbed = new EmbedBuilder()
        .setColor(COLORS.STOP)
        .setTitle('Membre banni')
        .addFields(
          { name: 'Utilisateur', value: `${user.tag}`, inline: true },
          { name: 'Moderateur', value: `${member.user.tag}`, inline: true },
          { name: 'Raison', value: raison },
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();
      await interaction.reply({ embeds: [banEmbed] });
      sendModLog(guild, banEmbed);
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du ban.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'unban') {
    const userId = interaction.options.getString('id');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    try {
      const banInfo = await guild.bans.fetch(userId);
      await guild.members.unban(userId, raison);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.PLAY)
          .setTitle('Utilisateur debanni')
          .addFields(
            { name: 'Utilisateur', value: `${banInfo.user.tag}`, inline: true },
            { name: 'Moderateur', value: `${member.user.tag}`, inline: true },
            { name: 'Raison', value: raison },
          )],
      });
    } catch {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Utilisateur introuvable dans la liste des bans.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'kick') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    if (!target) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Ce membre n\'est pas sur le serveur.')],
        ephemeral: true,
      });
    }

    if (!target.kickable) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Je ne peux pas expulser ce membre (role trop eleve).')],
        ephemeral: true,
      });
    }

    try {
      await target.kick(raison);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff9900)
          .setTitle('Membre expulse')
          .addFields(
            { name: 'Utilisateur', value: `${user.tag}`, inline: true },
            { name: 'Moderateur', value: `${member.user.tag}`, inline: true },
            { name: 'Raison', value: raison },
          )
          .setThumbnail(user.displayAvatarURL())],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors de l\'expulsion.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'mute') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');
    const dureeStr = interaction.options.getString('duree');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    if (!target) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Membre introuvable.')],
        ephemeral: true,
      });
    }

    if (!target.moderatable) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Je ne peux pas mute ce membre (role trop eleve).')],
        ephemeral: true,
      });
    }

    const ms = parseDuration(dureeStr);
    if (!ms || ms > 28 * 24 * 3600 * 1000) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Duree invalide. Exemples : `10m`, `1h`, `1d`, `1w`. Max : 28 jours.')],
        ephemeral: true,
      });
    }

    try {
      await target.timeout(ms, raison);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.WARN)
          .setTitle('Membre rendu muet')
          .addFields(
            { name: 'Utilisateur', value: `${user.tag}`, inline: true },
            { name: 'Duree', value: dureeStr, inline: true },
            { name: 'Moderateur', value: `${member.user.tag}`, inline: true },
            { name: 'Raison', value: raison },
          )
          .setThumbnail(user.displayAvatarURL())],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du mute.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'unmute') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');

    if (!target) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Membre introuvable.')],
        ephemeral: true,
      });
    }

    try {
      await target.timeout(null);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.PLAY)
          .setDescription(`**${user.tag}** n'est plus muet.`)],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du unmute.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'warn') {
    const user = interaction.options.getUser('membre');
    const raison = interaction.options.getString('raison');
    const warnings = loadWarnings();
    const key = `${guild.id}-${user.id}`;

    if (!warnings[key]) warnings[key] = [];
    warnings[key].push({
      raison,
      par: member.user.tag,
      date: new Date().toISOString(),
    });
    saveWarnings(warnings);

    const count = warnings[key].length;
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.WARN)
        .setTitle('Avertissement')
        .addFields(
          { name: 'Utilisateur', value: `${user.tag}`, inline: true },
          { name: 'Avertissements', value: `${count}`, inline: true },
          { name: 'Moderateur', value: `${member.user.tag}`, inline: true },
          { name: 'Raison', value: raison },
        )
        .setThumbnail(user.displayAvatarURL())],
    });
  }

  else if (commandName === 'warnings') {
    const user = interaction.options.getUser('membre');
    const warnings = loadWarnings();
    const key = `${guild.id}-${user.id}`;
    const list = warnings[key] || [];

    if (!list.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`**${user.tag}** n'a aucun avertissement.`)],
      });
    }

    const desc = list.map((w, i) => {
      const date = new Date(w.date).toLocaleDateString('fr-FR');
      return `**${i + 1}.** ${w.raison}\n   Par ${w.par} — ${date}`;
    }).join('\n\n');

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.WARN)
        .setTitle(`Avertissements de ${user.tag} (${list.length})`)
        .setDescription(desc)
        .setThumbnail(user.displayAvatarURL())],
    });
  }

  else if (commandName === 'clearwarnings') {
    const user = interaction.options.getUser('membre');
    const warnings = loadWarnings();
    const key = `${guild.id}-${user.id}`;
    const count = (warnings[key] || []).length;
    delete warnings[key];
    saveWarnings(warnings);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.PLAY)
        .setDescription(`${count} avertissement(s) efface(s) pour **${user.tag}**.`)],
    });
  }

  else if (commandName === 'purge') {
    const nombre = interaction.options.getInteger('nombre');
    const targetUser = interaction.options.getUser('membre');

    await interaction.deferReply({ ephemeral: true });

    try {
      let messages = await channel.messages.fetch({ limit: targetUser ? 100 : nombre });
      if (targetUser) {
        messages = messages.filter(m => m.author.id === targetUser.id);
        messages = Array.from(messages.values()).slice(0, nombre);
      }

      const deleted = await channel.bulkDelete(messages, true);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setDescription(`${deleted.size} message(s) supprime(s).${targetUser ? ` (de ${targetUser.tag})` : ''}`)],
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur. Les messages de plus de 14 jours ne peuvent pas etre supprimes en masse.')],
      });
    }
  }

  else if (commandName === 'slowmode') {
    const secondes = interaction.options.getInteger('secondes');
    const targetChannel = interaction.options.getChannel('salon') || channel;

    try {
      await targetChannel.setRateLimitPerUser(secondes);
      const desc = secondes === 0
        ? `Mode lent desactive dans ${targetChannel}.`
        : `Mode lent defini a **${secondes}s** dans ${targetChannel}.`;
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(desc)],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du changement de slowmode.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'lock') {
    const targetChannel = interaction.options.getChannel('salon') || channel;
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    try {
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false,
      });
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.STOP)
          .setDescription(`${targetChannel} est verrouille.`)
          .addFields({ name: 'Raison', value: raison })],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du verrouillage.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'unlock') {
    const targetChannel = interaction.options.getChannel('salon') || channel;

    try {
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null,
      });
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`${targetChannel} est deverrouille.`)],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du deverrouillage.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'nick') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');
    const pseudo = interaction.options.getString('pseudo') || null;

    if (!target) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Membre introuvable.')],
        ephemeral: true,
      });
    }

    try {
      await target.setNickname(pseudo);
      const desc = pseudo
        ? `Pseudo de **${user.tag}** change en **${pseudo}**.`
        : `Pseudo de **${user.tag}** reinitialise.`;
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(desc)],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Impossible de changer le pseudo (role trop eleve).')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'addrole') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');
    const role = interaction.options.getRole('role');

    if (!target) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Membre introuvable.')],
        ephemeral: true,
      });
    }

    if (role.position >= guild.members.me.roles.highest.position) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Ce role est trop eleve pour que je puisse l\'attribuer.')],
        ephemeral: true,
      });
    }

    try {
      await target.roles.add(role);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.PLAY)
          .setDescription(`Role ${role} ajoute a **${user.tag}**.`)],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors de l\'ajout du role.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'removerole') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');
    const role = interaction.options.getRole('role');

    if (!target) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Membre introuvable.')],
        ephemeral: true,
      });
    }

    if (role.position >= guild.members.me.roles.highest.position) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Ce role est trop eleve pour que je puisse le retirer.')],
        ephemeral: true,
      });
    }

    try {
      await target.roles.remove(role);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff9900)
          .setDescription(`Role ${role} retire de **${user.tag}**.`)],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du retrait du role.')],
        ephemeral: true,
      });
    }
  }

  else if (commandName === 'banlist') {
    try {
      const bans = await guild.bans.fetch();
      if (!bans.size) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('Aucun membre banni.')],
        });
      }

      const list = bans.first(20).map(b =>
        `**${b.user.tag}** (${b.user.id})${b.reason ? ` — ${b.reason}` : ''}`
      ).join('\n');

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.STOP)
          .setTitle(`Membres bannis (${bans.size})`)
          .setDescription(list + (bans.size > 20 ? `\n*...et ${bans.size - 20} autres*` : ''))],
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors de la recuperation des bans.')],
        ephemeral: true,
      });
    }
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

  else if (commandName === 'announce') {
    const titre = interaction.options.getString('titre');
    const message = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('salon') || channel;
    const couleur = interaction.options.getString('couleur');

    let color = COLORS.INFO;
    if (couleur) {
      const hex = couleur.replace('#', '');
      const parsed = parseInt(hex, 16);
      if (!isNaN(parsed)) color = parsed;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(titre)
      .setDescription(message)
      .setFooter({ text: `Annonce par ${member.user.tag}` })
      .setTimestamp();

    try {
      await targetChannel.send({ embeds: [embed] });
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Annonce envoyee dans ${targetChannel}.`)],
        ephemeral: true,
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors de l\'envoi de l\'annonce.')],
        ephemeral: true,
      });
    }
  }

  // ─── Utilitaires ────────────────────────────────────────────────────

  else if (commandName === 'ping') {
    const sent = await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription('Calcul...')], fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('Pong !').addFields(
        { name: 'Latence bot', value: `${latency}ms`, inline: true },
        { name: 'Latence API', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      )],
    });
  }

  else if (commandName === 'uptime') {
    const up = Date.now() - startTime;
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`En ligne depuis **${formatUptime(up)}**`)],
    });
  }

  else if (commandName === 'avatar') {
    const user = interaction.options.getUser('membre') || interaction.user;
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`Avatar de ${user.tag}`)
      .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
      .setFooter({ text: `ID: ${user.id}` });
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'banner') {
    const user = interaction.options.getUser('membre') || interaction.user;
    const fetched = await client.users.fetch(user.id, { force: true });
    const bannerUrl = fetched.bannerURL({ size: 1024, dynamic: true });
    if (!bannerUrl) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`**${user.tag}** n'a pas de banniere.`)], ephemeral: true });
    }
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle(`Banniere de ${user.tag}`).setImage(bannerUrl)],
    });
  }

  else if (commandName === 'roleinfo') {
    const role = interaction.options.getRole('role');
    const embed = new EmbedBuilder()
      .setColor(role.color || COLORS.INFO)
      .setTitle(`Role : ${role.name}`)
      .addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Couleur', value: role.hexColor, inline: true },
        { name: 'Membres', value: `${role.members.size}`, inline: true },
        { name: 'Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
        { name: 'Position', value: `${role.position}`, inline: true },
        { name: 'Cree le', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
      );
    if (role.icon) embed.setThumbnail(role.iconURL({ size: 128 }));
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'membercount') {
    const g = guild;
    const total = g.memberCount;
    const bots = g.members.cache.filter(m => m.user.bot).size;
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle(g.name).addFields(
        { name: 'Total', value: `${total}`, inline: true },
        { name: 'Humains', value: `~${total - bots}`, inline: true },
        { name: 'Bots', value: `${bots}`, inline: true },
      ).setThumbnail(g.iconURL({ size: 128 }))],
    });
  }

  else if (commandName === 'poll') {
    const question = interaction.options.getString('question');
    const optionsStr = interaction.options.getString('options');
    const opts = optionsStr.split('|').map(o => o.trim()).filter(Boolean).slice(0, 10);
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

    const desc = opts.map((o, i) => `${emojis[i]} ${o}`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${question}`)
      .setDescription(desc)
      .setFooter({ text: `Sondage par ${member.user.tag}` })
      .setTimestamp();

    const msg = await channel.send({ embeds: [embed] });
    for (let i = 0; i < opts.length; i++) await msg.react(emojis[i]);
    await interaction.reply({ content: 'Sondage cree !', ephemeral: true });
  }

  else if (commandName === 'timer') {
    const dureeStr = interaction.options.getString('duree');
    const message = interaction.options.getString('message');
    const ms = parseDuration(dureeStr);
    if (!ms || ms > 24 * 3600 * 1000) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Duree invalide. Max: 24h. Exemples : `10m`, `1h`, `2h`.')], ephemeral: true });
    }
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Rappel programme dans **${dureeStr}** : ${message}`)],
    });
    setTimeout(() => {
      channel.send({
        content: `${interaction.user}`,
        embeds: [new EmbedBuilder().setColor(COLORS.WARN).setTitle('Rappel !').setDescription(message).setTimestamp()],
      }).catch(() => {});
    }, ms);
  }

  else if (commandName === 'embed') {
    const titre = interaction.options.getString('titre');
    const description = interaction.options.getString('description');
    const couleur = interaction.options.getString('couleur');
    const image = interaction.options.getString('image');
    const footer = interaction.options.getString('footer');
    const targetChannel = interaction.options.getChannel('salon') || channel;

    let color = COLORS.INFO;
    if (couleur) { const p = parseInt(couleur.replace('#', ''), 16); if (!isNaN(p)) color = p; }

    const embed = new EmbedBuilder().setColor(color).setTitle(titre).setDescription(description);
    if (image) embed.setImage(image);
    if (footer) embed.setFooter({ text: footer });
    embed.setTimestamp();

    await targetChannel.send({ embeds: [embed] });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Embed envoye dans ${targetChannel}.`)], ephemeral: true });
  }

  else if (commandName === 'snipe') {
    const data = snipes.get(channel.id);
    if (!data) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Aucun message supprime recemment.')], ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(COLORS.STOP)
      .setAuthor({ name: data.author, iconURL: data.avatar })
      .setDescription(data.content || '*pas de contenu texte*')
      .setFooter({ text: `Supprime` })
      .setTimestamp(data.time);
    if (data.attachments) embed.setImage(data.attachments);
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'editsnipe') {
    const data = editSnipes.get(channel.id);
    if (!data) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Aucun message modifie recemment.')], ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(COLORS.WARN)
      .setAuthor({ name: data.author, iconURL: data.avatar })
      .addFields(
        { name: 'Avant', value: data.oldContent || '*vide*' },
        { name: 'Apres', value: data.newContent || '*vide*' },
      )
      .setFooter({ text: 'Modifie' })
      .setTimestamp(data.time);
    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'nuke') {
    const embed = new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Es-tu sur de vouloir **supprimer tous les messages** de ${channel} ? Cette action est irreversible.`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('nuke_confirm').setLabel('Confirmer').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('nuke_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    );
    const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = reply.createMessageComponentCollector({ time: 15_000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: 'Ce n\'est pas ton bouton.', ephemeral: true });
      if (i.customId === 'nuke_cancel') return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('Nuke annule.')], components: [] });
      if (i.customId === 'nuke_confirm') {
        const pos = channel.position;
        const newCh = await channel.clone();
        await channel.delete();
        await newCh.setPosition(pos);
        await newCh.send({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('Salon recree avec succes.').setTimestamp()] });
      }
    });
    collector.on('end', (_, reason) => { if (reason === 'time') reply.edit({ components: [] }).catch(() => {}); });
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

  // ─── Configuration ──────────────────────────────────────────────────

  else if (commandName === 'setlog') {
    const ch = interaction.options.getChannel('salon');
    setGuildSetting(guild.id, 'logChannel', ch?.id || null);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(ch ? `Salon de logs defini : ${ch}` : 'Logs de moderation desactives.')],
    });
  }

  else if (commandName === 'setwelcome') {
    const ch = interaction.options.getChannel('salon');
    const msg = interaction.options.getString('message');
    setGuildSetting(guild.id, 'welcomeChannel', ch?.id || null);
    if (msg) setGuildSetting(guild.id, 'welcomeMessage', msg);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(
        ch ? `Bienvenue configure dans ${ch}.\nVariables : \`{user}\` \`{server}\` \`{count}\`` : 'Messages de bienvenue desactives.'
      )],
    });
  }

  else if (commandName === 'setleave') {
    const ch = interaction.options.getChannel('salon');
    const msg = interaction.options.getString('message');
    setGuildSetting(guild.id, 'leaveChannel', ch?.id || null);
    if (msg) setGuildSetting(guild.id, 'leaveMessage', msg);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(
        ch ? `Depart configure dans ${ch}.\nVariables : \`{user}\` \`{server}\` \`{count}\`` : 'Messages de depart desactives.'
      )],
    });
  }

  else if (commandName === 'autorole') {
    const role = interaction.options.getRole('role');
    setGuildSetting(guild.id, 'autorole', role?.id || null);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(role ? `Autorole defini : ${role}. Les nouveaux membres recevront ce role automatiquement.` : 'Autorole desactive.')],
    });
  }

  else if (commandName === 'antilink') {
    const s = getGuildSettings(guild.id);
    const newVal = !s.antilink;
    setGuildSetting(guild.id, 'antilink', newVal);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(newVal ? COLORS.PLAY : COLORS.WARN)
        .setDescription(newVal ? 'Antilink active. Les liens seront automatiquement supprimes (sauf pour les moderateurs).' : 'Antilink desactive.')],
    });
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

  // ─── Tickets ────────────────────────────────────────────────────────

  else if (commandName === 'ticket-setup') {
    const desc = interaction.options.getString('description') || 'Clique sur le bouton ci-dessous pour ouvrir un ticket de support.';
    const embed = new EmbedBuilder().setColor(COLORS.INFO).setTitle('🎫 Support — Tickets').setDescription(desc);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_open').setLabel('Ouvrir un ticket').setEmoji('📩').setStyle(ButtonStyle.Primary));
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Panneau de tickets cree !', ephemeral: true });
  }

  else if (commandName === 'ticket-close') {
    if (!channel.name.startsWith('ticket-')) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Ce salon n\'est pas un ticket.')], ephemeral: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Ticket ferme. Suppression dans 5 secondes...')] });
    setTimeout(() => channel.delete().catch(() => {}), 5000);
  }

  // ─── Niveaux / XP ──────────────────────────────────────────────────

  else if (commandName === 'rank') {
    const user = interaction.options.getUser('membre') || interaction.user;
    const levels = loadLevels();
    const key = `${guild.id}-${user.id}`;
    const data = levels[key] || { xp: 0, totalMessages: 0 };
    const level = getLevelFromXp(data.xp);
    const currentLevelXp = getTotalXpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);
    const progress = data.xp - currentLevelXp;
    const pct = Math.floor((progress / nextLevelXp) * 100);
    const fill = Math.floor(pct / 5);
    const bar = '▰'.repeat(fill) + '▱'.repeat(20 - fill);

    const allUsers = Object.entries(levels).filter(([k]) => k.startsWith(guild.id)).sort((a, b) => b[1].xp - a[1].xp);
    const rankPos = allUsers.findIndex(([k]) => k === key) + 1;

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.LEVEL)
        .setAuthor({ name: `Carte de rang — ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription([
          '',
          `> ⭐  **Niveau ${level}**  ┃  🏆  **#${rankPos || '?'}**`,
          '',
          `> ${bar}  \`${pct}%\``,
          `> \`${progress.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP\``,
          '',
        ].join('\n'))
        .addFields(
          { name: '✨ XP Total', value: `\`${data.xp.toLocaleString()}\``, inline: true },
          { name: '💬 Messages', value: `\`${data.totalMessages.toLocaleString()}\``, inline: true },
          { name: '📊 Classement', value: `\`#${rankPos || '?'} / ${allUsers.length}\``, inline: true },
        )
        .setFooter(BOT_FOOTER)
        .setTimestamp()],
    });
  }

  else if (commandName === 'leaderboard') {
    const levels = loadLevels();
    const sorted = Object.entries(levels).filter(([k]) => k.startsWith(guild.id)).sort((a, b) => b[1].xp - a[1].xp).slice(0, 10);
    if (!sorted.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Aucune donnee de niveau.')], ephemeral: true });

    const desc = await Promise.all(sorted.map(async ([key, data], i) => {
      const userId = key.split('-')[1];
      const u = await client.users.fetch(userId).catch(() => null);
      const lvl = getLevelFromXp(data.xp);
      const medal = ['🥇','🥈','🥉'][i] || `**${i + 1}.**`;
      return `${medal} ${u?.tag || 'Inconnu'} — Niv. **${lvl}** (${data.xp} XP)`;
    }));

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🏆 Classement').setDescription(desc.join('\n'))],
    });
  }

  else if (commandName === 'setlevelchannel') {
    const ch = interaction.options.getChannel('salon');
    setGuildSetting(guild.id, 'levelChannel', ch?.id || null);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(ch ? `Annonces de level-up dans ${ch}.` : 'Annonces de level-up dans le salon du message.')] });
  }

  // ─── Starboard ──────────────────────────────────────────────────────

  else if (commandName === 'setstarboard') {
    const ch = interaction.options.getChannel('salon');
    const min = interaction.options.getInteger('minimum') || 3;
    setGuildSetting(guild.id, 'starboardChannel', ch?.id || null);
    setGuildSetting(guild.id, 'starboardMin', min);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(ch ? `Starboard dans ${ch} (minimum ${min} ⭐).` : 'Starboard desactive.')] });
  }

  // ─── Suggestions ────────────────────────────────────────────────────

  else if (commandName === 'suggest') {
    const s = getGuildSettings(guild.id);
    const targetCh = s.suggestionsChannel ? guild.channels.cache.get(s.suggestionsChannel) : channel;
    if (!targetCh) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucun salon de suggestions configure.')], ephemeral: true });
    const idee = interaction.options.getString('idee');
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('💡 Nouvelle suggestion')
      .setDescription(idee)
      .addFields({ name: 'Votes', value: '👍 0 | 👎 0', inline: true })
      .setFooter({ text: `Par ${member.user.tag}` })
      .setTimestamp();
    const msg = await targetCh.send({ embeds: [embed] });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`suggest_up_${msg.id}`).setEmoji('👍').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`suggest_down_${msg.id}`).setEmoji('👎').setStyle(ButtonStyle.Danger),
    );
    await msg.edit({ components: [row] });
    await interaction.reply({ content: 'Suggestion soumise !', ephemeral: true });
  }

  else if (commandName === 'setsuggestions') {
    const ch = interaction.options.getChannel('salon');
    setGuildSetting(guild.id, 'suggestionsChannel', ch?.id || null);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(ch ? `Suggestions dans ${ch}.` : 'Salon de suggestions desactive.')] });
  }

  // ─── Reaction Roles ─────────────────────────────────────────────────

  else if (commandName === 'roleboard') {
    const titre = interaction.options.getString('titre');
    const rolesStr = interaction.options.getString('roles');
    const roleIds = [...rolesStr.matchAll(/<@&(\d+)>/g)].map(m => m[1]);
    if (!roleIds.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Mentionne au moins un role. Ex: `@Role1, @Role2`')], ephemeral: true });

    const roles = roleIds.map(id => guild.roles.cache.get(id)).filter(Boolean);
    if (!roles.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucun role valide trouve.')], ephemeral: true });

    const desc = roles.map(r => `${r} — Clique pour obtenir/retirer`).join('\n');
    const embed = new EmbedBuilder().setColor(COLORS.INFO).setTitle(titre).setDescription(desc);

    const rows = [];
    for (let i = 0; i < roles.length; i += 5) {
      const row = new ActionRowBuilder();
      roles.slice(i, i + 5).forEach(r => {
        row.addComponents(new ButtonBuilder().setCustomId(`role_${r.id}`).setLabel(r.name).setStyle(ButtonStyle.Primary));
      });
      rows.push(row);
    }

    await channel.send({ embeds: [embed], components: rows });
    await interaction.reply({ content: 'Panneau de roles cree !', ephemeral: true });
  }

  // ─── Auto-mod config ────────────────────────────────────────────────

  else if (commandName === 'antispam') {
    const s = getGuildSettings(guild.id);
    setGuildSetting(guild.id, 'antispam', !s.antispam);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(!s.antispam ? COLORS.PLAY : COLORS.WARN).setDescription(!s.antispam ? 'Anti-spam active. Les spammeurs seront mute 1 min.' : 'Anti-spam desactive.')] });
  }

  else if (commandName === 'anticaps') {
    const s = getGuildSettings(guild.id);
    setGuildSetting(guild.id, 'anticaps', !s.anticaps);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(!s.anticaps ? COLORS.PLAY : COLORS.WARN).setDescription(!s.anticaps ? 'Anti-majuscules active (>70% caps = supprime).' : 'Anti-majuscules desactive.')] });
  }

  else if (commandName === 'addword') {
    const mot = interaction.options.getString('mot').toLowerCase();
    const s = getGuildSettings(guild.id);
    const list = s.wordFilter || [];
    if (list.includes(mot)) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Ce mot est deja dans le filtre.')], ephemeral: true });
    list.push(mot);
    setGuildSetting(guild.id, 'wordFilter', list);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Mot ajoute au filtre. ${list.length} mot(s) filtres.`)] });
  }

  else if (commandName === 'removeword') {
    const mot = interaction.options.getString('mot').toLowerCase();
    const s = getGuildSettings(guild.id);
    const list = (s.wordFilter || []).filter(w => w !== mot);
    setGuildSetting(guild.id, 'wordFilter', list);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Mot retire. ${list.length} mot(s) restants.`)] });
  }

  else if (commandName === 'wordlist') {
    const s = getGuildSettings(guild.id);
    const list = s.wordFilter || [];
    if (!list.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Aucun mot filtre.')], ephemeral: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle(`Mots filtres (${list.length})`).setDescription(list.map(w => `\`${w}\``).join(', '))], ephemeral: true });
  }

  else if (commandName === 'setdj') {
    const role = interaction.options.getRole('role');
    setGuildSetting(guild.id, 'djRole', role?.id || null);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(role ? `Role DJ defini : ${role}. Seuls les membres avec ce role peuvent controler la musique.` : 'Role DJ retire. Tout le monde peut controler la musique.')] });
  }

  // ─── AFK ────────────────────────────────────────────────────────────

  else if (commandName === 'afk') {
    const raison = interaction.options.getString('raison') || 'AFK';
    afkUsers.set(`${guild.id}-${interaction.user.id}`, { reason: raison, since: Date.now() });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`${interaction.user} est maintenant AFK : ${raison}`)] });
  }

  // ─── Invites ────────────────────────────────────────────────────────

  else if (commandName === 'invites') {
    const user = interaction.options.getUser('membre') || interaction.user;
    try {
      const invites = await guild.invites.fetch();
      const userInvites = invites.filter(i => i.inviter?.id === user.id);
      const total = userInvites.reduce((acc, i) => acc + (i.uses || 0), 0);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`**${user.tag}** a invite **${total}** membre(s) avec **${userInvites.size}** lien(s).`).setThumbnail(user.displayAvatarURL())],
      });
    } catch {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Impossible de recuperer les invitations.')], ephemeral: true });
    }
  }

  // ─── Economie ───────────────────────────────────────────────────────

  else if (commandName === 'balance') {
    const user = interaction.options.getUser('membre') || interaction.user;
    const { data } = getEcoUser(guild.id, user.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`💰 **${user.tag}** possede **${data.balance}** pieces.`).setThumbnail(user.displayAvatarURL())] });
  }

  else if (commandName === 'daily') {
    const { eco, key, data } = getEcoUser(guild.id, interaction.user.id);
    const now = Date.now();
    if (now - data.lastDaily < 86400000) {
      const remaining = 86400000 - (now - data.lastDaily);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`Tu as deja reclame ta recompense. Reviens dans **${formatUptime(remaining)}**.`)], ephemeral: true });
    }

    const oldStreak = getDailyStreak(data);
    const diffDays = data.lastDaily ? Math.floor((now - data.lastDaily) / 86400000) : 99;
    const newStreak = diffDays <= 1 ? oldStreak + 1 : 1;
    data.streak = newStreak;

    const baseAmount = Math.floor(Math.random() * 151) + 100;
    const streakBonus = Math.min(newStreak * 10, 200);
    const amount = baseAmount + streakBonus;
    data.balance += amount;
    data.lastDaily = now;
    if (!data.bestStreak || newStreak > data.bestStreak) data.bestStreak = newStreak;
    saveEco(eco);

    const streakBar = '🔥'.repeat(Math.min(newStreak, 10));
    const lines = [
      ``,
      `> 💰  +**${baseAmount}** pieces de base`,
      streakBonus > 0 ? `> 🔥  +**${streakBonus}** bonus de serie (jour ${newStreak})` : null,
      `> ━━━━━━━━━━━━━━━━━━━━`,
      `> 💎  Total : **${amount}** pieces`,
      ``,
      `> Solde : **${data.balance.toLocaleString()}** pieces`,
      newStreak > 1 ? `> Serie : ${streakBar} **${newStreak} jours**` : null,
      data.bestStreak > 1 ? `> Record : **${data.bestStreak} jours**` : null,
    ].filter(Boolean);

    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.ECO).setAuthor({ name: `Recompense quotidienne — ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() }).setDescription(lines.join('\n')).setFooter(BOT_FOOTER).setTimestamp()] });
  }

  else if (commandName === 'work') {
    const { eco, key, data } = getEcoUser(guild.id, interaction.user.id);
    const now = Date.now();
    if (now - data.lastWork < 3600000) {
      const remaining = 3600000 - (now - data.lastWork);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`Tu es fatigue. Reviens dans **${formatUptime(remaining)}**.`)], ephemeral: true });
    }
    const jobs = ['developpeur', 'boulanger', 'streamer', 'livreur', 'musicien', 'artiste', 'jardinier', 'mecanicien', 'professeur', 'cuisinier'];
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const amount = Math.floor(Math.random() * 101) + 50;
    data.balance += amount;
    data.lastWork = now;
    saveEco(eco);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Tu as travaille comme **${job}** et gagne **${amount}** pieces ! Solde : **${data.balance}**`)] });
  }

  else if (commandName === 'pay') {
    const target = interaction.options.getUser('membre');
    const montant = interaction.options.getInteger('montant');
    if (target.id === interaction.user.id) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu ne peux pas te payer toi-meme.')], ephemeral: true });
    const { eco, key, data } = getEcoUser(guild.id, interaction.user.id);
    if (data.balance < montant) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Solde insuffisant. Tu as **${data.balance}** pieces.`)], ephemeral: true });
    const targetKey = `${guild.id}-${target.id}`;
    if (!eco[targetKey]) eco[targetKey] = { balance: 0, lastDaily: 0, lastWork: 0 };
    data.balance -= montant;
    eco[targetKey].balance += montant;
    saveEco(eco);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`💸 Tu as donne **${montant}** pieces a **${target.tag}**.`)] });
  }

  else if (commandName === 'shop') {
    const s = getGuildSettings(guild.id);
    const items = s.shop || [];
    if (!items.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('La boutique est vide. Un admin peut ajouter des roles avec `/addshopitem`.')], ephemeral: true });
    const desc = items.map((item, i) => {
      const role = guild.roles.cache.get(item.roleId);
      return `**${i + 1}.** ${role || 'Role supprime'} — **${item.price}** pieces`;
    }).join('\n');
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🛒 Boutique').setDescription(desc)] });
  }

  else if (commandName === 'buy') {
    const role = interaction.options.getRole('role');
    const s = getGuildSettings(guild.id);
    const items = s.shop || [];
    const item = items.find(i => i.roleId === role.id);
    if (!item) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Ce role n\'est pas dans la boutique.')], ephemeral: true });
    if (member.roles.cache.has(role.id)) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Tu as deja ce role.')], ephemeral: true });
    const { eco, key, data } = getEcoUser(guild.id, interaction.user.id);
    if (data.balance < item.price) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Solde insuffisant. Il te faut **${item.price}** pieces, tu en as **${data.balance}**.`)], ephemeral: true });
    data.balance -= item.price;
    saveEco(eco);
    await member.roles.add(role).catch(() => {});
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Tu as achete le role ${role} pour **${item.price}** pieces !`)] });
  }

  else if (commandName === 'inventory') {
    const s = getGuildSettings(guild.id);
    const items = s.shop || [];
    const owned = items.filter(i => member.roles.cache.has(i.roleId));
    if (!owned.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Tu n\'as achete aucun role.')], ephemeral: true });
    const desc = owned.map(i => { const r = guild.roles.cache.get(i.roleId); return r ? `${r}` : 'Role supprime'; }).join(', ');
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🎒 Inventaire').setDescription(desc)] });
  }

  else if (commandName === 'addshopitem') {
    const role = interaction.options.getRole('role');
    const prix = interaction.options.getInteger('prix');
    const all = loadSettings();
    if (!all[guild.id]) all[guild.id] = {};
    if (!all[guild.id].shop) all[guild.id].shop = [];
    if (all[guild.id].shop.find(i => i.roleId === role.id)) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Ce role est deja dans la boutique.')], ephemeral: true });
    all[guild.id].shop.push({ roleId: role.id, price: prix });
    saveSettings(all);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`${role} ajoute a la boutique pour **${prix}** pieces.`)] });
  }

  else if (commandName === 'removeshopitem') {
    const role = interaction.options.getRole('role');
    const all = loadSettings();
    if (!all[guild.id]?.shop) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Boutique vide.')], ephemeral: true });
    all[guild.id].shop = all[guild.id].shop.filter(i => i.roleId !== role.id);
    saveSettings(all);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`${role} retire de la boutique.`)] });
  }

  else if (commandName === 'leaderboard-eco') {
    const eco = loadEco();
    const sorted = Object.entries(eco).filter(([k]) => k.startsWith(guild.id)).sort((a, b) => b[1].balance - a[1].balance).slice(0, 10);
    if (!sorted.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Aucune donnee.')], ephemeral: true });
    const desc = await Promise.all(sorted.map(async ([key, data], i) => {
      const userId = key.split('-')[1];
      const u = await client.users.fetch(userId).catch(() => null);
      const medal = ['🥇','🥈','🥉'][i] || `**${i + 1}.**`;
      return `${medal} ${u?.tag || 'Inconnu'} — **${data.balance}** pieces`;
    }));
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('💰 Les plus riches').setDescription(desc.join('\n'))] });
  }

  // ─── Fun ────────────────────────────────────────────────────────────

  else if (commandName === '8ball') {
    const reponses = ['Oui, absolument.','Non.','C\'est certain.','Je ne pense pas.','Sans aucun doute.','Probablement pas.','Oui.','Non, pas du tout.','Les signes disent oui.','Demande plus tard.','Je ne sais pas.','C\'est possible.','N\'y compte pas.','Concentration insuffisante.','Repose ta question.','Oui, mais pas tout de suite.','C\'est flou, reessaye.','Absolument pas.'];
    const rep = reponses[Math.floor(Math.random() * reponses.length)];
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('🎱 Boule magique').addFields({ name: 'Question', value: interaction.options.getString('question') }, { name: 'Reponse', value: rep })] });
  }

  else if (commandName === 'coinflip') {
    const result = Math.random() < 0.5 ? 'Pile' : 'Face';
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`🪙 **${result}** !`)] });
  }

  else if (commandName === 'dice') {
    const faces = interaction.options.getInteger('faces') || 6;
    const result = Math.floor(Math.random() * faces) + 1;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`🎲 Tu as obtenu **${result}** (d${faces})`)] });
  }

  else if (commandName === 'rps') {
    const choix = interaction.options.getString('choix');
    const botChoices = ['pierre', 'feuille', 'ciseaux'];
    const bot = botChoices[Math.floor(Math.random() * 3)];
    const emojis = { pierre: '🪨', feuille: '📄', ciseaux: '✂️' };
    let result;
    if (choix === bot) result = 'Egalite !';
    else if ((choix === 'pierre' && bot === 'ciseaux') || (choix === 'feuille' && bot === 'pierre') || (choix === 'ciseaux' && bot === 'feuille')) result = 'Tu as gagne !';
    else result = 'Tu as perdu !';
    const color = result.includes('gagne') ? 0x2ecc71 : result.includes('perdu') ? 0xe74c3c : 0xf1c40f;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Pierre-Feuille-Ciseaux').setDescription(`${emojis[choix]} vs ${emojis[bot]}\n\n**${result}**`)] });
  }

  // ─── Moderation avancee ─────────────────────────────────────────────

  else if (commandName === 'tempban') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');
    const dureeStr = interaction.options.getString('duree');
    const raison = interaction.options.getString('raison') || 'Aucune raison';
    const ms = parseDuration(dureeStr);
    if (!ms) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Duree invalide.')], ephemeral: true });
    if (target && !target.bannable) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Impossible de bannir ce membre.')], ephemeral: true });
    await guild.members.ban(user.id, { reason: `Tempban ${dureeStr}: ${raison}` });
    const embed = new EmbedBuilder().setColor(COLORS.STOP).setTitle('Ban temporaire').addFields(
      { name: 'Membre', value: user.tag, inline: true }, { name: 'Duree', value: dureeStr, inline: true },
      { name: 'Moderateur', value: member.user.tag, inline: true }, { name: 'Raison', value: raison }
    ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    sendModLog(guild, embed);
    setTimeout(() => guild.members.unban(user.id, 'Tempban expire').catch(() => {}), ms);
  }

  else if (commandName === 'softban') {
    const target = interaction.options.getMember('membre');
    const user = interaction.options.getUser('membre');
    const raison = interaction.options.getString('raison') || 'Softban';
    if (target && !target.bannable) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Impossible de bannir ce membre.')], ephemeral: true });
    await guild.members.ban(user.id, { deleteMessageDays: 7, reason: raison });
    await guild.members.unban(user.id, 'Softban');
    const embed = new EmbedBuilder().setColor(0xff9900).setTitle('Softban').addFields(
      { name: 'Membre', value: user.tag, inline: true }, { name: 'Moderateur', value: member.user.tag, inline: true }, { name: 'Raison', value: raison }
    ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    sendModLog(guild, embed);
  }

  else if (commandName === 'report') {
    const user = interaction.options.getUser('membre');
    const raison = interaction.options.getString('raison');
    const embed = new EmbedBuilder().setColor(0xff9900).setTitle('📢 Signalement').addFields(
      { name: 'Membre signale', value: `${user.tag} (${user.id})`, inline: true },
      { name: 'Raison', value: raison },
    ).setTimestamp();
    sendModLog(guild, embed);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('Signalement envoye aux moderateurs.')], ephemeral: true });
  }

  else if (commandName === 'massrole') {
    const action = interaction.options.getString('action');
    const role = interaction.options.getRole('role');
    await interaction.deferReply();
    const members = await guild.members.fetch();
    let count = 0;
    for (const [, m] of members) {
      if (m.user.bot) continue;
      try {
        if (action === 'add' && !m.roles.cache.has(role.id)) { await m.roles.add(role); count++; }
        if (action === 'remove' && m.roles.cache.has(role.id)) { await m.roles.remove(role); count++; }
      } catch {}
    }
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Role ${role} ${action === 'add' ? 'ajoute a' : 'retire de'} **${count}** membre(s).`)] });
  }

  // ─── Stats & Infos ──────────────────────────────────────────────────

  else if (commandName === 'stats') {
    const up = Date.now() - startTime;
    const mem = process.memoryUsage();
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('📊 Statistiques du bot').addFields(
        { name: 'Serveurs', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Utilisateurs', value: `${client.users.cache.size}`, inline: true },
        { name: 'Salons', value: `${client.channels.cache.size}`, inline: true },
        { name: 'Uptime', value: formatUptime(up), inline: true },
        { name: 'Memoire', value: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Commandes', value: '92', inline: true },
        { name: 'Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
      ).setTimestamp()],
    });
  }

  else if (commandName === 'channelinfo') {
    const ch = interaction.options.getChannel('salon') || channel;
    const embed = new EmbedBuilder().setColor(COLORS.INFO).setTitle(`#${ch.name}`).addFields(
      { name: 'ID', value: ch.id, inline: true },
      { name: 'Type', value: `${ch.type}`, inline: true },
      { name: 'Cree le', value: `<t:${Math.floor(ch.createdTimestamp / 1000)}:D>`, inline: true },
    );
    if (ch.topic) embed.addFields({ name: 'Sujet', value: ch.topic });
    if (ch.rateLimitPerUser) embed.addFields({ name: 'Slowmode', value: `${ch.rateLimitPerUser}s`, inline: true });
    if (ch.nsfw !== undefined) embed.addFields({ name: 'NSFW', value: ch.nsfw ? 'Oui' : 'Non', inline: true });
    await interaction.reply({ embeds: [embed] });
  }

  // ─── Backup ─────────────────────────────────────────────────────────

  else if (commandName === 'backup-create') {
    await interaction.deferReply({ ephemeral: true });
    const backup = {
      id: Date.now().toString(36),
      name: guild.name,
      createdAt: new Date().toISOString(),
      roles: guild.roles.cache.filter(r => r.id !== guild.id && !r.managed).map(r => ({
        name: r.name, color: r.hexColor, position: r.position, permissions: r.permissions.bitfield.toString(), hoist: r.hoist, mentionable: r.mentionable,
      })),
      channels: guild.channels.cache.map(c => ({
        name: c.name, type: c.type, position: c.position, parent: c.parent?.name || null, topic: c.topic || null,
      })),
    };
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR);
    fs.writeFileSync(path.join(BACKUPS_DIR, `${backup.id}.json`), JSON.stringify(backup, null, 2));
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setTitle('Backup creee').addFields(
      { name: 'ID', value: `\`${backup.id}\``, inline: true },
      { name: 'Roles', value: `${backup.roles.length}`, inline: true },
      { name: 'Salons', value: `${backup.channels.length}`, inline: true },
    ).setDescription('Utilise `/backup-load ' + backup.id + '` pour restaurer.')] });
  }

  else if (commandName === 'backup-load') {
    const id = interaction.options.getString('id');
    const filePath = path.join(BACKUPS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Backup introuvable.')], ephemeral: true });

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('backup_confirm').setLabel('Confirmer la restauration').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('backup_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    );
    const reply = await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('⚠️ La restauration va creer les roles et salons manquants. Confirmer ?')], components: [confirmRow], fetchReply: true });

    const collector = reply.createMessageComponentCollector({ time: 15_000 });
    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: 'Pas ton bouton.', ephemeral: true });
      if (i.customId === 'backup_cancel') return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('Restauration annulee.')], components: [] });

      await i.update({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Restauration en cours...')], components: [] });
      const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let rolesCreated = 0, channelsCreated = 0;

      for (const r of backup.roles.sort((a, b) => b.position - a.position)) {
        if (!guild.roles.cache.find(gr => gr.name === r.name)) {
          await guild.roles.create({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: BigInt(r.permissions) }).catch(() => {});
          rolesCreated++;
        }
      }
      for (const c of backup.channels) {
        if (!guild.channels.cache.find(gc => gc.name === c.name && gc.type === c.type)) {
          const parent = c.parent ? guild.channels.cache.find(gc => gc.name === c.parent && gc.type === 4) : null;
          await guild.channels.create({ name: c.name, type: c.type, parent: parent?.id || null, topic: c.topic }).catch(() => {});
          channelsCreated++;
        }
      }
      await i.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setTitle('Backup restauree').addFields(
        { name: 'Roles crees', value: `${rolesCreated}`, inline: true },
        { name: 'Salons crees', value: `${channelsCreated}`, inline: true },
      )] });
    });
    collector.on('end', (_, reason) => { if (reason === 'time') reply.edit({ components: [] }).catch(() => {}); });
  }

  // ═══════════════════════════════════════════════════════════════════
  // ═══ /game ═════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  else if (commandName === 'game') {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();
    const { eco, key, data: ecoData } = getEcoUser(guild.id, interaction.user.id);

    // ─── Casino ───
    if (group === 'casino') {
      const mise = interaction.options.getInteger('mise');
      if (ecoData.balance < mise) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Solde insuffisant (${ecoData.balance} pieces).`)], ephemeral: true });

      if (sub === 'slots') {
        const syms = ['🍒','🍋','🍊','🍇','💎','7️⃣'];
        const r = () => syms[Math.floor(Math.random() * syms.length)];
        const s1 = r(), s2 = r(), s3 = r();
        let mult = 0;
        if (s1 === s2 && s2 === s3) mult = s1 === '💎' ? 10 : s1 === '7️⃣' ? 7 : 5;
        else if (s1 === s2 || s2 === s3) mult = 2;
        const gain = mult > 0 ? mise * mult : -mise;
        ecoData.balance += gain;
        saveEco(eco);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(mult > 0 ? 0x2ecc71 : COLORS.STOP).setTitle('🎰 Machine a sous').setDescription(`> ${s1} | ${s2} | ${s3}\n\n${mult > 0 ? `Tu gagnes **${mise * mult}** pieces ! (x${mult})` : `Tu perds **${mise}** pieces.`}\nSolde : **${ecoData.balance}**`)] });
      }

      else if (sub === 'blackjack') {
        const draw = () => Math.min(Math.floor(Math.random() * 13) + 1, 10);
        let player = draw() + draw(), dealer = draw() + draw();
        const pStr = `${player}`, dStr = `${dealer}`;
        if (player === 21) { ecoData.balance += Math.floor(mise * 1.5); saveEco(eco); return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('🃏 Blackjack !').setDescription(`Toi: **${pStr}** | Dealer: **${dStr}**\nBlackjack ! Tu gagnes **${Math.floor(mise * 1.5)}** pieces !`)] }); }
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bj_hit').setLabel('Tirer').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('bj_stand').setLabel('Rester').setStyle(ButtonStyle.Secondary));
        const reply = await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🃏 Blackjack').setDescription(`Toi: **${player}** | Dealer: **?**\nMise: ${mise}`)], components: [row], fetchReply: true });
        const coll = reply.createMessageComponentCollector({ time: 30000 });
        coll.on('collect', async i => {
          if (i.user.id !== interaction.user.id) return i.reply({ content: 'Pas ta partie.', ephemeral: true });
          if (i.customId === 'bj_hit') { player += draw(); if (player > 21) { ecoData.balance -= mise; saveEco(eco); coll.stop(); return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setTitle('🃏 Blackjack — Perdu').setDescription(`Toi: **${player}** (bust) | Dealer: **${dealer}**\n-${mise} pieces. Solde: **${ecoData.balance}**`)], components: [] }); } return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🃏 Blackjack').setDescription(`Toi: **${player}** | Dealer: **?**\nMise: ${mise}`)], components: [row] }); }
          if (i.customId === 'bj_stand') { while (dealer < 17) dealer += draw(); const win = dealer > 21 || player > dealer; if (win) ecoData.balance += mise; else if (player < dealer) ecoData.balance -= mise; saveEco(eco); coll.stop(); return i.update({ embeds: [new EmbedBuilder().setColor(win ? 0x2ecc71 : player === dealer ? COLORS.WARN : COLORS.STOP).setTitle('🃏 Blackjack').setDescription(`Toi: **${player}** | Dealer: **${dealer}**\n${win ? `+${mise}` : player === dealer ? 'Egalite' : `-${mise}`} pieces. Solde: **${ecoData.balance}**`)], components: [] }); }
        });
        coll.on('end', (_, r) => { if (r === 'time') reply.edit({ components: [] }).catch(() => {}); });
      }

      else if (sub === 'bet') {
        const win = Math.random() < 0.45;
        ecoData.balance += win ? mise : -mise;
        saveEco(eco);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(win ? 0x2ecc71 : COLORS.STOP).setDescription(`🎲 ${win ? `Tu gagnes **${mise}** pieces !` : `Tu perds **${mise}** pieces.`} Solde: **${ecoData.balance}**`)] });
      }

      else if (sub === 'roulette') {
        const couleur = interaction.options.getString('couleur');
        const num = Math.floor(Math.random() * 37);
        const result = num === 0 ? 'vert' : num % 2 === 0 ? 'rouge' : 'noir';
        const emoji = { rouge: '🔴', noir: '⚫', vert: '🟢' };
        const mult = couleur === 'vert' ? 14 : 2;
        const win = couleur === result;
        ecoData.balance += win ? mise * (mult - 1) : -mise;
        saveEco(eco);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(win ? 0x2ecc71 : COLORS.STOP).setTitle('🎡 Roulette').setDescription(`La bille tombe sur **${num}** ${emoji[result]}\n${win ? `Tu gagnes **${mise * (mult - 1)}** pieces !` : `Tu perds **${mise}** pieces.`}\nSolde: **${ecoData.balance}**`)] });
      }
    }

    // ─── Aventure ───
    else if (group === 'aventure') {
      if (sub === 'fish') {
        const fish = ['🐟 Sardine (10)','🐠 Poisson-clown (25)','🐡 Poisson-globe (40)','🦈 Requin (100)','🐙 Pieuvre (60)','🦞 Homard (80)','👟 Vieille chaussure (1)','🗑️ Dechet (0)'];
        const f = fish[Math.floor(Math.random() * fish.length)];
        const gain = parseInt(f.match(/\((\d+)\)/)?.[1] || 0);
        ecoData.balance += gain; saveEco(eco);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`🎣 Tu as peche : ${f.split('(')[0]}! +**${gain}** pieces. Solde: **${ecoData.balance}**`)] });
      } else if (sub === 'hunt') {
        const animals = ['🐇 Lapin (15)','🦊 Renard (30)','🐗 Sanglier (50)','🦌 Cerf (70)','🐻 Ours (100)','🐿️ Ecureuil (5)','💨 Rien (0)'];
        const a = animals[Math.floor(Math.random() * animals.length)];
        const gain = parseInt(a.match(/\((\d+)\)/)?.[1] || 0);
        ecoData.balance += gain; saveEco(eco);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`🏹 Tu as chasse : ${a.split('(')[0]}! +**${gain}** pieces. Solde: **${ecoData.balance}**`)] });
      } else if (sub === 'rob') {
        const cible = interaction.options.getUser('cible');
        if (cible.id === interaction.user.id) return interaction.reply({ content: 'Tu ne peux pas te voler.', ephemeral: true });
        const { eco: e2, data: cData } = getEcoUser(guild.id, cible.id);
        const success = Math.random() < 0.4;
        if (success && cData.balance > 0) { const stolen = Math.min(Math.floor(Math.random() * 200) + 10, cData.balance); ecoData.balance += stolen; cData.balance -= stolen; saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Tu as vole **${stolen}** pieces a ${cible.tag} !`)] }); }
        else { const fine = Math.floor(Math.random() * 100) + 20; ecoData.balance = Math.max(0, ecoData.balance - fine); saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Tu t'es fait attraper ! Amende de **${fine}** pieces.`)] }); }
      } else if (sub === 'crime') {
        const success = Math.random() < 0.35;
        if (success) { const gain = Math.floor(Math.random() * 300) + 50; ecoData.balance += gain; saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`🦹 Crime reussi ! +**${gain}** pieces.`)] }); }
        else { const fine = Math.floor(Math.random() * 200) + 50; ecoData.balance = Math.max(0, ecoData.balance - fine); saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`🚔 Arrete ! Amende de **${fine}** pieces.`)] }); }
      } else if (sub === 'beg') {
        const gain = Math.floor(Math.random() * 30) + 1;
        ecoData.balance += gain; saveEco(eco);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`🥺 Un passant t'a donne **${gain}** pieces.`)] });
      } else if (sub === 'duel') {
        const adv = interaction.options.getUser('adversaire');
        const mise = interaction.options.getInteger('mise');
        if (ecoData.balance < mise) return interaction.reply({ content: 'Solde insuffisant.', ephemeral: true });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`duel_accept_${interaction.user.id}_${mise}`).setLabel('Accepter').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('duel_decline').setLabel('Refuser').setStyle(ButtonStyle.Danger));
        const reply = await interaction.reply({ content: `${adv}`, embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`${interaction.user} te defie en duel pour **${mise}** pieces !`)], components: [row], fetchReply: true });
        const coll = reply.createMessageComponentCollector({ time: 30000 });
        coll.on('collect', async i => {
          if (i.customId === 'duel_decline') { coll.stop(); return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Duel refuse.')], components: [] }); }
          if (i.user.id !== adv.id) return i.reply({ content: 'Ce n\'est pas ton duel.', ephemeral: true });
          const { eco: e3, data: aData } = getEcoUser(guild.id, adv.id);
          if (aData.balance < mise) { coll.stop(); return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`${adv.tag} n'a pas assez de pieces.`)], components: [] }); }
          const winner = Math.random() < 0.5 ? interaction.user : adv;
          const loser = winner.id === interaction.user.id ? adv : interaction.user;
          const wData = winner.id === interaction.user.id ? ecoData : aData;
          const lData = winner.id === interaction.user.id ? aData : ecoData;
          wData.balance += mise; lData.balance -= mise; saveEco(eco);
          coll.stop(); i.update({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('⚔️ Duel').setDescription(`**${winner.tag}** remporte le duel et gagne **${mise}** pieces !`)], components: [] });
        });
        coll.on('end', (_, r) => { if (r === 'time') reply.edit({ components: [] }).catch(() => {}); });
      } else if (sub === 'mine') {
        const ores = ['🪨 Pierre (5)','�ite Fer (20)','🥇 Or (60)','💎 Diamant (150)','💨 Rien (0)','🪱 Ver de terre (2)'];
        const o = ores[Math.floor(Math.random() * ores.length)];
        const gain = parseInt(o.match(/\((\d+)\)/)?.[1] || 0);
        ecoData.balance += gain; saveEco(eco);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`⛏️ Tu as mine : ${o.split('(')[0]}! +**${gain}** pieces.`)] });
      } else if (sub === 'explore') {
        const finds = ['Un coffre ancien ! (+80)','Une piece rare ! (+50)','Un artefact magique ! (+120)','Rien d\'interessant. (+0)','Un piege ! (-30)','Une carte au tresor ! (+200)','Des ruines vides. (+5)'];
        const f = finds[Math.floor(Math.random() * finds.length)];
        const gain = parseInt(f.match(/\(([+-]?\d+)\)/)?.[1] || 0);
        ecoData.balance = Math.max(0, ecoData.balance + gain); saveEco(eco);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(gain >= 0 ? COLORS.PLAY : COLORS.STOP).setDescription(`🗺️ ${f.split('(')[0]}\n${gain >= 0 ? '+' : ''}**${gain}** pieces. Solde: **${ecoData.balance}**`)] });
      }
    }

    // ─── Jeux ───
    else if (group === 'jeux') {
      if (sub === 'tictactoe') {
        const adv = interaction.options.getUser('adversaire');
        if (adv.bot || adv.id === interaction.user.id) return interaction.reply({ content: 'Adversaire invalide.', ephemeral: true });
        const board = Array(9).fill(null);
        const gameId = `ttt_${Date.now()}`;
        const players = [interaction.user.id, adv.id];
        tttGames.set(gameId, { board, players, turn: 0 });
        const buildBoard = (b, id) => {
          const rows = [];
          for (let r = 0; r < 3; r++) {
            const row = new ActionRowBuilder();
            for (let c = 0; c < 3; c++) {
              const idx = r * 3 + c;
              const val = b[idx];
              row.addComponents(new ButtonBuilder().setCustomId(`${id}_${idx}`).setLabel(val || '⬜').setStyle(val === '❌' ? ButtonStyle.Danger : val === '⭕' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(!!val));
            }
            rows.push(row);
          }
          return rows;
        };
        const checkWin = b => { const l = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; return l.some(([a,x,c]) => b[a] && b[a] === b[x] && b[x] === b[c]); };
        const reply = await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`🎮 **${interaction.user.tag}** (❌) vs **${adv.tag}** (⭕)\nTour de ${interaction.user}`)], components: buildBoard(board, gameId), fetchReply: true });
        const coll = reply.createMessageComponentCollector({ time: 120000 });
        coll.on('collect', async i => {
          const game = tttGames.get(gameId); if (!game) return;
          if (i.user.id !== game.players[game.turn]) return i.reply({ content: 'Pas ton tour.', ephemeral: true });
          const idx = parseInt(i.customId.split('_').pop());
          game.board[idx] = game.turn === 0 ? '❌' : '⭕';
          if (checkWin(game.board)) { tttGames.delete(gameId); coll.stop(); return i.update({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`🎮 **${i.user.tag}** a gagne !`)], components: buildBoard(game.board, gameId) }); }
          if (game.board.every(c => c)) { tttGames.delete(gameId); coll.stop(); return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('🎮 Egalite !')], components: buildBoard(game.board, gameId) }); }
          game.turn = 1 - game.turn;
          const nextUser = await client.users.fetch(game.players[game.turn]);
          i.update({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`🎮 Tour de **${nextUser.tag}** (${game.turn === 0 ? '❌' : '⭕'})`)], components: buildBoard(game.board, gameId) });
        });
        coll.on('end', () => tttGames.delete(gameId));
      } else if (sub === 'trivia') {
        const q = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
        const shuffled = [...q.a]; const correctAns = shuffled[q.c];
        for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
        const correctIdx = shuffled.indexOf(correctAns);
        const row = new ActionRowBuilder();
        shuffled.forEach((a, i) => row.addComponents(new ButtonBuilder().setCustomId(`trivia_${i}`).setLabel(a).setStyle(ButtonStyle.Primary)));
        const reply = await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🧠 Trivia').setDescription(q.q)], components: [row], fetchReply: true });
        const coll = reply.createMessageComponentCollector({ time: 15000 });
        coll.on('collect', async i => {
          coll.stop();
          const chosen = parseInt(i.customId.split('_')[1]);
          const correct = chosen === correctIdx;
          if (correct) { ecoData.balance += 30; saveEco(eco); }
          i.update({ embeds: [new EmbedBuilder().setColor(correct ? 0x2ecc71 : COLORS.STOP).setTitle('🧠 Trivia').setDescription(`${q.q}\n\n${correct ? '✅ Correct ! +30 pieces' : `❌ Faux ! La reponse etait **${correctAns}**`}`)], components: [] });
        });
        coll.on('end', (c, r) => { if (r === 'time') reply.edit({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`Temps ecoule ! Reponse: **${correctAns}**`)], components: [] }).catch(() => {}); });
      } else if (sub === 'guess') {
        const number = Math.floor(Math.random() * 100) + 1;
        let attempts = 0;
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🔢 Devine le nombre (1-100)').setDescription('Envoie un nombre dans le chat !')] });
        const filter = m => m.author.id === interaction.user.id && !isNaN(m.content);
        const coll = channel.createMessageCollector({ filter, time: 60000 });
        coll.on('collect', m => {
          attempts++;
          const guess = parseInt(m.content);
          if (guess === number) { coll.stop(); const bonus = Math.max(50 - attempts * 5, 10); ecoData.balance += bonus; saveEco(eco); m.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`🎉 Correct en **${attempts}** essai(s) ! +**${bonus}** pieces.`)] }); }
          else if (guess < number) m.reply({ content: '⬆️ Plus haut !' });
          else m.reply({ content: '⬇️ Plus bas !' });
        });
        coll.on('end', (_, r) => { if (r === 'time') channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Temps ecoule ! Le nombre etait **${number}**.`)] }); });
      } else if (sub === 'hangman') {
        const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
        let guessed = new Set(), lives = 6;
        const display = () => word.split('').map(l => guessed.has(l) ? l : '_').join(' ');
        const stages = ['😀','😐','😟','😰','😱','💀','☠️'];
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🔤 Pendu').setDescription(`\`${display()}\`\n\n${stages[6 - lives]} Vies: ${'❤️'.repeat(lives)}\nEnvoie une lettre dans le chat !`)] });
        const filter = m => m.author.id === interaction.user.id && /^[a-zA-Z]$/.test(m.content);
        const coll = channel.createMessageCollector({ filter, time: 120000 });
        coll.on('collect', m => {
          const l = m.content.toLowerCase();
          if (guessed.has(l)) return m.reply({ content: 'Deja essaye !', });
          guessed.add(l);
          if (!word.includes(l)) lives--;
          const disp = display();
          if (!disp.includes('_')) { coll.stop(); ecoData.balance += 40; saveEco(eco); return m.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`🎉 Gagne ! Le mot etait **${word}** ! +40 pieces`)] }); }
          if (lives <= 0) { coll.stop(); return m.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`☠️ Perdu ! Le mot etait **${word}**.`)] }); }
          m.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🔤 Pendu').setDescription(`\`${disp}\`\n\n${stages[6 - lives]} Vies: ${'❤️'.repeat(lives)}\nLettres: ${[...guessed].join(', ')}`)] });
        });
      } else if (sub === 'quickmath') {
        const ops = ['+', '-', '*'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        const a = Math.floor(Math.random() * 50) + 1, b = Math.floor(Math.random() * 20) + 1;
        const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🧮 Calcul mental').setDescription(`**${a} ${op} ${b} = ?**\nReponds dans le chat ! (10s)`)] });
        const filter = m => m.author.id === interaction.user.id && !isNaN(m.content);
        const coll = channel.createMessageCollector({ filter, time: 10000, max: 1 });
        coll.on('collect', m => {
          const correct = parseInt(m.content) === answer;
          if (correct) { ecoData.balance += 25; saveEco(eco); }
          m.reply({ embeds: [new EmbedBuilder().setColor(correct ? 0x2ecc71 : COLORS.STOP).setDescription(correct ? `✅ Correct ! +25 pieces` : `❌ Faux ! Reponse: **${answer}**`)] });
        });
        coll.on('end', (c) => { if (!c.size) channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Temps ecoule ! Reponse: **${answer}**`)] }); });
      } else if (sub === 'memory') {
        const emojis = ['🍎','🍊','🍋','🍇','🍉'];
        const seq = Array.from({ length: Math.floor(Math.random() * 3) + 4 }, () => emojis[Math.floor(Math.random() * emojis.length)]);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🧠 Memoire').setDescription(`Memorise cette sequence :\n\n${seq.join(' ')}\n\nTu as 5 secondes...`)] });
        setTimeout(async () => {
          await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setTitle('🧠 Memoire').setDescription('Quelle etait la sequence ? Envoie les emojis dans le chat !')] });
          const filter = m => m.author.id === interaction.user.id;
          const coll = channel.createMessageCollector({ filter, time: 15000, max: 1 });
          coll.on('collect', m => {
            const correct = m.content.replace(/\s/g, '') === seq.join('');
            if (correct) { ecoData.balance += 35; saveEco(eco); }
            m.reply({ embeds: [new EmbedBuilder().setColor(correct ? 0x2ecc71 : COLORS.STOP).setDescription(correct ? `✅ Parfait ! +35 pieces` : `❌ Faux ! C'etait : ${seq.join(' ')}`)] });
          });
        }, 5000);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ═══ /fun ══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  else if (commandName === 'fun') {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();

    if (group === 'social') {
      const actions = { hug:'fait un calin a',slap:'gifle',pat:'caresse la tete de',kiss:'fait un bisou a',punch:'donne un coup de poing a',highfive:'fait un high-five avec',wave:'salue',compliment:'complimente',roast:'roast',cry:null,dance:null };
      const emojis = { hug:'🤗',slap:'👋',pat:'🥰',kiss:'💋',punch:'👊',highfive:'✋',wave:'👋',compliment:'✨',roast:'🔥',cry:'😭',dance:'💃' };
      const compliments = ['Tu es incroyable !','Le monde est meilleur avec toi.','Tu as un sourire contagieux.','Tu es plus utile qu\'un chargeur a 1%.','Si tu etais un Pokemon, tu serais legendaire.'];
      const roasts_list = ['Tu es la preuve que meme l\'evolution fait des erreurs.','Google n\'a pas assez de resultats pour expliquer ce que tu es.','Tu es unique... comme tout le monde.','Ton QI et la temperature de la piece se disputent le premier rang.'];

      if (sub === 'cry') return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x3498db).setDescription(`${emojis.cry} **${member.user.tag}** pleure...`)] });
      if (sub === 'dance') return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`${emojis.dance} **${member.user.tag}** danse !`)] });

      // Mariage
      if (sub === 'marry') {
        const target = interaction.options.getUser('membre');
        if (target.id === interaction.user.id) return interaction.reply({ content: 'Tu ne peux pas te marier avec toi-meme.', ephemeral: true });
        if (target.bot) return interaction.reply({ content: 'Tu ne peux pas epouser un bot.', ephemeral: true });
        const marriages = loadMarriages();
        const myKey = `${guild.id}-${interaction.user.id}`, targetKey = `${guild.id}-${target.id}`;
        if (marriages[myKey]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu es deja marie(e) ! Utilise `/fun social divorce` d\'abord.')], ephemeral: true });
        if (marriages[targetKey]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`**${target.tag}** est deja marie(e).`)], ephemeral: true });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`marry_yes_${interaction.user.id}_${target.id}`).setLabel('Accepter 💍').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('marry_no').setLabel('Refuser').setStyle(ButtonStyle.Danger),
        );
        const reply = await interaction.reply({ content: `${target}`, embeds: [new EmbedBuilder().setColor(0xff69b4).setTitle('💍 Demande en mariage').setDescription(`**${interaction.user.tag}** demande **${target.tag}** en mariage !\n\n${target}, acceptes-tu ?`).setThumbnail('https://em-content.zobj.net/source/twitter/376/ring_1f48d.png')], components: [row], fetchReply: true });
        const coll = reply.createMessageComponentCollector({ time: 60000 });
        coll.on('collect', async i => {
          if (i.customId === 'marry_no') {
            if (i.user.id !== target.id) return i.reply({ content: 'Ce n\'est pas ta demande.', ephemeral: true });
            coll.stop(); return i.update({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`💔 **${target.tag}** a refuse la demande.`)], components: [] });
          }
          if (i.user.id !== target.id) return i.reply({ content: 'Ce n\'est pas ta demande.', ephemeral: true });
          marriages[myKey] = { partnerId: target.id, date: new Date().toISOString() };
          marriages[targetKey] = { partnerId: interaction.user.id, date: new Date().toISOString() };
          saveMarriages(marriages);
          coll.stop();
          i.update({ embeds: [new EmbedBuilder().setColor(0xff69b4).setTitle('💒 Mariage celebre !').setDescription(`**${interaction.user.tag}** 💍 **${target.tag}**\n\nFelicitations aux maries ! 🎉🥂`).setFooter(BOT_FOOTER).setTimestamp()], components: [] });
        });
        coll.on('end', (_, r) => { if (r === 'time') reply.edit({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('La demande a expire.')], components: [] }).catch(() => {}); });
        return;
      }

      if (sub === 'divorce') {
        const marriages = loadMarriages();
        const myKey = `${guild.id}-${interaction.user.id}`;
        if (!marriages[myKey]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu n\'es pas marie(e).')], ephemeral: true });
        const partnerId = marriages[myKey].partnerId;
        const partner = await client.users.fetch(partnerId).catch(() => null);
        delete marriages[myKey];
        delete marriages[`${guild.id}-${partnerId}`];
        saveMarriages(marriages);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`💔 **${interaction.user.tag}** et **${partner?.tag || 'Inconnu'}** ont divorce.`).setFooter(BOT_FOOTER).setTimestamp()] });
        return;
      }

      if (sub === 'partner') {
        const user = interaction.options.getUser('membre') || interaction.user;
        const marriages = loadMarriages();
        const data = marriages[`${guild.id}-${user.id}`];
        if (!data) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`**${user.tag}** n'est pas marie(e).`)], ephemeral: true });
        const partner = await client.users.fetch(data.partnerId).catch(() => null);
        const date = new Date(data.date);
        const days = Math.floor((Date.now() - date.getTime()) / 86400000);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff69b4).setTitle('💑 Couple').setDescription(`**${user.tag}** 💍 **${partner?.tag || 'Inconnu'}**\n\n> 📅 Maries depuis le ${date.toLocaleDateString('fr-FR')}\n> 🕐 Il y a **${days}** jour${days > 1 ? 's' : ''}`).setThumbnail(user.displayAvatarURL()).setFooter(BOT_FOOTER).setTimestamp()] });
        return;
      }

      const target = interaction.options.getUser('membre');
      let desc = `${emojis[sub]} **${member.user.tag}** ${actions[sub]} **${target.tag}**`;
      if (sub === 'compliment') desc += `\n\n*${compliments[Math.floor(Math.random() * compliments.length)]}*`;
      if (sub === 'roast') desc += `\n\n*${roasts_list[Math.floor(Math.random() * roasts_list.length)]}*`;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(desc)] });
    }

    else if (group === 'profil') {
      if (sub === 'rate') { const chose = interaction.options.getString('chose'); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`⭐ Je note **${chose}** : **${Math.floor(Math.random() * 11)}/10**`)] }); }
      else if (sub === 'ship') { const u1 = interaction.options.getUser('user1'), u2 = interaction.options.getUser('user2'); const pct = Math.floor(Math.random() * 101); const bar = '❤️'.repeat(Math.floor(pct / 10)) + '🖤'.repeat(10 - Math.floor(pct / 10)); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff69b4).setTitle('💘 Love Calculator').setDescription(`${u1} x ${u2}\n\n${bar} **${pct}%**\n${pct > 80 ? 'Ames soeurs !' : pct > 50 ? 'Ca pourrait marcher !' : pct > 20 ? 'Complique...' : 'Pas compatible.'}`)] }); }
      else if (sub === 'iq') { const u = interaction.options.getUser('membre') || interaction.user; await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`🧠 **${u.tag}** a un QI de **${Math.floor(Math.random() * 151) + 50}**`)] }); }
      else if (sub === 'wanted') { const u = interaction.options.getUser('membre') || interaction.user; await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setTitle('🚨 AVIS DE RECHERCHE').setDescription(`**${u.tag}**\nRecompense : **${Math.floor(Math.random() * 10000) + 100}** pieces`).setThumbnail(u.displayAvatarURL({ size: 256 }))] }); }
      else if (sub === 'simprate') { const u = interaction.options.getUser('membre') || interaction.user; await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff69b4).setDescription(`💝 **${u.tag}** est **${Math.floor(Math.random() * 101)}%** simp`)] }); }
      else if (sub === 'hack') { const u = interaction.options.getUser('membre'); await interaction.deferReply(); const steps = [`Connexion a ${u.tag}...`,`Bypass du pare-feu...`,`Acces aux fichiers...`,`Email: ${u.tag.toLowerCase().replace(/\s/g,'')}@fake.com`,`Mot de passe: ********`,`IP: ${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,`DM les plus frequents: Ton crush`,`Hack termine ! (c'est faux bien sur)`]; await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle(`💻 Hack de ${u.tag}`).setDescription(steps.join('\n'))] }); }
      else if (sub === 'joke') { await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('😂 Blague').setDescription(JOKES[Math.floor(Math.random() * JOKES.length)])] }); }
      else if (sub === 'fact') { await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('📚 Le savais-tu ?').setDescription(FACTS[Math.floor(Math.random() * FACTS.length)])] }); }
      else if (sub === 'quote') { await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('💬 Citation').setDescription(QUOTES[Math.floor(Math.random() * QUOTES.length)])] }); }
    }

    else if (group === 'texte') {
      const txt = interaction.options.getString('texte') || interaction.options.getString('options') || interaction.options.getString('expression') || '';
      if (sub === 'reverse') await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(txt.split('').reverse().join(''))] });
      else if (sub === 'mock') await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(txt.split('').map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join(''))] });
      else if (sub === 'clap') await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(txt.split(' ').join(' 👏 '))] });
      else if (sub === 'spoiler') await interaction.reply({ content: txt.split('').map(c => c === ' ' ? ' ' : `||${c}||`).join('') });
      else if (sub === 'binary') await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(txt.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '))] });
      else if (sub === 'encode') await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(Buffer.from(txt).toString('base64'))] });
      else if (sub === 'decode') { try { await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(Buffer.from(txt, 'base64').toString('utf8'))] }); } catch { await interaction.reply({ content: 'Base64 invalide.', ephemeral: true }); } }
      else if (sub === 'vaporwave') await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff69b4).setDescription(txt.split('').join(' '))] });
      else if (sub === 'ascii') await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`\`\`\`\n${txt.toUpperCase()}\n\`\`\``)] });
      else if (sub === 'choose') { const opts = txt.split('|').map(o => o.trim()).filter(Boolean); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(`🎯 Je choisis : **${opts[Math.floor(Math.random() * opts.length)]}**`)] }); }
      else if (sub === 'password') { const len = interaction.options.getInteger('longueur') || 16; const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'; const pw = Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`🔐 \`${pw}\``)], ephemeral: true }); }
      else if (sub === 'calc') { try { const expr = txt.replace(/[^0-9+\-*/.()% ]/g, ''); const result = Function('"use strict"; return (' + expr + ')')(); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`🧮 \`${expr}\` = **${result}**`)] }); } catch { await interaction.reply({ content: 'Expression invalide.', ephemeral: true }); } }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ═══ /manage ═══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  else if (commandName === 'manage') {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();

    if (group === 'channel') {
      const targetCh = interaction.options.getChannel('salon') || channel;
      if (sub === 'create') { const nom = interaction.options.getString('nom'); const type = interaction.options.getString('type'); const types = { text: ChannelType.GuildText, voice: ChannelType.GuildVoice, category: ChannelType.GuildCategory }; const ch = await guild.channels.create({ name: nom, type: types[type] }); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Salon ${ch} cree.`)] }); }
      else if (sub === 'delete') { const ch = interaction.options.getChannel('salon'); await ch.delete(); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Salon **${ch.name}** supprime.`)] }); }
      else if (sub === 'clone') { const cl = await targetCh.clone(); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Salon ${cl} clone.`)] }); }
      else if (sub === 'rename') { const nom = interaction.options.getString('nom'); await targetCh.setName(nom); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Salon renomme en **${nom}**.`)] }); }
      else if (sub === 'topic') { const sujet = interaction.options.getString('sujet'); await targetCh.setTopic(sujet); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Sujet mis a jour.`)] }); }
      else if (sub === 'hide') { await targetCh.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`${targetCh} est maintenant cache.`)] }); }
      else if (sub === 'unhide') { await targetCh.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null }); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`${targetCh} est maintenant visible.`)] }); }
    }
    else if (group === 'role') {
      if (sub === 'create') { const nom = interaction.options.getString('nom'); const c = interaction.options.getString('couleur'); const role = await guild.roles.create({ name: nom, color: c ? parseInt(c.replace('#',''), 16) : undefined }); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Role ${role} cree.`)] }); }
      else if (sub === 'delete') { const role = interaction.options.getRole('role'); await role.delete(); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Role **${role.name}** supprime.`)] }); }
      else if (sub === 'color') { const role = interaction.options.getRole('role'); const c = interaction.options.getString('couleur'); await role.setColor(parseInt(c.replace('#',''), 16)); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Couleur de ${role} changee en **${c}**.`)] }); }
      else if (sub === 'info') { const role = interaction.options.getRole('role'); await interaction.reply({ embeds: [new EmbedBuilder().setColor(role.color || COLORS.INFO).setTitle(role.name).addFields({name:'ID',value:role.id,inline:true},{name:'Couleur',value:role.hexColor,inline:true},{name:'Membres',value:`${role.members.size}`,inline:true},{name:'Position',value:`${role.position}`,inline:true},{name:'Mentionnable',value:role.mentionable?'Oui':'Non',inline:true},{name:'Cree le',value:`<t:${Math.floor(role.createdTimestamp/1000)}:D>`,inline:true})] }); }
      else if (sub === 'list') { const roles = guild.roles.cache.filter(r => r.id !== guild.id).sort((a,b) => b.position - a.position).map(r => `${r} (${r.members.size})`).join('\n'); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle(`Roles (${guild.roles.cache.size - 1})`).setDescription(roles.slice(0, 4000))] }); }
    }
    else if (group === 'voice') {
      if (sub === 'kick') { const m = interaction.options.getMember('membre'); if (!m?.voice.channel) return interaction.reply({ content: 'Ce membre n\'est pas en vocal.', ephemeral: true }); await m.voice.disconnect(); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`${m.user.tag} deconnecte du vocal.`)] }); }
      else if (sub === 'move') { const m = interaction.options.getMember('membre'); const ch = interaction.options.getChannel('salon'); if (!m?.voice.channel) return interaction.reply({ content: 'Ce membre n\'est pas en vocal.', ephemeral: true }); await m.voice.setChannel(ch); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`${m.user.tag} deplace dans ${ch}.`)] }); }
      else if (sub === 'muteall') { const vc = member.voice.channel; if (!vc) return interaction.reply({ content: 'Tu dois etre en vocal.', ephemeral: true }); for (const [, m] of vc.members) { if (!m.user.bot) await m.voice.setMute(true).catch(() => {}); } await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Tous les membres de **${vc.name}** sont mutes.`)] }); }
      else if (sub === 'unmuteall') { const vc = member.voice.channel; if (!vc) return interaction.reply({ content: 'Tu dois etre en vocal.', ephemeral: true }); for (const [, m] of vc.members) { await m.voice.setMute(false).catch(() => {}); } await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Tous les membres de **${vc.name}** sont unmutes.`)] }); }
    }
    else if (group === 'emoji') {
      if (sub === 'steal') { const url = interaction.options.getString('url'); const nom = interaction.options.getString('nom'); try { const e = await guild.emojis.create({ attachment: url, name: nom }); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Emoji ${e} ajoute !`)] }); } catch { await interaction.reply({ content: 'Erreur. Verifie l\'URL et le nom.', ephemeral: true }); } }
      else if (sub === 'list') { const emojis = guild.emojis.cache.map(e => `${e}`).join(' '); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle(`Emojis (${guild.emojis.cache.size})`).setDescription(emojis || 'Aucun')] }); }
      else if (sub === 'delete') { const nom = interaction.options.getString('nom'); const e = guild.emojis.cache.find(em => em.name === nom); if (!e) return interaction.reply({ content: 'Emoji introuvable.', ephemeral: true }); await e.delete(); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Emoji **${nom}** supprime.`)] }); }
    }
    else if (group === 'eco') {
      const user = interaction.options.getUser('membre'); const montant = interaction.options.getInteger('montant'); const { eco, data } = getEcoUser(guild.id, user.id);
      if (sub === 'add') { data.balance += montant; saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`+${montant} pieces pour ${user.tag}. Solde: **${data.balance}**`)] }); }
      else if (sub === 'remove') { data.balance = Math.max(0, data.balance - montant); saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`-${montant} pieces pour ${user.tag}. Solde: **${data.balance}**`)] }); }
      else if (sub === 'reset') { data.balance = 0; data.lastDaily = 0; data.lastWork = 0; saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Economie de ${user.tag} reinitialise.`)] }); }
    }
    else if (group === 'xp') {
      const user = interaction.options.getUser('membre'); const montant = interaction.options.getInteger('montant') || 0; const levels = loadLevels(); const key = `${guild.id}-${user.id}`; if (!levels[key]) levels[key] = { xp: 0, totalMessages: 0, lastXp: 0 };
      if (sub === 'add') { levels[key].xp += montant; saveLevels(levels); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`+${montant} XP pour ${user.tag}. Total: **${levels[key].xp}**`)] }); }
      else if (sub === 'remove') { levels[key].xp = Math.max(0, levels[key].xp - montant); saveLevels(levels); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`-${montant} XP pour ${user.tag}. Total: **${levels[key].xp}**`)] }); }
      else if (sub === 'reset') { levels[key] = { xp: 0, totalMessages: 0, lastXp: 0 }; saveLevels(levels); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`XP de ${user.tag} reinitialise.`)] }); }
    }
    else if (group === 'bank') {
      const { eco, data } = getEcoUser(guild.id, interaction.user.id); if (!data.bank) data.bank = 0;
      if (sub === 'deposit') { const m = interaction.options.getInteger('montant'); if (data.balance < m) return interaction.reply({ content: 'Solde insuffisant.', ephemeral: true }); data.balance -= m; data.bank += m; saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`💰 Depose **${m}** en banque.\nPortefeuille: **${data.balance}** | Banque: **${data.bank}**`)] }); }
      else if (sub === 'withdraw') { const m = interaction.options.getInteger('montant'); if (data.bank < m) return interaction.reply({ content: 'Solde bancaire insuffisant.', ephemeral: true }); data.bank -= m; data.balance += m; saveEco(eco); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`💰 Retire **${m}** de la banque.\nPortefeuille: **${data.balance}** | Banque: **${data.bank}**`)] }); }
      else if (sub === 'balance') { const u = interaction.options.getUser('membre') || interaction.user; const { data: d } = getEcoUser(guild.id, u.id); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle(`🏦 Banque de ${u.tag}`).addFields({name:'Portefeuille',value:`${d.balance}`,inline:true},{name:'Banque',value:`${d.bank || 0}`,inline:true},{name:'Total',value:`${d.balance + (d.bank || 0)}`,inline:true})] }); }
    }
    else if (group === 'birthday') {
      const bdays = loadBirthdays();
      if (sub === 'set') {
        const date = interaction.options.getString('date');
        const target = interaction.options.getUser('membre') || interaction.user;
        if (!/^\d{1,2}\/\d{1,2}$/.test(date)) return interaction.reply({ content: 'Format invalide. Utilise JJ/MM (ex: 25/12).', ephemeral: true });
        const [d, m] = date.split('/').map(Number);
        if (m < 1 || m > 12 || d < 1 || d > 31) return interaction.reply({ content: 'Date invalide.', ephemeral: true });
        bdays[`${guild.id}-${target.id}`] = date;
        saveBirthdays(bdays);
        const who = target.id === interaction.user.id ? 'Ton anniversaire' : `L'anniversaire de **${target.tag}**`;
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`🎂 ${who} a ete defini le **${date}**.`).setFooter(BOT_FOOTER).setTimestamp()] });
      }
      else if (sub === 'check') { const u = interaction.options.getUser('membre') || interaction.user; const d = bdays[`${guild.id}-${u.id}`]; await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(d ? `🎂 **${u.tag}** : **${d}**` : `Pas d'anniversaire defini pour ${u.tag}.`).setThumbnail(u.displayAvatarURL()).setFooter(BOT_FOOTER).setTimestamp()] }); }
      else if (sub === 'list') { const entries = Object.entries(bdays).filter(([k]) => k.startsWith(guild.id)).map(([k, v]) => ({ userId: k.split('-')[1], date: v, sort: (() => { const [d, m] = v.split('/'); return parseInt(m) * 100 + parseInt(d); })() })).sort((a, b) => a.sort - b.sort); if (!entries.length) return interaction.reply({ content: 'Aucun anniversaire.', ephemeral: true }); const desc = await Promise.all(entries.slice(0, 20).map(async e => { const u = await client.users.fetch(e.userId).catch(() => null); return `> 🎂  **${e.date}** — ${u?.tag || 'Inconnu'}`; })); await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🎂 Anniversaires du serveur').setDescription(desc.join('\n')).setFooter({ text: `${entries.length} anniversaire${entries.length > 1 ? 's' : ''} enregistre${entries.length > 1 ? 's' : ''}  ┃  ${BOT_FOOTER.text}` }).setTimestamp()] }); }
      else if (sub === 'remove') {
        const target = interaction.options.getUser('membre') || interaction.user;
        const key = `${guild.id}-${target.id}`;
        if (!bdays[key]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription(`Pas d'anniversaire defini pour **${target.tag}**.`)], ephemeral: true });
        delete bdays[key];
        saveBirthdays(bdays);
        const who = target.id === interaction.user.id ? 'Ton anniversaire' : `L'anniversaire de **${target.tag}**`;
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`${who} a ete supprime.`).setFooter(BOT_FOOTER).setTimestamp()] });
      }
    }
    else if (group === 'note') {
      const notes = loadNotes(); const key = `${guild.id}-${interaction.user.id}`; if (!notes[key]) notes[key] = [];
      if (sub === 'add') { notes[key].push({ content: interaction.options.getString('contenu'), date: new Date().toISOString() }); saveNotes(notes); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Note #${notes[key].length} ajoutee.`)], ephemeral: true }); }
      else if (sub === 'list') { if (!notes[key]?.length) return interaction.reply({ content: 'Aucune note.', ephemeral: true }); const desc = notes[key].map((n, i) => `**${i + 1}.** ${n.content}`).join('\n'); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('📝 Tes notes').setDescription(desc)], ephemeral: true }); }
      else if (sub === 'delete') { const id = interaction.options.getInteger('id') - 1; if (!notes[key]?.[id]) return interaction.reply({ content: 'Note introuvable.', ephemeral: true }); notes[key].splice(id, 1); saveNotes(notes); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('Note supprimee.')], ephemeral: true }); }
      else if (sub === 'clear') { notes[key] = []; saveNotes(notes); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('Toutes les notes supprimees.')], ephemeral: true }); }
    }
    else if (group === 'levelreward') {
      const all = loadSettings(); if (!all[guild.id]) all[guild.id] = {}; if (!all[guild.id].levelRewards) all[guild.id].levelRewards = {};
      if (sub === 'add') { const lvl = interaction.options.getInteger('niveau'); const role = interaction.options.getRole('role'); all[guild.id].levelRewards[lvl] = role.id; saveSettings(all); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Role ${role} attribue automatiquement au niveau **${lvl}**.`)] }); }
      else if (sub === 'list') { const rewards = all[guild.id].levelRewards || {}; const entries = Object.entries(rewards).sort((a, b) => a[0] - b[0]); if (!entries.length) return interaction.reply({ content: 'Aucune recompense.', ephemeral: true }); const desc = entries.map(([lvl, rId]) => { const r = guild.roles.cache.get(rId); return `Niveau **${lvl}** → ${r || 'Role supprime'}`; }).join('\n'); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🎁 Recompenses de niveaux').setDescription(desc)] }); }
      else if (sub === 'remove') { const lvl = interaction.options.getInteger('niveau'); delete all[guild.id].levelRewards[lvl]; saveSettings(all); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Recompense du niveau ${lvl} supprimee.`)] }); }
    }
    else if (group === 'ticket') {
      if (!channel.name.startsWith('ticket-')) return interaction.reply({ content: 'Ce n\'est pas un ticket.', ephemeral: true });
      if (sub === 'add') { const u = interaction.options.getUser('membre'); await channel.permissionOverwrites.edit(u.id, { ViewChannel: true, SendMessages: true }); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`${u} ajoute au ticket.`)] }); }
      else if (sub === 'remove') { const u = interaction.options.getUser('membre'); await channel.permissionOverwrites.delete(u.id); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`${u} retire du ticket.`)] }); }
      else if (sub === 'rename') { const nom = interaction.options.getString('nom'); await channel.setName(`ticket-${nom}`); await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Ticket renomme en **ticket-${nom}**.`)] }); }
    }

    // ─── Profils personnalises ────────────────────────────────────────
    else if (group === 'profile') {
      const profiles = loadProfiles();

      if (sub === 'view') {
        const user = interaction.options.getUser('membre') || interaction.user;
        const key = `${guild.id}-${user.id}`;
        const p = profiles[key] || {};
        const marriages = loadMarriages();
        const marriage = marriages[key];
        const levels = loadLevels();
        const lvlData = levels[key] || { xp: 0, totalMessages: 0 };
        const level = getLevelFromXp(lvlData.xp);
        const ecoData = getEcoUser(guild.id, user.id).data;
        const vStats = loadVoiceStats()[key] || { totalMs: 0, sessions: 0 };
        const streak = getDailyStreak(ecoData);

        const color = p.color ? parseInt(p.color.replace('#', ''), 16) : COLORS.LEVEL;
        const targetMember = await guild.members.fetch(user.id).catch(() => null);

        let partnerLine = '';
        if (marriage) {
          const partner = await client.users.fetch(marriage.partnerId).catch(() => null);
          const days = Math.floor((Date.now() - new Date(marriage.date).getTime()) / 86400000);
          partnerLine = `> 💍  Marie(e) avec **${partner?.tag || '?'}** (${days}j)`;
        }

        const lines = [
          p.title ? `### ${p.title}` : '',
          '',
          p.bio ? `> *${p.bio}*` : '',
          '',
          `> ⭐  Niveau **${level}**  ┃  ✨  **${lvlData.xp.toLocaleString()}** XP`,
          `> 💰  **${ecoData.balance.toLocaleString()}** pieces  ┃  🏦  **${(ecoData.bank || 0).toLocaleString()}** en banque`,
          `> 💬  **${lvlData.totalMessages.toLocaleString()}** messages  ┃  🎙️  **${formatVoiceTime(vStats.totalMs)}** en vocal`,
          streak > 1 ? `> 🔥  Serie de **${streak}** jours (record: ${ecoData.bestStreak || streak})` : null,
          partnerLine || null,
          '',
          `> 📅  Membre depuis <t:${Math.floor((targetMember?.joinedTimestamp || Date.now()) / 1000)}:R>`,
        ].filter(l => l !== null);

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .setDescription(lines.join('\n'))
            .setFooter(BOT_FOOTER)
            .setTimestamp()],
        });
      }

      else if (sub === 'bio') {
        const texte = interaction.options.getString('texte').slice(0, 200);
        const key = `${guild.id}-${interaction.user.id}`;
        if (!profiles[key]) profiles[key] = {};
        profiles[key].bio = texte;
        saveProfiles(profiles);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`✅ Bio mise a jour :\n> *${texte}*`)], ephemeral: true });
      }

      else if (sub === 'color') {
        const couleur = interaction.options.getString('couleur');
        if (!/^#?[0-9a-fA-F]{6}$/.test(couleur)) return interaction.reply({ content: 'Format invalide. Utilise un hex comme `#ff6b9d`.', ephemeral: true });
        const key = `${guild.id}-${interaction.user.id}`;
        if (!profiles[key]) profiles[key] = {};
        profiles[key].color = couleur.startsWith('#') ? couleur : `#${couleur}`;
        saveProfiles(profiles);
        const c = parseInt(profiles[key].color.replace('#', ''), 16);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(c).setDescription(`✅ Couleur de profil : **${profiles[key].color}**`)], ephemeral: true });
      }

      else if (sub === 'title') {
        const titre = interaction.options.getString('titre').slice(0, 50);
        const key = `${guild.id}-${interaction.user.id}`;
        if (!profiles[key]) profiles[key] = {};
        profiles[key].title = titre;
        saveProfiles(profiles);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`✅ Titre : **${titre}**`)], ephemeral: true });
      }

      else if (sub === 'reset') {
        delete profiles[`${guild.id}-${interaction.user.id}`];
        saveProfiles(profiles);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('✅ Profil reinitialise.')], ephemeral: true });
      }
    }

    // ─── Stats vocales ────────────────────────────────────────────────
    else if (group === 'voicestats') {
      if (sub === 'view') {
        const user = interaction.options.getUser('membre') || interaction.user;
        const key = `${guild.id}-${user.id}`;
        const stats = loadVoiceStats();
        const data = stats[key] || { totalMs: 0, sessions: 0 };

        let currentSession = '';
        if (voiceSessions.has(key)) {
          const elapsed = Date.now() - voiceSessions.get(key);
          currentSession = `\n> 🟢  En vocal actuellement (**${formatVoiceTime(elapsed)}**)`;
        }

        const allUsers = Object.entries(stats).filter(([k]) => k.startsWith(guild.id)).sort((a, b) => b[1].totalMs - a[1].totalMs);
        const rankPos = allUsers.findIndex(([k]) => k === key) + 1;
        const avgSession = data.sessions > 0 ? formatVoiceTime(data.totalMs / data.sessions) : '0s';

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.LEVEL)
            .setAuthor({ name: `Stats vocales — ${user.tag}`, iconURL: user.displayAvatarURL() })
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .setDescription([
              '',
              `> 🎙️  Temps total : **${formatVoiceTime(data.totalMs)}**`,
              `> 📊  Sessions : **${data.sessions}**`,
              `> ⏱️  Moyenne par session : **${avgSession}**`,
              `> 🏆  Classement : **#${rankPos || '?'}**`,
              currentSession,
            ].filter(Boolean).join('\n'))
            .setFooter(BOT_FOOTER)
            .setTimestamp()],
        });
      }

      else if (sub === 'leaderboard') {
        const stats = loadVoiceStats();
        const sorted = Object.entries(stats).filter(([k]) => k.startsWith(guild.id)).sort((a, b) => b[1].totalMs - a[1].totalMs).slice(0, 10);
        if (!sorted.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Aucune donnee vocale.')], ephemeral: true });

        const desc = await Promise.all(sorted.map(async ([key, data], i) => {
          const userId = key.split('-')[1];
          const u = await client.users.fetch(userId).catch(() => null);
          const medal = ['🥇','🥈','🥉'][i] || `**${i + 1}.**`;
          return `${medal} ${u?.tag || 'Inconnu'} — **${formatVoiceTime(data.totalMs)}** (${data.sessions} sessions)`;
        }));

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.LEVEL)
            .setTitle('🎙️ Top 10 — Temps en vocal')
            .setDescription(desc.join('\n'))
            .setFooter(BOT_FOOTER)
            .setTimestamp()],
        });
      }

      else if (sub === 'reset') {
        const user = interaction.options.getUser('membre');
        const stats = loadVoiceStats();
        delete stats[`${guild.id}-${user.id}`];
        saveVoiceStats(stats);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Stats vocales de **${user.tag}** reinitialise.`)] });
      }
    }

    // ─── Playlists personnelles ───────────────────────────────────────
    else if (group === 'playlist') {
      const playlists = loadPlaylists();
      const userKey = interaction.user.id;
      if (!playlists[userKey]) playlists[userKey] = {};

      if (sub === 'save') {
        const nom = interaction.options.getString('nom').toLowerCase().replace(/[^a-z0-9-_]/g, '');
        if (!nom) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Nom invalide (lettres, chiffres, tirets).')], ephemeral: true });
        if (!queue.tracks.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('La file d\'attente est vide.')], ephemeral: true });
        if (Object.keys(playlists[userKey]).length >= 25) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Maximum 25 playlists. Supprime-en une d\'abord.')], ephemeral: true });

        playlists[userKey][nom] = queue.tracks.map(t => ({ url: t.url, title: t.title, duration: t.duration, durationSec: t.durationSec, thumbnail: t.thumbnail }));
        savePlaylists(playlists);

        const totalDur = queue.tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.MUSIC)
            .setTitle('💾 Playlist sauvegardee')
            .setDescription([
              `> 📁  **${nom}**`,
              `> 🎵  **${queue.tracks.length}** piste${queue.tracks.length > 1 ? 's' : ''}`,
              `> 🕐  Duree totale : **${formatDuration(totalDur)}**`,
              '',
              `Utilise \`/manage playlist load ${nom}\` pour la recharger.`,
            ].join('\n'))
            .setFooter(BOT_FOOTER).setTimestamp()],
        });
      }

      else if (sub === 'load') {
        const nom = interaction.options.getString('nom').toLowerCase();
        if (!playlists[userKey]?.[nom]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Playlist **${nom}** introuvable. Utilise \`/manage playlist list\`.`)], ephemeral: true });
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois etre dans un salon vocal.')], ephemeral: true });

        const tracks = playlists[userKey][nom].map(t => ({ ...t, requestedBy: member.user.tag }));
        queue.tracks.push(...tracks);
        queue.textChannel = channel;

        if (!queue.connection) {
          setupConnection(queue, voiceChannel, guild);
          playNext(guild.id);
        }

        const totalDur = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.MUSIC)
            .setTitle('📂 Playlist chargee')
            .setDescription([
              `> 📁  **${nom}**`,
              `> 🎵  **${tracks.length}** piste${tracks.length > 1 ? 's' : ''} ajoutee${tracks.length > 1 ? 's' : ''}`,
              `> 🕐  Duree : **${formatDuration(totalDur)}**`,
            ].join('\n'))
            .setFooter(BOT_FOOTER).setTimestamp()],
        });
      }

      else if (sub === 'list') {
        const userPlaylists = playlists[userKey] || {};
        const names = Object.keys(userPlaylists);
        if (!names.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Tu n\'as aucune playlist sauvegardee.\nUtilise `/manage playlist save <nom>` pendant qu\'une file joue.')], ephemeral: true });

        const desc = names.map(name => {
          const tracks = userPlaylists[name];
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
        });
      }

      else if (sub === 'delete') {
        const nom = interaction.options.getString('nom').toLowerCase();
        if (!playlists[userKey]?.[nom]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Playlist **${nom}** introuvable.`)], ephemeral: true });
        delete playlists[userKey][nom];
        savePlaylists(playlists);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`🗑️ Playlist **${nom}** supprimee.`)], ephemeral: true });
      }

      else if (sub === 'view') {
        const nom = interaction.options.getString('nom').toLowerCase();
        if (!playlists[userKey]?.[nom]) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Playlist **${nom}** introuvable.`)], ephemeral: true });
        const tracks = playlists[userKey][nom];
        const totalDur = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
        const list = tracks.slice(0, 15).map((t, i) => `\`${i + 1}.\` ${t.title} — \`${t.duration}\``).join('\n');

        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.MUSIC)
            .setTitle(`📁 ${nom}`)
            .setDescription(list + (tracks.length > 15 ? `\n*...et ${tracks.length - 15} autres*` : ''))
            .setFooter({ text: `${tracks.length} pistes  ┃  ${formatDuration(totalDur)}  ┃  ${BOT_FOOTER.text}` })
            .setTimestamp()],
        });
      }
    }

    // ─── Config anniversaires ─────────────────────────────────────────
    else if (group === 'birthdayconfig') {
      if (sub === 'channel') {
        const ch = interaction.options.getChannel('salon');
        setGuildSetting(guild.id, 'birthdayChannel', ch?.id || null);
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.PLAY)
            .setDescription(ch
              ? `🎂 Annonces d'anniversaire dans ${ch}.\nLe bot verifie automatiquement chaque heure et souhaite un bon anniversaire aux membres qui ont defini leur date avec \`/manage birthday set\`.`
              : 'Annonces d\'anniversaire desactivees.')
            .setFooter(BOT_FOOTER).setTimestamp()],
        });
      }
    }
  }
});

const { ActivityType } = require('discord.js');

client.once('ready', () => {
  console.log(`Connecte en tant que ${client.user.tag}`);

  let statusIndex = 0;
  const updateStatus = () => {
    const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    const totalServers = client.guilds.cache.size;
    const activePlayers = queues.size;
    const up = formatUptime(Date.now() - startTime);

    const statuses = [
      { text: `/help | 200+ commandes` },
      { text: `Uptime: ${up}` },
      { text: `/play pour ecouter de la musique` },
      { text: `WHP CORE` },
    ];

    const s = statuses[statusIndex % statuses.length];
    client.user.setActivity(s.text, { type: ActivityType.Streaming, url: 'https://twitch.tv/whipping' });
    statusIndex++;
  };

  updateStatus();
  setInterval(updateStatus, 30000);

  // Anniversaire auto check toutes les heures
  setInterval(() => {
    const bdays = loadBirthdays();
    const now = new Date();
    const today = `${now.getDate()}/${now.getMonth() + 1}`;
    client.guilds.cache.forEach(async (g) => {
      const s = getGuildSettings(g.id);
      if (!s.welcomeChannel && !s.birthdayChannel) return;
      const ch = g.channels.cache.get(s.birthdayChannel || s.welcomeChannel);
      if (!ch) return;

      Object.entries(bdays).forEach(async ([key, date]) => {
        if (!key.startsWith(g.id)) return;
        const [d, m] = date.split('/');
        if (parseInt(d) === now.getDate() && parseInt(m) === now.getMonth() + 1) {
          const userId = key.split('-')[1];
          const checked = loadSettings();
          const checkKey = `bday_sent_${key}_${now.getFullYear()}`;
          if (checked[checkKey]) return;
          checked[checkKey] = true;
          saveSettings(checked);

          const user = await client.users.fetch(userId).catch(() => null);
          if (!user) return;
          ch.send({
            content: `${user}`,
            embeds: [new EmbedBuilder()
              .setColor(0xf1c40f)
              .setTitle('🎂🎉 Joyeux anniversaire !')
              .setDescription(`Aujourd'hui c'est l'anniversaire de **${user.tag}** !\n\nTout le monde lui souhaite un bon anniversaire ! 🥳🎁🎈`)
              .setThumbnail(user.displayAvatarURL({ size: 256 }))
              .setFooter(BOT_FOOTER)
              .setTimestamp()],
          }).catch(() => {});
        }
      });
    });
  }, 3600000);
});

// Health check HTTP server for Render
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: formatUptime(Date.now() - startTime) }));
}).listen(PORT, () => console.log(`Health check sur le port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
