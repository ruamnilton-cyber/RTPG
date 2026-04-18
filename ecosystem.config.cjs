module.exports = {
  apps: [
    {
      name: "rtpg",
      script: "scripts/start.mjs",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
        PORT: 3333,
        RTPG_DATA_DIR: "/opt/rtpg-data",
        DATABASE_URL: "file:/opt/rtpg-data/storage/rtpg.sqlite",
        JWT_SECRET: "SUBSTITUA_POR_UMA_CHAVE_SEGURA"
      }
    }
  ]
};
