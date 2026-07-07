require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ActivityType, MessageFlags } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType } = require('@discordjs/voice');
const playdl = require('play-dl');
const { execFile, spawn } = require('child_process');
const path = require('path');

const FFMPEG_PATH = require('ffmpeg-static');
const YTDLP = process.platform === 'win32' ? path.join(__dirname, 'yt-dlp.exe') : path.join(__dirname, 'yt-dlp');
const YTDLP_BASE_ARGS = ['--no-warnings', '--js-runtimes', `node[${process.execPath}]`];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers],
});

const queues = new Map();
const startTime = Date.now();

const COLORS = { PLAY: 0x2ecc71, QUEUE: 0x3498db, STOP: 0xe74c3c, WARN: 0xf39c12, INFO: 0x5865f2, MUSIC: 0x1db954 };
const BOT_FOOTER = { text: '𝗪𝗵𝗶𝗽𝗽𝗶𝗻𝗴 𝗕𝗼𝘁 ━━━━━━━━━━━━━━━━━━' };
const LOOP_LABELS = { off: 'Off', track: 'Piste', queue: 'File' };
const LOOP_CYCLE = ['off', 'track', 'queue'];
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      tracks: [], player: null, connection: null, volume: 0.5,
      loopMode: 'off', textChannel: null, idleTimer: null,
      nowPlayingMsg: null, paused: false, stay247: false,
      history: [], startedAt: 0, pausedAt: 0, totalPausedMs: 0,
      forceReplay: false, voiceChannel: null,
    });
  }
  return queues.get(guildId);
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '?:??';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24, d = Math.floor(ms / 86400000);
  return [d && `${d}j`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

function getElapsedMs(queue) {
  if (!queue.startedAt) return 0;
  if (queue.paused && queue.pausedAt) return queue.pausedAt - queue.startedAt - queue.totalPausedMs;
  return Date.now() - queue.startedAt - queue.totalPausedMs;
}

function buildProgressBar(elapsedSec, totalSec) {
  if (!totalSec || totalSec <= 0) return null;
  const ratio = Math.min(Math.max(elapsedSec / totalSec, 0), 1);
  const pos = Math.round(ratio * 22);
  return `\`${'━'.repeat(pos)}${'─'.repeat(22 - pos)}\` ${formatDuration(Math.floor(elapsedSec))} / ${formatDuration(totalSec)}`;
}

function buildNowPlayingEmbed(track, queue) {
  const elapsed = Math.floor(getElapsedMs(queue) / 1000);
  const bar = buildProgressBar(elapsed, track.durationSec);
  const loopEmoji = queue.loopMode === 'queue' ? '🔂' : queue.loopMode === 'track' ? '🔁' : '';
  return new EmbedBuilder()
    .setColor(queue.paused ? COLORS.WARN : COLORS.MUSIC)
    .setAuthor({ name: queue.paused ? '⏸️  En pause' : '▶️  Lecture en cours' })
    .setTitle(track.title.length > 256 ? track.title.slice(0, 253) + '...' : track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail || null)
    .setDescription([
      bar,
      `> 🔉 Volume : **${Math.round(queue.volume * 100)}%**  ┃  Boucle : **${LOOP_LABELS[queue.loopMode]}** ${loopEmoji}`,
      `> 📋 File : **${queue.tracks.length}** piste(s)  ┃  Demandé par **${track.requestedBy || '?'}**`,
      queue.stay247 ? '> 🟢 Mode 24/7 actif' : null,
    ].filter(Boolean).join('\n'))
    .setFooter(BOT_FOOTER).setTimestamp();
}

function buildPlayerRows(queue) {
  const loopStyle = queue.loopMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success;
  const loopEmoji = queue.loopMode === 'queue' ? '🔂' : '🔁';
  const vol = Math.round(queue.volume * 100);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(!queue.history.length),
      new ButtonBuilder().setCustomId('music_seekback').setEmoji('⏪').setLabel('-10s').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_pause_resume').setEmoji(queue.paused ? '▶️' : '⏸️').setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_seekfwd').setEmoji('⏩').setLabel('+10s').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music_loop').setEmoji(loopEmoji).setLabel(LOOP_LABELS[queue.loopMode]).setStyle(loopStyle),
      new ButtonBuilder().setCustomId('music_replay').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_247').setEmoji(queue.stay247 ? '🟢' : '🔘').setLabel('24/7').setStyle(queue.stay247 ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_voldown').setLabel(`${vol}%`).setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(vol <= 0),
      new ButtonBuilder().setCustomId('music_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(vol >= 100),
    ),
  ];
}

