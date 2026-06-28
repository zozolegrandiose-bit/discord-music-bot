#!/bin/bash
npm install

# Installer yt-dlp (binaire Linux)
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp
chmod +x yt-dlp

# Installer ffmpeg
apt-get update && apt-get install -y ffmpeg || true
