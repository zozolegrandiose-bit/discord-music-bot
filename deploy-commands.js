require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('play').setDescription('Jouer une musique (URL YouTube ou recherche)')
    .addStringOption(o => o.setName('query').setDescription('Lien ou nom de la chanson').setRequired(true)),
  new SlashCommandBuilder().setName('search').setDescription('Rechercher et choisir parmi 5 résultats')
    .addStringOption(o => o.setName('query').setDescription('Recherche YouTube').setRequired(true)),
  new SlashCommandBuilder().setName('playlist').setDescription('Charger une playlist YouTube')
    .addStringOption(o => o.setName('query').setDescription('Lien ou nom de la playlist').setRequired(true)),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Afficher le panneau de contrôle'),
  new SlashCommandBuilder().setName('skip').setDescription('Passer à la piste suivante'),
  new SlashCommandBuilder().setName('stop').setDescription('Arrêter la lecture et vider la file'),
  new SlashCommandBuilder().setName('pause').setDescription('Mettre en pause'),
  new SlashCommandBuilder().setName('resume').setDescription('Reprendre la lecture'),
  new SlashCommandBuilder().setName('replay').setDescription('Rejouer la piste depuis le début'),
  new SlashCommandBuilder().setName('previous').setDescription('Revenir à la piste précédente'),
  new SlashCommandBuilder().setName('queue').setDescription('Afficher la file d\'attente')
    .addIntegerOption(o => o.setName('page').setDescription('Numéro de page').setMinValue(1)),
  new SlashCommandBuilder().setName('clear').setDescription('Vider la file (garde la piste en cours)'),
  new SlashCommandBuilder().setName('volume').setDescription('Régler le volume (0-150)')
    .addIntegerOption(o => o.setName('level').setDescription('Volume').setRequired(true).setMinValue(0).setMaxValue(150)),
  new SlashCommandBuilder().setName('loop').setDescription('Changer le mode de boucle (Off → Piste → File)'),
  new SlashCommandBuilder().setName('247').setDescription('Activer/désactiver le mode 24/7'),
  new SlashCommandBuilder().setName('help').setDescription('Afficher l\'aide'),
  new SlashCommandBuilder().setName('debug').setDescription('Infos de debug (admin)'),
  new SlashCommandBuilder().setName('forcestop').setDescription('Forcer l\'arrêt du lecteur (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log(`✅ ${commands.length} commandes déployées.`);
  } catch (err) {
    console.error('Erreur déploiement :', err);
  }
})();
