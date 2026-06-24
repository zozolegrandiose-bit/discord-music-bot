# Discord Music Bot

Bot Discord musique avec commandes slash — lit de la musique YouTube dans tes salons vocaux.

## Prerequis

- **Node.js** v18+
- **FFmpeg** installe et dans le PATH
  - Windows : telecharger sur https://ffmpeg.org/download.html et ajouter au PATH
  - Linux : `sudo apt install ffmpeg`
  - macOS : `brew install ffmpeg`

## Installation

### 1. Installer les dependances

```bash
cd discord-music-bot
npm install
```

### 2. Creer le bot Discord

1. Va sur https://discord.com/developers/applications
2. **New Application** > donne-lui un nom
3. Onglet **Bot** > **Reset Token** > copie le token
4. Onglet **OAuth2 > URL Generator** :
   - Scopes : `bot` + `applications.commands`
   - Permissions : `Connect`, `Speak`, `Send Messages`, `Read Message History`
   - Copie l'URL et invite le bot sur ton serveur

### 3. Configurer le fichier .env

```bash
cp .env.example .env
```

Remplis les valeurs :

```env
DISCORD_TOKEN=ton_token_ici
CLIENT_ID=id_de_ton_application
GUILD_ID=id_de_ton_serveur
```

### 4. Deployer les commandes slash

```bash
npm run deploy
```

Avec `GUILD_ID` renseigne, les commandes apparaissent instantanement.

### 5. Lancer le bot

```bash
npm start
```

## Commandes

| Commande | Description |
|----------|-------------|
| `/play <recherche ou URL>` | Jouer une musique ou une playlist YouTube |
| `/skip` | Passer a la suivante |
| `/stop` | Arreter et vider la file |
| `/pause` | Mettre en pause |
| `/resume` | Reprendre la lecture |
| `/queue [page]` | Voir la file d'attente |
| `/volume <0-100>` | Regler le volume |
| `/loop` | Activer/desactiver la repetition |
| `/nowplaying` | Voir la musique en cours |
| `/shuffle` | Melanger la file d'attente |
| `/remove <position>` | Retirer une piste de la file |
| `/clear` | Vider la file (garde la piste en cours) |

## Hebergement 24/7

- **Gratuit** : Railway, Render
- **VPS** : OVH, Hetzner, DigitalOcean (~5 euros/mois)
- **Sur ton PC** : `npm install -g pm2 && pm2 start index.js`
