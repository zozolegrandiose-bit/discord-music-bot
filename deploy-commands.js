require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const commands = [
  // ─── Musique ────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Jouer une musique (URL YouTube, playlist ou recherche)')
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

  // ─── Utilitaires ────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('help').setDescription('Afficher l\'aide avec toutes les commandes'),
  new SlashCommandBuilder().setName('ping').setDescription('Voir la latence du bot'),
  new SlashCommandBuilder().setName('uptime').setDescription('Voir depuis combien de temps le bot tourne'),
  new SlashCommandBuilder().setName('avatar').setDescription('Voir l\'avatar d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre (defaut: toi-meme)')),
  new SlashCommandBuilder().setName('banner').setDescription('Voir la banniere d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre (defaut: toi-meme)')),
  new SlashCommandBuilder().setName('roleinfo').setDescription('Infos sur un role')
    .addRoleOption(o => o.setName('role').setDescription('Role a inspecter').setRequired(true)),
  new SlashCommandBuilder().setName('membercount').setDescription('Nombre de membres du serveur'),
  new SlashCommandBuilder().setName('poll').setDescription('Creer un sondage')
    .addStringOption(o => o.setName('question').setDescription('La question du sondage').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separees par | (ex: Oui|Non|Peut-etre)').setRequired(true)),
  new SlashCommandBuilder().setName('timer').setDescription('Programmer un rappel')
    .addStringOption(o => o.setName('duree').setDescription('Duree (ex: 10m, 1h, 2h30m)').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message du rappel').setRequired(true)),
  new SlashCommandBuilder().setName('embed').setDescription('Creer un embed personnalise')
    .addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true))
    .addStringOption(o => o.setName('couleur').setDescription('Couleur hex (ex: #ff0000)'))
    .addStringOption(o => o.setName('image').setDescription('URL d\'une image'))
    .addStringOption(o => o.setName('footer').setDescription('Texte du footer'))
    .addChannelOption(o => o.setName('salon').setDescription('Salon cible').addChannelTypes(ChannelType.GuildText)),

  // ─── Moderation ─────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('ban').setDescription('Bannir un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre a bannir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du ban'))
    .addIntegerOption(o => o.setName('supprimer').setDescription('Supprimer messages des X derniers jours').setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('unban').setDescription('Debannir un utilisateur')
    .addStringOption(o => o.setName('id').setDescription('ID de l\'utilisateur').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('kick').setDescription('Expulser un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre a expulser').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('mute').setDescription('Rendre muet un membre (timeout)')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('duree').setDescription('Duree (ex: 10m, 1h, 1d)').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('unmute').setDescription('Retirer le mute d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('warn').setDescription('Avertir un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('warnings').setDescription('Voir les avertissements d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('clearwarnings').setDescription('Effacer les avertissements d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('purge').setDescription('Supprimer des messages en masse')
    .addIntegerOption(o => o.setName('nombre').setDescription('Nombre (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('membre').setDescription('Filtrer par membre'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('snipe').setDescription('Voir le dernier message supprime'),
  new SlashCommandBuilder().setName('editsnipe').setDescription('Voir le dernier message modifie'),
  new SlashCommandBuilder().setName('nuke').setDescription('Recree le salon (supprime tous les messages)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  // ─── Gestion serveur ────────────────────────────────────────────────
  new SlashCommandBuilder().setName('slowmode').setDescription('Definir le mode lent')
    .addIntegerOption(o => o.setName('secondes').setDescription('Delai (0 = desactiver)').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(o => o.setName('salon').setDescription('Salon cible').addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('lock').setDescription('Verrouiller un salon')
    .addChannelOption(o => o.setName('salon').setDescription('Salon').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('raison').setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('unlock').setDescription('Deverrouiller un salon')
    .addChannelOption(o => o.setName('salon').setDescription('Salon').addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('nick').setDescription('Changer le pseudo d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('pseudo').setDescription('Nouveau pseudo (vide = reset)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
  new SlashCommandBuilder().setName('addrole').setDescription('Ajouter un role a un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('removerole').setDescription('Retirer un role d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('banlist').setDescription('Liste des membres bannis')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('announce').setDescription('Envoyer une annonce embed')
    .addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Contenu').setRequired(true))
    .addChannelOption(o => o.setName('salon').setDescription('Salon cible').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('couleur').setDescription('Couleur hex'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // ─── Configuration ──────────────────────────────────────────────────
  new SlashCommandBuilder().setName('setlog').setDescription('Definir le salon de logs de moderation')
    .addChannelOption(o => o.setName('salon').setDescription('Salon de logs (vide = desactiver)').addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('setwelcome').setDescription('Configurer le message de bienvenue')
    .addChannelOption(o => o.setName('salon').setDescription('Salon de bienvenue (vide = desactiver)').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('message').setDescription('Message ({user} {server} {count})'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('setleave').setDescription('Configurer le message de depart')
    .addChannelOption(o => o.setName('salon').setDescription('Salon de depart (vide = desactiver)').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('message').setDescription('Message ({user} {server} {count})'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('autorole').setDescription('Role automatique pour les nouveaux membres')
    .addRoleOption(o => o.setName('role').setDescription('Role (vide = desactiver)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('antilink').setDescription('Activer/desactiver la suppression automatique des liens')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // ─── Informations ───────────────────────────────────────────────────
  new SlashCommandBuilder().setName('userinfo').setDescription('Infos d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre')),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Infos du serveur'),

  // ─── Giveaway ───────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('giveaway').setDescription('Lancer un giveaway')
    .addStringOption(o => o.setName('prix').setDescription('Le prix a gagner').setRequired(true))
    .addStringOption(o => o.setName('duree').setDescription('Duree (ex: 10m, 1h, 1d)').setRequired(true))
    .addIntegerOption(o => o.setName('gagnants').setDescription('Nombre de gagnants').setMinValue(1).setMaxValue(20))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('giveaway-reroll').setDescription('Relancer un giveaway termine')
    .addStringOption(o => o.setName('id').setDescription('ID du message giveaway').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // ─── Tickets ────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('ticket-setup').setDescription('Creer le panneau de tickets dans ce salon')
    .addStringOption(o => o.setName('description').setDescription('Description du panneau'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('ticket-close').setDescription('Fermer ce ticket'),

  // ─── Niveaux / XP ──────────────────────────────────────────────────
  new SlashCommandBuilder().setName('rank').setDescription('Voir ton niveau et XP')
    .addUserOption(o => o.setName('membre').setDescription('Membre')),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 des membres les plus actifs'),
  new SlashCommandBuilder().setName('setlevelchannel').setDescription('Salon des annonces de level up')
    .addChannelOption(o => o.setName('salon').setDescription('Salon (vide = desactiver)').addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // ─── Starboard ──────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('setstarboard').setDescription('Configurer le starboard')
    .addChannelOption(o => o.setName('salon').setDescription('Salon starboard (vide = desactiver)').addChannelTypes(ChannelType.GuildText))
    .addIntegerOption(o => o.setName('minimum').setDescription('Nombre minimum d\'etoiles (defaut: 3)').setMinValue(1).setMaxValue(25))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // ─── Suggestions ───────────────────────────────────────────────────
  new SlashCommandBuilder().setName('suggest').setDescription('Soumettre une suggestion')
    .addStringOption(o => o.setName('idee').setDescription('Ton idee').setRequired(true)),
  new SlashCommandBuilder().setName('setsuggestions').setDescription('Salon des suggestions')
    .addChannelOption(o => o.setName('salon').setDescription('Salon (vide = desactiver)').addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // ─── Reaction roles ────────────────────────────────────────────────
  new SlashCommandBuilder().setName('roleboard').setDescription('Creer un panneau de roles avec boutons')
    .addStringOption(o => o.setName('titre').setDescription('Titre du panneau').setRequired(true))
    .addStringOption(o => o.setName('roles').setDescription('Roles: @role1, @role2, @role3 (mentionner les roles)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  // ─── Auto-mod avance ───────────────────────────────────────────────
  new SlashCommandBuilder().setName('antispam').setDescription('Activer/desactiver l\'anti-spam')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('anticaps').setDescription('Activer/desactiver l\'anti-majuscules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('addword').setDescription('Ajouter un mot au filtre')
    .addStringOption(o => o.setName('mot').setDescription('Mot a filtrer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('removeword').setDescription('Retirer un mot du filtre')
    .addStringOption(o => o.setName('mot').setDescription('Mot a retirer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('wordlist').setDescription('Voir la liste des mots filtres')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('setdj').setDescription('Definir le role DJ pour la musique')
    .addRoleOption(o => o.setName('role').setDescription('Role DJ (vide = tout le monde)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  // ─── AFK ────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('afk').setDescription('Te mettre en AFK')
    .addStringOption(o => o.setName('raison').setDescription('Raison de ton AFK')),

  // ─── Invites ────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('invites').setDescription('Voir le nombre d\'invitations d\'un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre')),

  // ─── Economie ───────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('balance').setDescription('Voir ton solde')
    .addUserOption(o => o.setName('membre').setDescription('Membre')),
  new SlashCommandBuilder().setName('daily').setDescription('Reclamer ta recompense quotidienne'),
  new SlashCommandBuilder().setName('work').setDescription('Travailler pour gagner des pieces'),
  new SlashCommandBuilder().setName('pay').setDescription('Donner des pieces a un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('shop').setDescription('Voir la boutique de roles'),
  new SlashCommandBuilder().setName('buy').setDescription('Acheter un role dans la boutique')
    .addRoleOption(o => o.setName('role').setDescription('Role a acheter').setRequired(true)),
  new SlashCommandBuilder().setName('inventory').setDescription('Voir les roles achetes'),
  new SlashCommandBuilder().setName('addshopitem').setDescription('Ajouter un role a la boutique')
    .addRoleOption(o => o.setName('role').setDescription('Role a vendre').setRequired(true))
    .addIntegerOption(o => o.setName('prix').setDescription('Prix en pieces').setRequired(true).setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('removeshopitem').setDescription('Retirer un role de la boutique')
    .addRoleOption(o => o.setName('role').setDescription('Role a retirer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('leaderboard-eco').setDescription('Top 10 des plus riches'),

  // ─── Fun ────────────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('8ball').setDescription('Poser une question a la boule magique')
    .addStringOption(o => o.setName('question').setDescription('Ta question').setRequired(true)),
  new SlashCommandBuilder().setName('coinflip').setDescription('Pile ou face'),
  new SlashCommandBuilder().setName('dice').setDescription('Lancer un de')
    .addIntegerOption(o => o.setName('faces').setDescription('Nombre de faces (defaut: 6)').setMinValue(2).setMaxValue(100)),
  new SlashCommandBuilder().setName('rps').setDescription('Pierre-feuille-ciseaux')
    .addStringOption(o => o.setName('choix').setDescription('pierre, feuille ou ciseaux').setRequired(true)
      .addChoices({ name: 'Pierre', value: 'pierre' }, { name: 'Feuille', value: 'feuille' }, { name: 'Ciseaux', value: 'ciseaux' })),

  // ─── Moderation avancee ─────────────────────────────────────────────
  new SlashCommandBuilder().setName('tempban').setDescription('Bannir temporairement un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('duree').setDescription('Duree (ex: 1h, 1d, 7d)').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('softban').setDescription('Ban + unban (supprime les messages)')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('report').setDescription('Signaler un membre (envoye dans les logs)')
    .addUserOption(o => o.setName('membre').setDescription('Membre a signaler').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du signalement').setRequired(true)),
  new SlashCommandBuilder().setName('massrole').setDescription('Ajouter/retirer un role a tous les membres')
    .addStringOption(o => o.setName('action').setDescription('Ajouter ou retirer').setRequired(true)
      .addChoices({ name: 'Ajouter', value: 'add' }, { name: 'Retirer', value: 'remove' }))
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ─── Stats & Backup ─────────────────────────────────────────────────
  new SlashCommandBuilder().setName('stats').setDescription('Statistiques du bot'),
  new SlashCommandBuilder().setName('channelinfo').setDescription('Infos sur un salon')
    .addChannelOption(o => o.setName('salon').setDescription('Salon')),
  new SlashCommandBuilder().setName('backup-create').setDescription('Sauvegarder les roles et salons du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('backup-load').setDescription('Restaurer une backup')
    .addStringOption(o => o.setName('id').setDescription('ID de la backup').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ─── MEGA: /game ─────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('game').setDescription('Mini-jeux et jeux d\'argent')
    .addSubcommandGroup(g => g.setName('casino').setDescription('Jeux de casino')
      .addSubcommand(s => s.setName('slots').setDescription('Machine a sous').addIntegerOption(o => o.setName('mise').setDescription('Mise en pieces').setRequired(true).setMinValue(10)))
      .addSubcommand(s => s.setName('blackjack').setDescription('Blackjack').addIntegerOption(o => o.setName('mise').setDescription('Mise en pieces').setRequired(true).setMinValue(10)))
      .addSubcommand(s => s.setName('bet').setDescription('Pari 50/50').addIntegerOption(o => o.setName('mise').setDescription('Mise en pieces').setRequired(true).setMinValue(10)))
      .addSubcommand(s => s.setName('roulette').setDescription('Roulette').addIntegerOption(o => o.setName('mise').setDescription('Mise').setRequired(true).setMinValue(10)).addStringOption(o => o.setName('couleur').setDescription('Couleur').setRequired(true).addChoices({name:'Rouge',value:'rouge'},{name:'Noir',value:'noir'},{name:'Vert',value:'vert'})))
    )
    .addSubcommandGroup(g => g.setName('aventure').setDescription('Aventure et economie')
      .addSubcommand(s => s.setName('fish').setDescription('Pecher un poisson'))
      .addSubcommand(s => s.setName('hunt').setDescription('Chasser un animal'))
      .addSubcommand(s => s.setName('rob').setDescription('Voler un membre').addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true)))
      .addSubcommand(s => s.setName('crime').setDescription('Commettre un crime (risque)'))
      .addSubcommand(s => s.setName('beg').setDescription('Mendier'))
      .addSubcommand(s => s.setName('duel').setDescription('Defier un membre').addUserOption(o => o.setName('adversaire').setDescription('Adversaire').setRequired(true)).addIntegerOption(o => o.setName('mise').setDescription('Mise').setRequired(true).setMinValue(10)))
      .addSubcommand(s => s.setName('mine').setDescription('Miner des ressources'))
      .addSubcommand(s => s.setName('explore').setDescription('Explorer pour trouver des tresors'))
    )
    .addSubcommandGroup(g => g.setName('jeux').setDescription('Jeux multijoueurs et solo')
      .addSubcommand(s => s.setName('tictactoe').setDescription('Morpion').addUserOption(o => o.setName('adversaire').setDescription('Adversaire').setRequired(true)))
      .addSubcommand(s => s.setName('trivia').setDescription('Question de culture generale'))
      .addSubcommand(s => s.setName('guess').setDescription('Deviner le nombre (1-100)'))
      .addSubcommand(s => s.setName('hangman').setDescription('Jeu du pendu'))
      .addSubcommand(s => s.setName('quickmath').setDescription('Calcul mental rapide'))
      .addSubcommand(s => s.setName('memory').setDescription('Jeu de memoire'))
    ),

  // ─── MEGA: /fun ─────────────────────────────────────────────────────
  new SlashCommandBuilder().setName('fun').setDescription('Commandes fun et sociales')
    .addSubcommandGroup(g => g.setName('social').setDescription('Interactions sociales')
      .addSubcommand(s => s.setName('hug').setDescription('Calin').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('slap').setDescription('Gifle').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('pat').setDescription('Caresser la tete').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('kiss').setDescription('Bisou').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('punch').setDescription('Coup de poing').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('highfive').setDescription('High five').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('wave').setDescription('Saluer').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('compliment').setDescription('Complimenter').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('roast').setDescription('Roast').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('cry').setDescription('Pleurer'))
      .addSubcommand(s => s.setName('dance').setDescription('Danser'))
      .addSubcommand(s => s.setName('marry').setDescription('Demander en mariage').addUserOption(o => o.setName('membre').setDescription('Ton ame soeur').setRequired(true)))
      .addSubcommand(s => s.setName('divorce').setDescription('Divorcer'))
      .addSubcommand(s => s.setName('partner').setDescription('Voir le couple d\'un membre').addUserOption(o => o.setName('membre').setDescription('Membre')))
    )
    .addSubcommandGroup(g => g.setName('profil').setDescription('Stats et profils fun')
      .addSubcommand(s => s.setName('rate').setDescription('Noter quelque chose /10').addStringOption(o => o.setName('chose').setDescription('Chose a noter').setRequired(true)))
      .addSubcommand(s => s.setName('ship').setDescription('Compatibilite amoureuse').addUserOption(o => o.setName('user1').setDescription('Membre 1').setRequired(true)).addUserOption(o => o.setName('user2').setDescription('Membre 2').setRequired(true)))
      .addSubcommand(s => s.setName('iq').setDescription('QI aleatoire').addUserOption(o => o.setName('membre').setDescription('Membre')))
      .addSubcommand(s => s.setName('wanted').setDescription('Avis de recherche').addUserOption(o => o.setName('membre').setDescription('Membre')))
      .addSubcommand(s => s.setName('simprate').setDescription('Taux de simp').addUserOption(o => o.setName('membre').setDescription('Membre')))
      .addSubcommand(s => s.setName('hack').setDescription('Fake hack').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('joke').setDescription('Blague aleatoire'))
      .addSubcommand(s => s.setName('fact').setDescription('Fait aleatoire'))
      .addSubcommand(s => s.setName('quote').setDescription('Citation inspirante'))
    )
    .addSubcommandGroup(g => g.setName('texte').setDescription('Manipulation de texte')
      .addSubcommand(s => s.setName('reverse').setDescription('Inverser du texte').addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)))
      .addSubcommand(s => s.setName('mock').setDescription('tExTe SpOnGeBoB').addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)))
      .addSubcommand(s => s.setName('clap').setDescription('Texte avec des claps').addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)))
      .addSubcommand(s => s.setName('spoiler').setDescription('Chaque lettre en spoiler').addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)))
      .addSubcommand(s => s.setName('binary').setDescription('Convertir en binaire').addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)))
      .addSubcommand(s => s.setName('encode').setDescription('Encoder en Base64').addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)))
      .addSubcommand(s => s.setName('decode').setDescription('Decoder du Base64').addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)))
      .addSubcommand(s => s.setName('vaporwave').setDescription('T e x t e  e s p a c e').addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)))
      .addSubcommand(s => s.setName('ascii').setDescription('Texte en majuscules ASCII').addStringOption(o => o.setName('texte').setDescription('Texte (court)').setRequired(true)))
      .addSubcommand(s => s.setName('choose').setDescription('Choix aleatoire').addStringOption(o => o.setName('options').setDescription('Options separees par |').setRequired(true)))
      .addSubcommand(s => s.setName('password').setDescription('Generer un mot de passe').addIntegerOption(o => o.setName('longueur').setDescription('Longueur (8-64)').setMinValue(8).setMaxValue(64)))
      .addSubcommand(s => s.setName('calc').setDescription('Calculatrice').addStringOption(o => o.setName('expression').setDescription('Expression (ex: 2+2*3)').setRequired(true)))
    ),

  // ─── MEGA: /manage ──────────────────────────────────────────────────
  new SlashCommandBuilder().setName('manage').setDescription('Gestion avancee du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup(g => g.setName('channel').setDescription('Gestion des salons')
      .addSubcommand(s => s.setName('create').setDescription('Creer un salon').addStringOption(o => o.setName('nom').setDescription('Nom').setRequired(true)).addStringOption(o => o.setName('type').setDescription('Type').setRequired(true).addChoices({name:'Texte',value:'text'},{name:'Vocal',value:'voice'},{name:'Categorie',value:'category'})))
      .addSubcommand(s => s.setName('delete').setDescription('Supprimer un salon').addChannelOption(o => o.setName('salon').setDescription('Salon').setRequired(true)))
      .addSubcommand(s => s.setName('clone').setDescription('Cloner un salon').addChannelOption(o => o.setName('salon').setDescription('Salon')))
      .addSubcommand(s => s.setName('rename').setDescription('Renommer un salon').addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true)).addChannelOption(o => o.setName('salon').setDescription('Salon')))
      .addSubcommand(s => s.setName('topic').setDescription('Changer le sujet').addStringOption(o => o.setName('sujet').setDescription('Nouveau sujet').setRequired(true)).addChannelOption(o => o.setName('salon').setDescription('Salon')))
      .addSubcommand(s => s.setName('hide').setDescription('Cacher un salon').addChannelOption(o => o.setName('salon').setDescription('Salon')))
      .addSubcommand(s => s.setName('unhide').setDescription('Rendre visible un salon').addChannelOption(o => o.setName('salon').setDescription('Salon')))
    )
    .addSubcommandGroup(g => g.setName('role').setDescription('Gestion des roles')
      .addSubcommand(s => s.setName('create').setDescription('Creer un role').addStringOption(o => o.setName('nom').setDescription('Nom').setRequired(true)).addStringOption(o => o.setName('couleur').setDescription('Couleur hex')))
      .addSubcommand(s => s.setName('delete').setDescription('Supprimer un role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
      .addSubcommand(s => s.setName('color').setDescription('Changer la couleur').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)).addStringOption(o => o.setName('couleur').setDescription('Couleur hex').setRequired(true)))
      .addSubcommand(s => s.setName('info').setDescription('Infos d\'un role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
      .addSubcommand(s => s.setName('list').setDescription('Lister tous les roles'))
    )
    .addSubcommandGroup(g => g.setName('voice').setDescription('Gestion vocale')
      .addSubcommand(s => s.setName('kick').setDescription('Deconnecter du vocal').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('move').setDescription('Deplacer dans un autre vocal').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addChannelOption(o => o.setName('salon').setDescription('Salon vocal cible').setRequired(true)))
      .addSubcommand(s => s.setName('muteall').setDescription('Mute tout le vocal'))
      .addSubcommand(s => s.setName('unmuteall').setDescription('Unmute tout le vocal'))
    )
    .addSubcommandGroup(g => g.setName('emoji').setDescription('Gestion des emojis')
      .addSubcommand(s => s.setName('steal').setDescription('Voler un emoji par URL').addStringOption(o => o.setName('url').setDescription('URL de l\'image').setRequired(true)).addStringOption(o => o.setName('nom').setDescription('Nom de l\'emoji').setRequired(true)))
      .addSubcommand(s => s.setName('list').setDescription('Lister les emojis du serveur'))
      .addSubcommand(s => s.setName('delete').setDescription('Supprimer un emoji').addStringOption(o => o.setName('nom').setDescription('Nom de l\'emoji').setRequired(true)))
    )
    .addSubcommandGroup(g => g.setName('eco').setDescription('Admin economie')
      .addSubcommand(s => s.setName('add').setDescription('Ajouter des pieces').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true)))
      .addSubcommand(s => s.setName('remove').setDescription('Retirer des pieces').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true)))
      .addSubcommand(s => s.setName('reset').setDescription('Reset le solde').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
    )
    .addSubcommandGroup(g => g.setName('xp').setDescription('Admin XP/niveaux')
      .addSubcommand(s => s.setName('add').setDescription('Ajouter de l\'XP').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addIntegerOption(o => o.setName('montant').setDescription('XP').setRequired(true)))
      .addSubcommand(s => s.setName('remove').setDescription('Retirer de l\'XP').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addIntegerOption(o => o.setName('montant').setDescription('XP').setRequired(true)))
      .addSubcommand(s => s.setName('reset').setDescription('Reset l\'XP').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
    )
    .addSubcommandGroup(g => g.setName('bank').setDescription('Banque')
      .addSubcommand(s => s.setName('deposit').setDescription('Deposer en banque').addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)))
      .addSubcommand(s => s.setName('withdraw').setDescription('Retirer de la banque').addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)))
      .addSubcommand(s => s.setName('balance').setDescription('Solde bancaire').addUserOption(o => o.setName('membre').setDescription('Membre')))
    )
    .addSubcommandGroup(g => g.setName('birthday').setDescription('Anniversaires')
      .addSubcommand(s => s.setName('set').setDescription('Definir un anniversaire').addStringOption(o => o.setName('date').setDescription('Date JJ/MM (ex: 25/12)').setRequired(true)).addUserOption(o => o.setName('membre').setDescription('Membre (defaut: toi-meme)')))
      .addSubcommand(s => s.setName('check').setDescription('Voir l\'anniversaire').addUserOption(o => o.setName('membre').setDescription('Membre')))
      .addSubcommand(s => s.setName('list').setDescription('Prochains anniversaires'))
      .addSubcommand(s => s.setName('remove').setDescription('Supprimer un anniversaire').addUserOption(o => o.setName('membre').setDescription('Membre (defaut: toi-meme)')))
    )
    .addSubcommandGroup(g => g.setName('note').setDescription('Notes personnelles')
      .addSubcommand(s => s.setName('add').setDescription('Ajouter une note').addStringOption(o => o.setName('contenu').setDescription('Contenu').setRequired(true)))
      .addSubcommand(s => s.setName('list').setDescription('Voir tes notes'))
      .addSubcommand(s => s.setName('delete').setDescription('Supprimer une note').addIntegerOption(o => o.setName('id').setDescription('Numero de la note').setRequired(true).setMinValue(1)))
      .addSubcommand(s => s.setName('clear').setDescription('Supprimer toutes tes notes'))
    )
    .addSubcommandGroup(g => g.setName('levelreward').setDescription('Recompenses de niveaux')
      .addSubcommand(s => s.setName('add').setDescription('Ajouter une recompense').addIntegerOption(o => o.setName('niveau').setDescription('Niveau requis').setRequired(true).setMinValue(1)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
      .addSubcommand(s => s.setName('list').setDescription('Voir les recompenses'))
      .addSubcommand(s => s.setName('remove').setDescription('Supprimer une recompense').addIntegerOption(o => o.setName('niveau').setDescription('Niveau').setRequired(true)))
    )
    .addSubcommandGroup(g => g.setName('ticket').setDescription('Gestion des tickets')
      .addSubcommand(s => s.setName('add').setDescription('Ajouter un membre au ticket').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('remove').setDescription('Retirer un membre du ticket').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
      .addSubcommand(s => s.setName('rename').setDescription('Renommer le ticket').addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true)))
    )
    .addSubcommandGroup(g => g.setName('profile').setDescription('Profils personnalises')
      .addSubcommand(s => s.setName('view').setDescription('Voir un profil').addUserOption(o => o.setName('membre').setDescription('Membre')))
      .addSubcommand(s => s.setName('bio').setDescription('Definir ta bio').addStringOption(o => o.setName('texte').setDescription('Ta bio (max 200 caracteres)').setRequired(true)))
      .addSubcommand(s => s.setName('color').setDescription('Couleur de ton profil').addStringOption(o => o.setName('couleur').setDescription('Couleur hex (ex: #ff6b9d)').setRequired(true)))
      .addSubcommand(s => s.setName('title').setDescription('Titre affiche sur ton profil').addStringOption(o => o.setName('titre').setDescription('Ton titre (max 50 caracteres)').setRequired(true)))
      .addSubcommand(s => s.setName('reset').setDescription('Reinitialiser ton profil'))
    )
    .addSubcommandGroup(g => g.setName('voicestats').setDescription('Statistiques vocales')
      .addSubcommand(s => s.setName('view').setDescription('Voir tes stats vocales').addUserOption(o => o.setName('membre').setDescription('Membre')))
      .addSubcommand(s => s.setName('leaderboard').setDescription('Top 10 temps en vocal'))
      .addSubcommand(s => s.setName('reset').setDescription('Reset les stats vocales d\'un membre').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
    )
    .addSubcommandGroup(g => g.setName('playlist').setDescription('Playlists personnelles')
      .addSubcommand(s => s.setName('save').setDescription('Sauvegarder la file actuelle').addStringOption(o => o.setName('nom').setDescription('Nom de la playlist').setRequired(true)))
      .addSubcommand(s => s.setName('load').setDescription('Charger une playlist sauvegardee').addStringOption(o => o.setName('nom').setDescription('Nom de la playlist').setRequired(true)))
      .addSubcommand(s => s.setName('list').setDescription('Voir tes playlists'))
      .addSubcommand(s => s.setName('delete').setDescription('Supprimer une playlist').addStringOption(o => o.setName('nom').setDescription('Nom de la playlist').setRequired(true)))
      .addSubcommand(s => s.setName('view').setDescription('Voir le contenu d\'une playlist').addStringOption(o => o.setName('nom').setDescription('Nom de la playlist').setRequired(true)))
    )
    .addSubcommandGroup(g => g.setName('birthdayconfig').setDescription('Configuration anniversaires')
      .addSubcommand(s => s.setName('channel').setDescription('Salon des annonces d\'anniversaire').addChannelOption(o => o.setName('salon').setDescription('Salon (vide = desactiver)').addChannelTypes(ChannelType.GuildText)))
    ),

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
