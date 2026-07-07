require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const { execFile, spawn } = require('child_process');
const path = require('path');
const YTDLP = process.platform === 'win32' ? path.join(__dirname, 'yt-dlp.exe') : path.join(__dirname, 'yt-dlp');
const FFMPEG_PATH = require('ffmpeg-static');
const YTDLP_ARGS = [
  '--ffmpeg-location', path.dirname(FFMPEG_PATH),
  '--no-warnings',
  '--js-runtimes', `node[${process.execPath}]`,
];

function streamAudio(url) {
  const proc = spawn(YTDLP, [...YTDLP_ARGS, url, '-f', 'ba[ext=webm]/251/bestaudio[ext=webm]', '-o', '-', '--no-playlist'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stderr.on('data', d => console.error('[yt-dlp]', d.toString().trim()));
  proc.on('error', err => console.error('[yt-dlp spawn error]', err.message));
  return proc.stdout;
}

function ytdlpGetUrl(url) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, [...YTDLP_ARGS, '--get-url', '-f', 'bestaudio', '--no-playlist', url],
      { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout.trim().split('\n')[0]);
      });
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const queues = new Map();
const startTime = Date.now();



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
    new ButtonBuilder().setCustomId('music_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(!queue.history.length),
    new ButtonBuilder().setCustomId('music_seekback').setEmoji('⏪').setLabel('-10s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_pause_resume').setEmoji(queue.paused ? '▶️' : '⏸️').setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_seekfwd').setEmoji('⏩').setLabel('+10s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_loop').setEmoji(loopEmoji).setLabel(LOOP_LABELS[queue.loopMode]).setStyle(loopStyle),
    new ButtonBuilder().setCustomId('music_replay').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_247').setEmoji(queue.stay247 ? '🟢' : '🔘').setLabel('24/7').setStyle(queue.stay247 ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_voldown').setLabel(`${volPercent}%`).setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(volPercent <= 0),
    new ButtonBuilder().setCustomId('music_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(volPercent >= 100),
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


async function seekTo(guildId, targetSec) {
  const queue = getQueue(guildId);
  if (!queue.tracks.length || !queue.player) return;
  const track = queue.tracks[0];
  const maxSec = track.durationSec || 0;
  const sec = Math.max(0, Math.min(targetSec, maxSec - 1));

  try {
    const directUrl = await ytdlpGetUrl(track.url);
    const proc = spawn(FFMPEG_PATH, [
      '-ss', `${Math.floor(sec)}`, '-i', directUrl,
      '-f', 'opus', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-loglevel', 'quiet', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    const resource = createAudioResource(proc.stdout, { inputType: StreamType.Arbitrary, inlineVolume: true });
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
    const resource = createAudioResource(audioStream, { inputType: StreamType.WebmOpus, inlineVolume: true });
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
    const results = await playdl.search(query, { source: { youtube: 'playlist' }, limit: 1 });
    if (!results.length) throw new Error('Aucune playlist trouvee.');
    playlistUrl = results[0].url;
  }

  const pl = await playdl.playlist_info(playlistUrl, { incomplete: true });
  const videos = await pl.all_videos();
  const tracks = videos.map(v => ({
    url: v.url,
    title: v.title || 'Titre inconnu',
    duration: formatDuration(v.durationInSec),
    durationSec: v.durationInSec || 0,
    thumbnail: v.thumbnails?.[0]?.url || null,
    requestedBy: null,
  }));

  return { tracks, title: pl.title || playlistUrl };
}

async function resolveTrack(query) {
  const isUrl = query.startsWith('http://') || query.startsWith('https://');

  if (isUrl && (query.includes('list=') || query.includes('/playlist'))) {
    const pl = await playdl.playlist_info(query, { incomplete: true });
    const videos = await pl.all_videos();
    return videos.map(v => ({
      url: v.url,
      title: v.title || 'Titre inconnu',
      duration: formatDuration(v.durationInSec),
      durationSec: v.durationInSec || 0,
      thumbnail: v.thumbnails?.[0]?.url || null,
      requestedBy: null,
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
    url: video.url,
    title: video.title || 'Titre inconnu',
    duration: formatDuration(video.durationInSec),
    durationSec: video.durationInSec || 0,
    thumbnail: video.thumbnails?.[0]?.url || null,
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

    if (!queue.connection) {
      return interaction.reply({ content: 'Aucune lecture en cours.', ephemeral: true });
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
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLORS.MUSIC)
        .setTitle('🎵  Whipping Bot — Commandes')
        .addFields(
          {
            name: '▸ Lecture',
            value: [
              '`/play <recherche ou URL>` — Jouer une musique ou URL YouTube',
              '`/search <recherche>` — Choisir parmi 5 résultats',
              '`/playlist <recherche ou URL>` — Charger une playlist entière',
              '`/nowplaying` — Afficher la piste en cours',
              '`/pause` · `/resume` — Pause / reprendre',
              '`/stop` — Arrêter et vider la file',
              '`/replay` — Relancer depuis le début',
              '`/previous` — Revenir à la piste précédente',
            ].join('\n'),
          },
          {
            name: '▸ File d\'attente',
            value: [
              '`/queue [page]` — Afficher la file (10 pistes par page)',
              '`/skip` — Passer à la piste suivante',
              '`/clear` — Vider la file (garde la piste en cours)',
            ].join('\n'),
          },
          {
            name: '▸ Contrôles',
            value: [
              '`/volume <0-100>` — Régler le volume',
              '`/loop` — Cycle : Off → Piste 🔁 → File 🔂',
              '`/247` — Rester connecté en permanence dans le salon',
            ].join('\n'),
          },
          {
            name: '▸ Boutons du panel',
            value: '`⏮️` Préc  `⏪` -10s  `⏸️` Pause  `⏩` +10s  `⏭️` Suiv\n`⏹️` Stop  `🔁` Boucle  `🔄` Replay  `🟢` 24/7\n`🔉` Vol-  `🔊` Vol+',
          },
        )
        .setFooter(BOT_FOOTER)
        .setTimestamp()],
    });
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
      const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 5 });
      if (!results.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.STOP).setDescription('Aucun resultat.')] });

      const menu = new StringSelectMenuBuilder().setCustomId('search_select').setPlaceholder('Choisis une piste...');
      const desc = results.map((r, i) => {
        menu.addOptions({ label: (r.title || 'Sans titre').slice(0, 100), description: formatDuration(r.durationInSec), value: `${i}` });
        return `**${i + 1}.** [${r.title}](${r.url}) — \`${formatDuration(r.durationInSec)}\``;
      }).join('\n');

      const embed = new EmbedBuilder().setColor(COLORS.QUEUE).setTitle(`Resultats pour "${query}"`).setDescription(desc);
      const row = new ActionRowBuilder().addComponents(menu);
      const reply = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = reply.createMessageComponentCollector({ time: 30_000 });
      collector.on('collect', async (i) => {
        if (!i.isStringSelectMenu()) return;
        const idx = parseInt(i.values[0]);
        const chosen = results[idx];
        const track = { url: chosen.url, title: chosen.title, duration: formatDuration(chosen.durationInSec), durationSec: chosen.durationInSec || 0, thumbnail: chosen.thumbnails?.[0]?.url, requestedBy: member.user.tag };
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