async function updateNowPlayingMsg(queue) {
  if (!queue.nowPlayingMsg || !queue.tracks[0]) return;
  try {
    await queue.nowPlayingMsg.edit({ embeds: [buildNowPlayingEmbed(queue.tracks[0], queue)], components: buildPlayerRows(queue) });
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
  if (!queue || queue.stay247) return;
  clearTimeout(queue.idleTimer);
  queue.idleTimer = setTimeout(() => {
    queue.textChannel?.send({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('Inactif depuis 5 minutes, je me déconnecte.')] });
    destroyQueue(guildId);
  }, IDLE_TIMEOUT_MS);
}

// Résoudre une piste YouTube (URL ou recherche)
async function resolveTrack(query) {
  const isUrl = query.startsWith('http://') || query.startsWith('https://');

  if (isUrl && (query.includes('list=') || query.includes('/playlist'))) {
    const pl = await playdl.playlist_info(query, { incomplete: true });
    const videos = await pl.all_videos();
    return videos.map(v => ({
      url: v.url, title: v.title || 'Titre inconnu',
      duration: formatDuration(v.durationInSec), durationSec: v.durationInSec || 0,
      thumbnail: v.thumbnails?.[0]?.url || null, requestedBy: null,
    }));
  }

  let video;
  if (isUrl) {
    const info = await playdl.video_info(query);
    video = info.video_details;
  } else {
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (!results.length) return null;
    video = results[0];
  }

  return {
    url: video.url, title: video.title || 'Titre inconnu',
    duration: formatDuration(video.durationInSec), durationSec: video.durationInSec || 0,
    thumbnail: video.thumbnails?.[0]?.url || null, requestedBy: null,
  };
}

// Résoudre une playlist via /playlist command
async function resolvePlaylist(query) {
  const isUrl = query.startsWith('http://') || query.startsWith('https://');
  let playlistUrl = query;
  if (!isUrl) {
    const results = await playdl.search(query, { source: { youtube: 'playlist' }, limit: 1 });
    if (!results.length) throw new Error('Aucune playlist trouvée.');
    playlistUrl = results[0].url;
  }
  const pl = await playdl.playlist_info(playlistUrl, { incomplete: true });
  const videos = await pl.all_videos();
  return {
    tracks: videos.map(v => ({
      url: v.url, title: v.title || 'Titre inconnu',
      duration: formatDuration(v.durationInSec), durationSec: v.durationInSec || 0,
      thumbnail: v.thumbnails?.[0]?.url || null, requestedBy: null,
    })),
    title: pl.title || playlistUrl,
  };
}

function getAudioUrl(videoUrl) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, [...YTDLP_BASE_ARGS, '--get-url', '-f', 'bestaudio', '--no-playlist', videoUrl],
      { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || err.message).split('\n')[0]));
        const url = stdout.trim().split('\n')[0];
        if (!url) return reject(new Error('yt-dlp returned empty URL'));
        resolve(url);
      });
  });
}

function spawnFfmpeg(audioUrl, startSec = 0) {
  const args = [
    '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
    ...(startSec > 0 ? ['-ss', String(Math.floor(startSec))] : []),
    '-i', audioUrl,
    '-vn', '-f', 'opus', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-loglevel', 'error', 'pipe:1',
  ];
  const proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stderr.on('data', d => { const m = d.toString().trim(); if (m) console.error('[ffmpeg]', m); });
  return proc.stdout;
}

