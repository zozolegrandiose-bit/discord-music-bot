const { spawn } = require('child_process');
const path = require('path');

function startBot() {
  console.log('[Launcher] Demarrage du bot...');
  const child = spawn('node', ['index.js'], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log('[Launcher] Redemarrage dans 2 secondes...');
      setTimeout(startBot, 2000);
    } else {
      console.log(`[Launcher] Crash (code ${code}). Redemarrage dans 5 secondes...`);
      setTimeout(startBot, 5000);
    }
  });
}

startBot();
