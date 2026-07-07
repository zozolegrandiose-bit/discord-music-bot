require('dotenv').config();

const {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ActivityType, MessageFlags,
} = require('discord.js');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const { execFile, spawn } = require('child_process');
const path = require('path');
const http = require('http');

// ─── Binaires ─────────────────────────────────────────────────────────────────
const FFMPEG = require('ffmpeg-static');
const YTDLP  = path.join(__dirname, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

// ─── Constantes ───────────────────────────────────────────────────────────────
const COLOR  = { PLAY: 0x2ecc71, QUEUE: 0x3498db, STOP: 0xe74c3c, WARN: 0xf39c12, INFO: 0x5865f2, BOT: 0x1db954 };
const FOOTER = { text: '𝗪𝗵𝗶𝗽𝗽𝗶𝗻𝗴 𝗕𝗼𝘁' };
const ADMINS = new Set(['576468004863475746', '452381598663573506']);
const LOOP_CYCLE  = ['off', 'track', 'queue'];
const LOOP_LABEL  = { off: 'Off', track: 'Piste 🔁', queue: 'File 🔂' };
const IDLE_DELAY  = 5 * 60 * 1000;
const BOOT_TIME   = Date.now();

// ─── Client ───────────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const queues = new Map();

// ─── File d'attente ───────────────────────────────────────────────────────────
function q(guildId) {
  if (!queues.has(guildId)) queues.set(guildId, {
    tracks: [], history: [],
    player: null, connection: null,
    textChannel: null, panel: null,
    volume: 0.5, loop: 'off',
    paused: false, stay247: false,
    startedAt: 0, pausedAt: 0, pausedTotal: 0,
    replay: false, idle: null,
  });
  return queues.get(guildId);
}

function destroyQueue(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;
  clearTimeout(queue.idle);
  queue.player?.stop(true);
  queue.connection?.destroy();
  queues.delete(guildId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const dur = (s) => {
  if (!s || isNaN(s)) return '?:??';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const uptime = (ms) => {
  const s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24, d = Math.floor(ms / 86400000);
  return [d && `${d}j`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
};

function elapsed(queue) {
  if (!queue.startedAt) return 0;
  const now = queue.paused && queue.pausedAt ? queue.pausedAt : Date.now();
  return (now - queue.startedAt - queue.pausedTotal) / 1000;
}

function bar(sec, total) {
  if (!total) return null;
  const pct = Math.min(Math.max(sec / total, 0), 1);
  const pos = Math.round(pct * 20);
  return `\`${'━'.repeat(pos)}${'─'.repeat(20 - pos)}\`  ${dur(Math.floor(sec))} / ${dur(total)}`;
}

// ─── yt-dlp ───────────────────────────────────────────────────────────────────
const YTDLP_OPTS = ['--no-warnings', '--extractor-args', 'youtube:player_client=ios', '--no-playlist'];

function getUrl(videoUrl) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, [...YTDLP_OPTS, '--get-url', '-f', 'bestaudio', videoUrl], { timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || err.message).split('\n')[0]));
        const url = stdout.trim().split('\n')[0];
        if (!url) return reject(new Error('yt-dlp: URL vide'));
        resolve(url);
      }
    );
  });
}

function ffmpeg(audioUrl, startSec = 0) {
  const args = [
    '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
    ...(startSec > 0 ? ['-ss', String(Math.floor(startSec))] : []),
    '-i', audioUrl,
    '-vn', '-f', 'opus', '-ar', '48000', '-ac', '2', '-b:a', '128k',
    '-loglevel', 'error', 'pipe:1',
  ];
  const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stderr.on('data', d => { const m = d.toString().trim(); if (m) console.error('[ffmpeg]', m); });
  return proc.stdout;
}

// ─── play-dl : recherche / info ───────────────────────────────────────────────
async function resolve(query) {
  const isUrl = /^https?:\/\//.test(query);

  if (isUrl && (query.includes('list=') || query.includes('/playlist'))) {
    const pl = await playdl.playlist_info(query, { incomplete: true });
    return (await pl.all_videos()).map(v => track(v));
  }

  const video = isUrl
    ? (await playdl.video_info(query)).video_details
    : (await playdl.search(query, { source: { youtube: 'video' }, limit: 1 }))[0];

  if (!video) return null;
  return track(video);
}