async function playNext(guildId) {
  const queue = getQueue(guildId);
  if (!queue.tracks.length) {
    if (queue.nowPlayingMsg) {
      queue.nowPlayingMsg.edit({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('File d\'attente terminée.')], components: [] }).catch(() => {});
      queue.nowPlayingMsg = null;
    }
    startIdleTimer(guildId);
    return;
  }

  clearTimeout(queue.idleTimer);
  queue.paused = false;
  const track = queue.tracks[0];

  try {
    console.log(`[play] Récupération URL pour: ${track.title}`);
    const audioUrl = await getAudioUrl(track.url);
    console.log(`[play] URL obtenue, lancement ffmpeg`);
    const stream = spawnFfmpeg(audioUrl);
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true });
    resource.volume?.setVolume(queue.volume);
    queue.player.play(resource);
    queue.startedAt = Date.now();
    queue.pausedAt = 0;
    queue.totalPausedMs = 0;

    const embed = buildNowPlayingEmbed(track, queue);
    const rows = buildPlayerRows(queue);
    if (queue.nowPlayingMsg) {
      queue.nowPlayingMsg.edit({ embeds: [embed], components: rows }).catch(async () => {
        queue.nowPlayingMsg = await queue.textChannel?.send({ embeds: [embed], components: rows });
      });
    } else {
      queue.nowPlayingMsg = await queue.textChannel?.send({ embeds: [embed], components: rows });
    }
  } catch (err) {
    console.error('Erreur lecture:', err.message);
    queue.textChannel?.send({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription(`Impossible de lire **${track.title}**. Passage à la suivante...`)] });
    queue.tracks.shift();
    playNext(guildId);
  }
}

async function seekTo(guildId, targetSec) {
  const queue = getQueue(guildId);
  if (!queue.tracks.length || !queue.player) return;
  const track = queue.tracks[0];
  const sec = Math.max(0, Math.min(targetSec, (track.durationSec || 0) - 1));
  try {
    const audioUrl = await getAudioUrl(track.url);
    const stream = spawnFfmpeg(audioUrl, sec);
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true });
    resource.volume?.setVolume(queue.volume);
    queue.forceReplay = true;
    queue.player.play(resource);
    queue.startedAt = Date.now() - sec * 1000;
    queue.totalPausedMs = 0;
    queue.pausedAt = 0;
    queue.paused = false;
    await updateNowPlayingMsg(queue);
  } catch (err) {
    console.error('Seek error:', err.message);
  }
}

function setupConnection(queue, voiceChannel, guild) {
  queue.voiceChannel = voiceChannel;
  queue.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
  queue.player = createAudioPlayer();
  queue.connection.subscribe(queue.player);

  queue.player.on(AudioPlayerStatus.Idle, () => {
    if (queue.forceReplay) {
      queue.forceReplay = false;
    } else if (queue.loopMode === 'off') {
      const played = queue.tracks.shift();
      if (played) { queue.history.push(played); if (queue.history.length > 50) queue.history.shift(); }
    } else if (queue.loopMode === 'queue') {
      const played = queue.tracks.shift();
      if (played) { queue.history.push(played); queue.tracks.push(played); if (queue.history.length > 50) queue.history.shift(); }
    }
    playNext(guild.id);
  });

  queue.player.on('error', err => {
    console.error('Player error:', err.message);
    queue.tracks.shift();
    playNext(guild.id);
  });

  queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(queue.connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch { destroyQueue(guild.id); }
  });
}

