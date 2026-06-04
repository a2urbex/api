// PM2 process definition for the API.
//
// IMPORTANT: watch is disabled. The API writes downloaded files (Pinterest
// pins, KML imports) into the working tree; running PM2 in --watch mode would
// reload the process on every written file and kill any in-progress import.
// Deploy with `git pull && pm2 reload a2urbex-api` instead of relying on watch.
module.exports = {
  apps: [
    {
      name: 'a2urbex-api',
      script: 'npm',
      args: 'run prod',
      cwd: '/var/www/a2urbex/api',
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
}