function track(v) {
  return {
    url: v.url, title: v.title || 'Titre inconnu',
    duration: dur(v.durationInSec), durationSec: v.durationInSec || 0,
    thumbnail: v.thumbnails?.[0]?.url || null, requestedBy: null,
  };
}

// ─── Embeds ───────────────────────────────────────────────────────────────────
function panelEmbed(queue) {
  const t = queue.tracks[0];
  const b = bar(elapsed(queue), t.durationSec);
  return new EmbedBuilder()
    .setColor(queue.paused ? COLOR.WARN : COLOR.BOT)
    .setAuthor({ name: queue.paused ? '⏸️  En pause' : '▶️  En cours' })
    .setTitle(t.title.length > 256 ? t.title.slice(0, 253) + '...' : t.title)
    .setURL(t.url)
    .setThumbnail(t.thumbnail)
    .setDescription([
      b,
      `> 🔉 **${Math.round(queue.volume * 100)}%**  ┃  🔁 **${LOOP_LABEL[queue.loop]}**  ┃  📋 **${queue.tracks.length}** piste(s)`,
      t.requestedBy ? `> 👤 Demandé par **${t.requestedBy}**` : null,
      queue.stay247 ? '> 🟢 Mode 24/7 actif' : null,
    ].filter(Boolean).join('\n'))
    .setFooter(FOOTER).setTimestamp();
}

function panelRows(queue) {
  const vol = Math.round(queue.volume * 100);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('p_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(!queue.history.length),
      new ButtonBuilder().setCustomId('p_back').setEmoji('⏪').setLabel('-10s').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('p_playpause').setEmoji(queue.paused ? '▶️' : '⏸️').setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('p_fwd').setEmoji('⏩').setLabel('+10s').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('p_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('p_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('p_loop').setLabel(LOOP_LABEL[queue.loop]).setStyle(queue.loop !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('p_replay').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('p_247').setEmoji(queue.stay247 ? '🟢' : '🔘').setLabel('24/7').setStyle(queue.stay247 ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('p_vold').setEmoji('🔉').setLabel(`${vol}%`).setStyle(ButtonStyle.Secondary).setDisabled(vol <= 0),
      new ButtonBuilder().setCustomId('p_volu').setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(vol >= 150),
    ),
  ];
}

async function updatePanel(queue) {
  if (!queue.panel || !queue.tracks[0]) return;
  await queue.panel.edit({ embeds: [panelEmbed(queue)], components: panelRows(queue) }).catch(() => {});
}

// ─── Lecture ──────────────────────────────────────────────────────────────────
async function play(guildId) {
  const queue = q(guildId);

  if (!queue.tracks.length) {
    queue.panel?.edit({ embeds: [new EmbedBuilder().setColor(COLOR.WARN).setDescription('✅ File d\'attente terminée.')], components: [] }).catch(() => {});
    queue.panel = null;
    if (!queue.stay247) {
      clearTimeout(queue.idle);
      queue.idle = setTimeout(() => {
        queue.textChannel?.send({ embeds: [new EmbedBuilder().setColor(COLOR.WARN).setDescription('💤 Inactif depuis 5 min — déconnecté.')] }).catch(() => {});
        destroyQueue(guildId);
      }, IDLE_DELAY);
    }
    return;
  }

  clearTimeout(queue.idle);
  queue.paused = false;
  const t = queue.tracks[0];

  try {
    console.log(`▶ ${t.title}`);
    const audioUrl = await getUrl(t.url);
    const stream   = ffmpeg(audioUrl);
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true });
    resource.volume?.setVolume(queue.volume);
    queue.player.play(resource);
    queue.startedAt   = Date.now();
    queue.pausedAt    = 0;
    queue.pausedTotal = 0;

    const embed = panelEmbed(queue);
    const rows  = panelRows(queue);
    if (queue.panel) {
      queue.panel.edit({ embeds: [embed], components: rows }).catch(async () => {
        queue.panel = await queue.textChannel?.send({ embeds: [embed], components: rows }).catch(() => null);
      });
    } else {
      queue.panel = await queue.textChannel?.send({ embeds: [embed], components: rows }).catch(() => null);
    }
  } catch (err) {
    console.error(`[play] ${err.message}`);
    queue.textChannel?.send({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription(`❌ Impossible de lire **${t.title}**`)] }).catch(() => {});
    queue.tracks.shift();
    play(guildId);
  }
}

