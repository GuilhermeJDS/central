// PM2 na VPS: npm run build && pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    { name: "central", script: "node_modules/next/dist/bin/next", args: "start -p 3000", env: { NODE_ENV: "production" } },
    { name: "central-rastro", cwd: "servicos/rastro", script: "npm", args: "start", env: { GOOGLE_MAPS_HEADLESS: "1" } },
  ],
};
