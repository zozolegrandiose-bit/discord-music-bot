require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  // ─── Musique ────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('play').setDescription('Jouer une musique (URL YouTube, playlist ou recherche)')
    .addStringOption(o => o.setName('query').setDescription('Lien YouTube ou nom de la chanson').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Passer a la musique suivante'),
  new SlashCommandBuilder().setName('stop').setDescription('Arreter la musique et vider la file'),
  new SlashCommandBuilder().setName('pause').setDescription('Mettre en pause'),
  new SlashCommandBuilder().setName('resume').setDescription('Reprendre la lecture'),
  new SlashCommandBuilder().setName('queue').setDescription('Afficher la file d\'attente')
    .addIntegerOption(o => o.setName('page').setDescription('Numero de page').setMinValue(1)),
  new SlashCommandBuilder().setName('volume').setDescription('Regler le volume (0-100)')
    .addIntegerOption(o => o.setName('level').setDescription('Niveau de volume').setRequired(true).setMinValue(0).setMaxValue(100)),
  new SlashCommandBuilder().setName('loop').setDescription('Cycle: off > piste > file'),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Voir la musique en cours'),
  new SlashCommandBuilder().setName('shuffle').setDescription('Melanger la file d\'attente'),
  new SlashCommandBuilder().setName('remove').setDescription('Retirer une piste de la file')
    .addIntegerOption(o => o.setName('position').setDescription('Position dans la file').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('clear').setDescription('Vider la file (garde la piste en cours)'),
  new SlashCommandBuilder().setName('playlist').setDescription('Chercher et jouer une playlist YouTube')
    .addStringOption(o => o.setName('query').setDescription('Nom de la playlist ou lien').setRequired(true)),
  new SlashCommandBuilder().setName('skipto').setDescription('Sauter a une position dans la file')
    .addIntegerOption(o => o.setName('position').setDescription('Position de la piste').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('move').setDescription('Deplacer une piste dans la file')
    .addIntegerOption(o => o.setName('de').setDescription('Position actuelle').setRequired(true).setMinValue(2))
    .addIntegerOption(o => o.setName('vers').setDescription('Nouvelle position').setRequired(true).setMinValue(2)),
  new SlashCommandBuilder().setName('replay').setDescription('Rejouer la piste en cours depuis le debut'),
  new SlashCommandBuilder().setName('247').setDescription('Activer/desactiver le mode 24/7'),
  new SlashCommandBuilder().setName('previous').setDescription('Revenir a la piste precedente'),
  new SlashCommandBuilder().setName('search').setDescription('Rechercher et choisir parmi 5 resultats')
    .addStringOption(o => o.setName('query').setDescription('Recherche YouTube').setRequired(true)),

  // ─── Aide & Debug ──────────────────────────────────────────────────
  new SlashCommandBuilder().setName('help').setDescription('Afficher l\'aide avec toutes les commandes'),
  new SlashCommandBuilder().setName('debug').setDescription('Infos de debug du bot et du lecteur'),
  new SlashCommandBuilder().setName('forcestop').setDescription('Forcer l\'arret complet du lecteur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Deploiement des commandes slash...');
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log(`${commands.length} commandes deployees avec succes !`);
  } catch (err) {
    console.error('Erreur de deploiement :', err);
  }
})();