async function seek(guildId, sec) {
  const queue = q(guildId);
  if (!queue.tracks.length) return;
  const t   = queue.tracks[0];
  const s   = Math.max(0, Math.min(sec, (t.durationSec || 0) - 1));
  try {
    const audioUrl = await getUrl(t.url);
    const stream   = ffmpeg(audioUrl, s);
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true });
    resource.volume?.setVolume(queue.volume);
    queue.replay    = true;
    queue.player.play(resource);
    queue.startedAt   = Date.now() - s * 1000;
    queue.pausedTotal = 0;
    queue.pausedAt    = 0;
    queue.paused      = false;
    await updatePanel(queue);
  } catch (err) { console.error(`[seek] ${err.message}`); }
}

function setupVoice(queue, voiceChannel, guild) {
  queue.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
  queue.player     = createAudioPlayer();
  queue.connection.subscribe(queue.player);

  queue.player.on(AudioPlayerStatus.Idle, () => {
    if (queue.replay) { queue.replay = false; play(guild.id); return; }
    const done = queue.tracks.shift();
    if (done) { queue.history.push(done); if (queue.history.length > 50) queue.history.shift(); }
    if (queue.loop === 'track' && done) queue.tracks.unshift(done);
    if (queue.loop === 'queue' && done) queue.tracks.push(done);
    play(guild.id);
  });

  queue.player.on('error', err => { console.error(`[player] ${err.message}`); queue.tracks.shift(); play(guild.id); });

  queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(queue.connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(queue.connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch { destroyQueue(guild.id); }
  });
}

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── Boutons panel ──────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('p_')) {
    const queue = q(interaction.guild.id);
    if (!queue.connection) return interaction.reply({ content: 'Aucune lecture en cours.', flags: MessageFlags.Ephemeral }).catch(() => {});
    await interaction.deferUpdate().catch(() => {});
    const id = interaction.customId;

    if (id === 'p_playpause') {
      if (queue.paused) {
        queue.player.unpause();
        if (queue.pausedAt) queue.pausedTotal += Date.now() - queue.pausedAt;
        queue.pausedAt = 0; queue.paused = false;
      } else {
        queue.player.pause(); queue.pausedAt = Date.now(); queue.paused = true;
      }
      await updatePanel(queue);
    }
    else if (id === 'p_skip')   { queue.tracks.shift(); play(interaction.guild.id); }
    else if (id === 'p_stop')   { queue.panel?.edit({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('⏹️ Arrêté.')], components: [] }).catch(() => {}); destroyQueue(interaction.guild.id); }
    else if (id === 'p_prev')   { if (queue.history.length) { const p = queue.history.pop(); queue.tracks.unshift(p); queue.replay = true; queue.player.stop(true); } }
    else if (id === 'p_loop')   { queue.loop = LOOP_CYCLE[(LOOP_CYCLE.indexOf(queue.loop) + 1) % 3]; await updatePanel(queue); }
    else if (id === 'p_replay') { if (queue.tracks.length) { queue.replay = true; queue.player.stop(true); } }
    else if (id === 'p_247')    { queue.stay247 = !queue.stay247; if (queue.stay247) clearTimeout(queue.idle); await updatePanel(queue); }
    else if (id === 'p_vold')   { queue.volume = Math.max(0, parseFloat((queue.volume - 0.1).toFixed(1))); queue.player?._state?.resource?.volume?.setVolume(queue.volume); await updatePanel(queue); }
    else if (id === 'p_volu')   { queue.volume = Math.min(1.5, parseFloat((queue.volume + 0.1).toFixed(1))); queue.player?._state?.resource?.volume?.setVolume(queue.volume); await updatePanel(queue); }
    else if (id === 'p_back')   { await seek(interaction.guild.id, elapsed(queue) - 10); }
    else if (id === 'p_fwd')    { await seek(interaction.guild.id, elapsed(queue) + 10); }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, member, channel } = interaction;
  const vc    = member?.voice?.channel;
  const queue = q(guild.id);

  const rep = (opts) => interaction.reply(opts).catch(e => { if (e.code !== 10062) console.error(e.message); });
  const defer = async () => { try { await interaction.deferReply(); return true; } catch (e) { if (e.code !== 10062) console.error(e.message); return false; } };

  // ── /play ──────────────────────────────────────────────────────────────────
  if (commandName === 'play') {
    if (!vc) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('❌ Tu dois être dans un salon vocal.')], flags: MessageFlags.Ephemeral });
    if (!await defer()) return;
    try {
      const result = await resolve(interaction.options.getString('query'));
      if (!result) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Aucun résultat.')] });
      const tracks = Array.isArray(result) ? result : [result];
      tracks.forEach(t => t.requestedBy = member.user.tag);
      queue.tracks.push(...tracks);
      queue.textChannel = channel;
      if (!queue.connection) { setupVoice(queue, vc, guild); play(guild.id); }
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Array.isArray(result) ? COLOR.QUEUE : COLOR.PLAY).setDescription(
        Array.isArray(result) ? `📋 **${tracks.length} pistes** ajoutées.`
        : queue.tracks.length === 1 ? `▶️ Lecture : **${tracks[0].title}**`
        : `➕ **${tracks[0].title}** — position ${queue.tracks.length}`
      )] });
    } catch (err) {
      console.error('[/play]', err.message);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Erreur lors de la recherche.')] });
    }
  }

  // ── /search ────────────────────────────────────────────────────────────────
  else if (commandName === 'search') {
    if (!vc) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('❌ Tu dois être dans un salon vocal.')], flags: MessageFlags.Ephemeral });
    if (!await defer()) return;
    try {
      const results = await playdl.search(interaction.options.getString('query'), { source: { youtube: 'video' }, limit: 5 });
      if (!results.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Aucun résultat.')] });
      const menu = new StringSelectMenuBuilder().setCustomId('search_pick').setPlaceholder('Choisis une piste…');
      const desc = results.map((r, i) => { menu.addOptions({ label: (r.title || '?').slice(0, 100), description: dur(r.durationInSec), value: String(i) }); return `**${i + 1}.** [${r.title}](${r.url}) — \`${dur(r.durationInSec)}\``; }).join('\n');
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.QUEUE).setTitle('🔎 Résultats').setDescription(desc)], components: [new ActionRowBuilder().addComponents(menu)] });
      const col = msg.createMessageComponentCollector({ time: 30000 });
      col.on('collect', async i => {
        if (!i.isStringSelectMenu()) return;
        const r = results[parseInt(i.values[0])];
        const t = track(r); t.requestedBy = member.user.tag;
        queue.tracks.push(t); queue.textChannel = channel;
        if (!queue.connection) { setupVoice(queue, vc, guild); play(guild.id); }
        await i.update({ embeds: [new EmbedBuilder().setColor(COLOR.PLAY).setDescription(`➕ Ajouté : **${t.title}**`)], components: [] });
        col.stop();
      });
      col.on('end', (_, r) => { if (r === 'time') interaction.editReply({ components: [] }).catch(() => {}); });
    } catch (err) { console.error('[/search]', err.message); await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Erreur.')] }); }
  }

  // ── /playlist ──────────────────────────────────────────────────────────────
  else if (commandName === 'playlist') {
    if (!vc) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('❌ Tu dois être dans un salon vocal.')], flags: MessageFlags.Ephemeral });
    if (!await defer()) return;
    try {
      const query = interaction.options.getString('query');
      const isUrl = /^https?:\/\//.test(query);
      let plUrl   = query;
      if (!isUrl) { const r = await playdl.search(query, { source: { youtube: 'playlist' }, limit: 1 }); if (!r.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Playlist introuvable.')] }); plUrl = r[0].url; }
      const pl     = await playdl.playlist_info(plUrl, { incomplete: true });
      const videos = (await pl.all_videos()).map(v => { const t = track(v); t.requestedBy = member.user.tag; return t; });
      if (!videos.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Playlist vide.')] });
      queue.tracks.push(...videos); queue.textChannel = channel;
      if (!queue.connection) { setupVoice(queue, vc, guild); play(guild.id); }
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.QUEUE).setTitle('📋 Playlist chargée').setDescription(`**${videos.length} pistes** — durée : **${dur(videos.reduce((a, t) => a + t.durationSec, 0))}**`)] });
    } catch (err) { console.error('[/playlist]', err.message); await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Erreur.')] }); }
  }

  // ── /skip ──────────────────────────────────────────────────────────────────
  else if (commandName === 'skip') {
    if (!queue.tracks.length) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Rien en cours.')], flags: MessageFlags.Ephemeral });
    const t = queue.tracks[0]; queue.tracks.shift(); play(guild.id);
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.INFO).setDescription(`⏭️ Passée : **${t.title}**`)] });
  }

  // ── /stop ──────────────────────────────────────────────────────────────────
  else if (commandName === 'stop') {
    if (!queue.connection) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Pas de connexion active.')], flags: MessageFlags.Ephemeral });
    destroyQueue(guild.id);
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('⏹️ Arrêté.')] });
  }

  // ── /pause ─────────────────────────────────────────────────────────────────
  else if (commandName === 'pause') {
    if (!queue.player || queue.paused) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Rien à mettre en pause.')], flags: MessageFlags.Ephemeral });
    queue.player.pause(); queue.pausedAt = Date.now(); queue.paused = true;
    await updatePanel(queue);
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.WARN).setDescription('⏸️ En pause.')] });
  }

  // ── /resume ────────────────────────────────────────────────────────────────
  else if (commandName === 'resume') {
    if (!queue.player || !queue.paused) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Rien à reprendre.')], flags: MessageFlags.Ephemeral });
    queue.player.unpause(); if (queue.pausedAt) queue.pausedTotal += Date.now() - queue.pausedAt; queue.pausedAt = 0; queue.paused = false;
    await updatePanel(queue);
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.PLAY).setDescription('▶️ Repris !')] });
  }

  // ── /queue ─────────────────────────────────────────────────────────────────
  else if (commandName === 'queue') {
    if (!queue.tracks.length) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.WARN).setDescription('La file est vide.')], flags: MessageFlags.Ephemeral });
    const pp = 10, pg = Math.min(Math.max(interaction.options.getInteger('page') || 1, 1), Math.ceil(queue.tracks.length / pp));
    const list = queue.tracks.slice((pg - 1) * pp, pg * pp).map((t, i) => `\`${(pg-1)*pp+i+1}.\` **${t.title}** — \`${t.duration}\``).join('\n');
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.QUEUE).setTitle('📋 File d\'attente').setDescription(list).setFooter({ text: `Page ${pg}/${Math.ceil(queue.tracks.length/pp)} ┃ ${queue.tracks.length} pistes ┃ ${dur(queue.tracks.reduce((a,t)=>a+t.durationSec,0))}` }).setTimestamp()] });
  }

  // ── /nowplaying ────────────────────────────────────────────────────────────
  else if (commandName === 'nowplaying') {
    if (!queue.tracks[0]) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Rien en cours.')], flags: MessageFlags.Ephemeral });
    const { resource: r } = await interaction.reply({ embeds: [panelEmbed(queue)], components: panelRows(queue), withResponse: true });
    queue.panel = r.message;
  }

  // ── /volume ────────────────────────────────────────────────────────────────
  else if (commandName === 'volume') {
    const lvl = interaction.options.getInteger('level');
    queue.volume = lvl / 100;
    queue.player?._state?.resource?.volume?.setVolume(queue.volume);
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.INFO).setDescription(`${'█'.repeat(Math.round(lvl/10))}${'░'.repeat(10-Math.round(lvl/10))} **${lvl}%**`)] });
  }

  // ── /loop ──────────────────────────────────────────────────────────────────
  else if (commandName === 'loop') {
    queue.loop = LOOP_CYCLE[(LOOP_CYCLE.indexOf(queue.loop) + 1) % 3];
    await updatePanel(queue);
    await rep({ embeds: [new EmbedBuilder().setColor(queue.loop !== 'off' ? COLOR.PLAY : COLOR.WARN).setDescription(`Boucle : **${LOOP_LABEL[queue.loop]}**`)] });
  }

  // ── /clear ─────────────────────────────────────────────────────────────────
  else if (commandName === 'clear') {
    if (queue.tracks.length <= 1) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.WARN).setDescription('File déjà vide.')], flags: MessageFlags.Ephemeral });
    queue.tracks = [queue.tracks[0]];
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.INFO).setDescription('🗑️ File vidée.')] });
  }

  // ── /replay ────────────────────────────────────────────────────────────────
  else if (commandName === 'replay') {
    if (!queue.player || !queue.tracks[0]) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Rien en cours.')], flags: MessageFlags.Ephemeral });
    queue.replay = true; queue.player.stop(true);
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.PLAY).setDescription(`🔄 **${queue.tracks[0].title}**`)] });
  }

  // ── /previous ──────────────────────────────────────────────────────────────
  else if (commandName === 'previous') {
    if (!queue.history.length) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Aucune piste précédente.')], flags: MessageFlags.Ephemeral });
    const p = queue.history.pop(); queue.tracks.unshift(p); queue.replay = true; queue.player?.stop(true);
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.PLAY).setDescription(`⏮️ **${p.title}**`)] });
  }

  // ── /247 ───────────────────────────────────────────────────────────────────
  else if (commandName === '247') {
    queue.stay247 = !queue.stay247;
    if (queue.stay247) clearTimeout(queue.idle);
    await updatePanel(queue);
    await rep({ embeds: [new EmbedBuilder().setColor(queue.stay247 ? COLOR.PLAY : COLOR.WARN).setDescription(queue.stay247 ? '🟢 Mode 24/7 activé.' : '🔘 Mode 24/7 désactivé.')] });
  }

  // ── /help ──────────────────────────────────────────────────────────────────
  else if (commandName === 'help') {
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.BOT).setTitle('🎵 Whipping Bot — Aide').addFields(
      { name: '▸ Lecture', value: '`/play` `/search` `/playlist` `/nowplaying` `/pause` `/resume` `/replay` `/previous`' },
      { name: '▸ File', value: '`/queue` `/skip` `/clear` `/stop`' },
      { name: '▸ Réglages', value: '`/volume` `/loop` `/247`' },
      { name: '▸ Panel boutons', value: '`⏮️` `-10s` `⏸️` `+10s` `⏭️` `⏹️` `🔁` `🔄` `🟢` `🔉` `🔊`' },
    ).setFooter(FOOTER).setTimestamp()] });
  }

  // ── /debug ─────────────────────────────────────────────────────────────────
  else if (commandName === 'debug') {
    if (!ADMINS.has(interaction.user.id)) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Accès refusé.')], flags: MessageFlags.Ephemeral });
    const m = process.memoryUsage();
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.INFO).setTitle('🔧 Debug').setDescription(
      `\`\`\`\nBot     : ${client.user.tag}\nUptime  : ${uptime(Date.now() - BOOT_TIME)}\nMémoire : ${Math.round(m.heapUsed/1024/1024)} MB\nPing    : ${Math.round(client.ws.ping)}ms\nConn.   : ${queue.connection?.state?.status || 'off'}\nPlayer  : ${queue.player?._state?.status || 'off'}\nPiste   : ${queue.tracks[0]?.title || '-'}\nVolume  : ${Math.round(queue.volume*100)}%\nLoop    : ${queue.loop}\nFile    : ${queue.tracks.length} piste(s)\n\`\`\``
    ).setFooter(FOOTER)], flags: MessageFlags.Ephemeral });
  }

  // ── /forcestop ─────────────────────────────────────────────────────────────
  else if (commandName === 'forcestop') {
    if (!ADMINS.has(interaction.user.id)) return rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('Accès refusé.')], flags: MessageFlags.Ephemeral });
    destroyQueue(guild.id);
    await rep({ embeds: [new EmbedBuilder().setColor(COLOR.STOP).setDescription('⚠️ Lecteur forcé à l\'arrêt.').setFooter(FOOTER)] });
  }
});

// ─── Statut ───────────────────────────────────────────────────────────────────
client.once('clientReady', () => {
  console.log(`✅ ${client.user.tag} en ligne`);
  const msgs = ['🎵 /play', '🔎 /search', 'Whipping Music'];
  let i = 0;
  setInterval(() => {
    const np = [...queues.values()].find(q => q.tracks.length && !q.paused);
    client.user.setActivity(np?.tracks[0]?.title || msgs[i++ % msgs.length], { type: ActivityType.Listening });
  }, 15000);
});

// ─── Health check ─────────────────────────────────────────────────────────────
http.createServer((_, res) => res.end(JSON.stringify({ ok: true, uptime: uptime(Date.now() - BOOT_TIME) })))
    .listen(process.env.PORT || 3000);

client.on('error', console.error);
process.on('unhandledRejection', e => console.error('[reject]', e?.message || e));
client.login(process.env.DISCORD_TOKEN);