// ─── Interactions ──────────────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {

  // Boutons du lecteur
  if (interaction.isButton() && interaction.customId.startsWith('music_')) {
    const queue = getQueue(interaction.guild.id);
    if (!queue.connection) return interaction.reply({ content: 'Aucune lecture en cours.', flags: MessageFlags.Ephemeral });
    const action = interaction.customId;

    if (action === 'music_pause_resume') {
      if (queue.paused) {
        queue.player.unpause();
        if (queue.pausedAt) queue.totalPausedMs += Date.now() - queue.pausedAt;
        queue.pausedAt = 0; queue.paused = false;
      } else {
        queue.player.pause(); queue.pausedAt = Date.now(); queue.paused = true;
      }
      await updateNowPlayingMsg(queue);
      await interaction.deferUpdate();
    }
    else if (action === 'music_skip') { queue.loopMode = 'off'; queue.tracks.shift(); playNext(interaction.guild.id); await interaction.deferUpdate(); }
    else if (action === 'music_stop') {
      const msg = queue.nowPlayingMsg; destroyQueue(interaction.guild.id);
      if (msg) msg.edit({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Lecture arrêtée.')], components: [] }).catch(() => {});
      await interaction.deferUpdate();
    }
    else if (action === 'music_prev') {
      if (queue.history.length) { const p = queue.history.pop(); queue.tracks.unshift(p); queue.forceReplay = true; queue.player.stop(true); }
      await interaction.deferUpdate();
    }
    else if (action === 'music_loop') {
      queue.loopMode = LOOP_CYCLE[(LOOP_CYCLE.indexOf(queue.loopMode) + 1) % LOOP_CYCLE.length];
      await updateNowPlayingMsg(queue); await interaction.deferUpdate();
    }
    else if (action === 'music_replay') {
      if (queue.tracks.length) { queue.forceReplay = true; queue.player.stop(true); }
      await interaction.deferUpdate();
    }
    else if (action === 'music_voldown') {
      queue.volume = Math.max(0, queue.volume - 0.1);
      queue.player?._state?.resource?.volume?.setVolume(queue.volume);
      await updateNowPlayingMsg(queue); await interaction.deferUpdate();
    }
    else if (action === 'music_volup') {
      queue.volume = Math.min(1, queue.volume + 0.1);
      queue.player?._state?.resource?.volume?.setVolume(queue.volume);
      await updateNowPlayingMsg(queue); await interaction.deferUpdate();
    }
    else if (action === 'music_seekback' || action === 'music_seekfwd') {
      if (queue.tracks.length) {
        const offset = action === 'music_seekfwd' ? 10 : -10;
        await seekTo(interaction.guild.id, getElapsedMs(queue) / 1000 + offset);
      }
      await interaction.deferUpdate();
    }
    else if (action === 'music_247') {
      queue.stay247 = !queue.stay247;
      if (queue.stay247) clearTimeout(queue.idleTimer);
      await updateNowPlayingMsg(queue); await interaction.deferUpdate();
    }
    else if (action === 'debug_restart') {
      await interaction.update({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('🔄 Redémarrage...')], components: [] });
      setTimeout(() => process.exit(0), 1000);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, member, channel } = interaction;
  const voiceChannel = member.voice.channel;
  const queue = getQueue(guild.id);

  // ── /play ────────────────────────────────────────────────────────────────────
  if (commandName === 'play') {
    if (!voiceChannel) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois être dans un salon vocal !')], flags: MessageFlags.Ephemeral });
    const query = interaction.options.getString('query');
    await interaction.deferReply();
    try {
      const result = await resolveTrack(query);
      if (!result) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucun résultat trouvé.')] });
      const tracks = Array.isArray(result) ? result : [result];
      tracks.forEach(t => { t.requestedBy = member.user.tag; });
      queue.tracks.push(...tracks);
      queue.textChannel = channel;
      if (!queue.connection) { setupConnection(queue, voiceChannel, guild); playNext(guild.id); }
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Array.isArray(result) ? COLORS.QUEUE : COLORS.PLAY).setDescription(Array.isArray(result) ? `**${tracks.length} pistes** ajoutées depuis la playlist` : queue.tracks.length === 1 ? `Lecture de **${tracks[0].title}**` : `Ajouté en file : **${tracks[0].title}** (position ${queue.tracks.length})`)] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors de la recherche ou lecture.')] });
    }
  }

  // ── /skip ────────────────────────────────────────────────────────────────────
  else if (commandName === 'skip') {
    if (!queue.player || !queue.tracks.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')], flags: MessageFlags.Ephemeral });
    const skipped = queue.tracks[0]; queue.loopMode = 'off'; queue.tracks.shift(); playNext(guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`Passée : **${skipped.title}**`)] });
  }

  // ── /stop ────────────────────────────────────────────────────────────────────
  else if (commandName === 'stop') {
    if (!queue.connection) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Pas de connexion active.')], flags: MessageFlags.Ephemeral });
    destroyQueue(guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Lecture arrêtée et file vidée.')] });
  }

  // ── /pause / /resume ─────────────────────────────────────────────────────────
  else if (commandName === 'pause') {
    if (!queue.player) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')], flags: MessageFlags.Ephemeral });
    queue.player.pause(); queue.pausedAt = Date.now(); queue.paused = true;
    await updateNowPlayingMsg(queue);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('⏸️ Lecture en pause.')] });
  }
  else if (commandName === 'resume') {
    if (!queue.player) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')], flags: MessageFlags.Ephemeral });
    queue.player.unpause(); if (queue.pausedAt) queue.totalPausedMs += Date.now() - queue.pausedAt; queue.pausedAt = 0; queue.paused = false;
    await updateNowPlayingMsg(queue);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription('▶️ Lecture reprise !')] });
  }

  // ── /queue ───────────────────────────────────────────────────────────────────
  else if (commandName === 'queue') {
    if (!queue.tracks.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('File d\'attente vide.')], flags: MessageFlags.Ephemeral });
    const page = Math.max(1, interaction.options.getInteger('page') || 1);
    const perPage = 10, total = queue.tracks.length, maxPage = Math.ceil(total / perPage);
    const p = Math.min(page, maxPage);
    const list = queue.tracks.slice((p - 1) * perPage, p * perPage).map((t, i) => `\`${(p - 1) * perPage + i + 1}.\` **${t.title}** — \`${t.duration}\``).join('\n');
    const totalDur = queue.tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.QUEUE).setTitle('📋  File d\'attente').setDescription(list).setFooter({ text: `Page ${p}/${maxPage}  ┃  ${total} pistes  ┃  ${formatDuration(totalDur)}  ┃  ${BOT_FOOTER.text}` }).setTimestamp()] });
  }

  // ── /volume ──────────────────────────────────────────────────────────────────
  else if (commandName === 'volume') {
    const vol = interaction.options.getInteger('level');
    queue.volume = vol / 100;
    queue.player?._state?.resource?.volume?.setVolume(queue.volume);
    const bar = '█'.repeat(Math.round(vol / 10)) + '░'.repeat(10 - Math.round(vol / 10));
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription(`Volume : ${bar} **${vol}%**`)] });
  }

  // ── /loop ────────────────────────────────────────────────────────────────────
  else if (commandName === 'loop') {
    queue.loopMode = LOOP_CYCLE[(LOOP_CYCLE.indexOf(queue.loopMode) + 1) % LOOP_CYCLE.length];
    await updateNowPlayingMsg(queue);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(queue.loopMode !== 'off' ? COLORS.PLAY : COLORS.WARN).setDescription(`Boucle : **${LOOP_LABELS[queue.loopMode]}**`)] });
  }

  // ── /nowplaying ──────────────────────────────────────────────────────────────
  else if (commandName === 'nowplaying') {
    if (!queue.tracks.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')], flags: MessageFlags.Ephemeral });
    const current = queue.tracks[0];
    const { resource: npResource } = await interaction.reply({ embeds: [buildNowPlayingEmbed(current, queue)], components: buildPlayerRows(queue), withResponse: true });
    queue.nowPlayingMsg = npResource.message;
  }

  // ── /clear ───────────────────────────────────────────────────────────────────
  else if (commandName === 'clear') {
    if (queue.tracks.length <= 1) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.WARN).setDescription('La file est déjà vide.')], flags: MessageFlags.Ephemeral });
    const current = queue.tracks[0]; queue.tracks = [current];
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.INFO).setDescription('File d\'attente vidée (la piste en cours continue).')] });
  }

  // ── /replay ──────────────────────────────────────────────────────────────────
  else if (commandName === 'replay') {
    if (!queue.player || !queue.tracks.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Rien en cours.')], flags: MessageFlags.Ephemeral });
    queue.forceReplay = true; queue.player.stop(true);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Rejoue : **${queue.tracks[0].title}**`)] });
  }

  // ── /previous ────────────────────────────────────────────────────────────────
  else if (commandName === 'previous') {
    if (!queue.history.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucune piste précédente.')], flags: MessageFlags.Ephemeral });
    const prev = queue.history.pop(); queue.tracks.unshift(prev); queue.forceReplay = true; queue.player?.stop(true);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Retour à : **${prev.title}**`)] });
  }

  // ── /247 ─────────────────────────────────────────────────────────────────────
  else if (commandName === '247') {
    queue.stay247 = !queue.stay247;
    if (queue.stay247) clearTimeout(queue.idleTimer);
    await updateNowPlayingMsg(queue);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(queue.stay247 ? COLORS.PLAY : COLORS.WARN).setDescription(queue.stay247 ? '🟢 Mode 24/7 activé.' : '🔘 Mode 24/7 désactivé.')] });
  }

  // ── /playlist ────────────────────────────────────────────────────────────────
  else if (commandName === 'playlist') {
    if (!voiceChannel) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois être dans un salon vocal !')], flags: MessageFlags.Ephemeral });
    const query = interaction.options.getString('query');
    await interaction.deferReply();
    try {
      const { tracks, title } = await resolvePlaylist(query);
      if (!tracks.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucune playlist trouvée.')] });
      tracks.forEach(t => { t.requestedBy = member.user.tag; });
      queue.tracks.push(...tracks); queue.textChannel = channel;
      if (!queue.connection) { setupConnection(queue, voiceChannel, guild); playNext(guild.id); }
      const totalDur = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.QUEUE).setTitle('Playlist ajoutée').setDescription(`**${tracks.length}** pistes ajoutées à la file`).addFields({ name: 'Durée totale', value: formatDuration(totalDur), inline: true }, { name: 'Demandé par', value: member.user.tag, inline: true })] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors du chargement de la playlist.')] });
    }
  }

  // ── /search ──────────────────────────────────────────────────────────────────
  else if (commandName === 'search') {
    if (!voiceChannel) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Tu dois être dans un salon vocal !')], flags: MessageFlags.Ephemeral });
    const query = interaction.options.getString('query');
    await interaction.deferReply();
    try {
      const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 5 });
      if (!results.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucun résultat.')] });
      const menu = new StringSelectMenuBuilder().setCustomId('search_select').setPlaceholder('Choisis une piste...');
      const desc = results.map((r, i) => { menu.addOptions({ label: (r.title || 'Sans titre').slice(0, 100), description: formatDuration(r.durationInSec), value: `${i}` }); return `**${i + 1}.** [${r.title}](${r.url}) — \`${formatDuration(r.durationInSec)}\``; }).join('\n');
      const reply = await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.QUEUE).setTitle(`Résultats pour "${query}"`).setDescription(desc)], components: [new ActionRowBuilder().addComponents(menu)] });
      const collector = reply.createMessageComponentCollector({ time: 30_000 });
      collector.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;
        const r = results[parseInt(i.values[0])];
        const track = { url: r.url, title: r.title, duration: formatDuration(r.durationInSec), durationSec: r.durationInSec || 0, thumbnail: r.thumbnails?.[0]?.url, requestedBy: member.user.tag };
        queue.tracks.push(track); queue.textChannel = channel;
        if (!queue.connection) { setupConnection(queue, voiceChannel, guild); playNext(guild.id); }
        await i.update({ embeds: [new EmbedBuilder().setColor(COLORS.PLAY).setDescription(`Ajouté : **${track.title}**`)], components: [] });
        collector.stop();
      });
      collector.on('end', (_, r) => { if (r === 'time') interaction.editReply({ components: [] }).catch(() => {}); });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Erreur lors de la recherche.')] });
    }
  }

  // ── /help ────────────────────────────────────────────────────────────────────
  else if (commandName === 'help') {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.MUSIC).setTitle('🎵  Whipping Bot — Commandes').addFields(
      { name: '▸ Lecture', value: '`/play <recherche ou URL>` — Jouer une musique ou URL YouTube\n`/search <recherche>` — Choisir parmi 5 résultats\n`/playlist <recherche ou URL>` — Charger une playlist entière\n`/nowplaying` — Afficher la piste en cours\n`/pause` · `/resume` — Pause / reprendre\n`/stop` — Arrêter et vider la file\n`/replay` — Relancer depuis le début\n`/previous` — Revenir à la piste précédente' },
      { name: '▸ File d\'attente', value: '`/queue [page]` — Afficher la file (10 pistes par page)\n`/skip` — Passer à la piste suivante\n`/clear` — Vider la file (garde la piste en cours)' },
      { name: '▸ Contrôles', value: '`/volume <0-100>` — Régler le volume\n`/loop` — Cycle : Off → Piste 🔁 → File 🔂\n`/247` — Rester connecté en permanence dans le salon' },
      { name: '▸ Boutons du panel', value: '`⏮️` Préc  `⏪` -10s  `⏸️` Pause  `⏩` +10s  `⏭️` Suiv\n`⏹️` Stop  `🔁` Boucle  `🔄` Replay  `🟢` 24/7\n`🔉` Vol-  `🔊` Vol+' },
    ).setFooter(BOT_FOOTER).setTimestamp()] });
  }

  // ── /debug ───────────────────────────────────────────────────────────────────
  else if (commandName === 'debug') {
    const DEBUG_USERS = ['576468004863475746', '452381598663573506'];
    if (!DEBUG_USERS.includes(interaction.user.id)) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Accès refusé.')], flags: MessageFlags.Ephemeral });
    const up = formatUptime(Date.now() - startTime);
    const mem = process.memoryUsage();
    const elapsed = queue.tracks[0] ? formatDuration(Math.floor(getElapsedMs(queue) / 1000)) : '-';
    const { resource: dbResource } = await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.INFO).setTitle('🔧 Debug').setDescription([
        '```',
        `Bot      : ${client.user.tag}`, `Uptime   : ${up}`,
        `Mémoire  : ${Math.round(mem.heapUsed / 1024 / 1024)} MB / ${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
        `Ping     : ${Math.round(client.ws.ping)}ms`,
        `Conn.    : ${queue.connection?.state?.status || 'Déconnecté'}`,
        `Player   : ${queue.player?._state?.status || 'Aucun'}`,
        `Piste    : ${queue.tracks[0]?.title || 'Aucune'}`,
        `Position : ${elapsed} / ${queue.tracks[0]?.duration || '-'}`,
        `Volume   : ${Math.round(queue.volume * 100)}%`,
        `Loop     : ${queue.loopMode}`, `File     : ${queue.tracks.length} piste(s)`,
        '```',
      ].join('\n')).setFooter(BOT_FOOTER)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('debug_restart').setEmoji('🔄').setLabel('Redémarrer').setStyle(ButtonStyle.Danger))],
      flags: MessageFlags.Ephemeral, withResponse: true,
    });
    const dbMsg = dbResource.message;
    dbMsg.createMessageComponentCollector({ time: 60000 }).on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  }

  // ── /forcestop ───────────────────────────────────────────────────────────────
  else if (commandName === 'forcestop') {
    const DEBUG_USERS = ['576468004863475746', '452381598663573506'];
    if (!DEBUG_USERS.includes(interaction.user.id)) return interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Accès refusé.')], flags: MessageFlags.Ephemeral });
    destroyQueue(guild.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('⚠️ Lecteur forcé à l\'arrêt.').setFooter(BOT_FOOTER).setTimestamp()] });
  }
});

// ─── Ready ─────────────────────────────────────────────────────────────────────

client.once('clientReady', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  let i = 0;
  const statuses = ['/help', '/play pour écouter de la musique', 'WHP CORE'];
  const update = () => {
    const np = [...queues.values()].find(q => q.tracks.length && !q.paused);
    if (np?.tracks[0]) return client.user.setActivity(np.tracks[0].title, { type: ActivityType.Streaming, url: 'https://twitch.tv/whipping' });
    client.user.setActivity(statuses[i++ % statuses.length], { type: ActivityType.Streaming, url: 'https://twitch.tv/whipping' });
  };
  update(); setInterval(update, 15000);
});

// ─── Health check ──────────────────────────────────────────────────────────────

const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200); res.end(JSON.stringify({ status: 'ok', uptime: formatUptime(Date.now() - startTime) }));
}).listen(PORT, () => console.log(`Health check sur le port ${PORT}`));

client.on('error', console.error);
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));

client.login(process.env.DISCORD_TOKEN);
