# Node.js server to transfer audio streams between Voximplant Call and ChatGPT Realtime API

## Docker commands

### Build
docker build -t audio-proxy-server .

### First run
docker run --name audio-proxy-server -d --restart unless-stopped -p 3000:3000 audio-proxy-server

### Every other run
docker stop audio-proxy-server && docker rm audio-proxy-server && docker run --name audio-proxy-server -d --restart unless-stopped -p 3000:3000 audio-proxy-server
