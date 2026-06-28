const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
const dest = path.join(__dirname, 'yt-dlp');

if (process.platform === 'win32') {
  console.log('Windows detecte, skip download yt-dlp (utilise yt-dlp.exe local)');
  process.exit(0);
}

console.log('Telechargement de yt-dlp...');

function download(url, file) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, file).then(resolve).catch(reject);
      }
      const stream = fs.createWriteStream(file);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(); });
    });
    req.on('error', reject);
  });
}

download(YTDLP_URL, dest).then(() => {
  fs.chmodSync(dest, 0o755);
  console.log('yt-dlp installe avec succes');
  try {
    const version = execSync(dest + ' --version').toString().trim();
    console.log('yt-dlp version:', version);
  } catch (e) {
    console.log('yt-dlp telecharge mais version non verifiable');
  }
}).catch((err) => {
  console.error('Erreur telechargement yt-dlp:', err.message);
  process.exit(1);
});
