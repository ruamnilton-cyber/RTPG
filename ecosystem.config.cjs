module.exports = {
  apps: [
    {
      name: "rtpg",
      script: "npm",
      args: "run start",
      cwd: "/opt/rtpg-app",
      env: {
        NODE_ENV: "production",
        PORT: "3333",
        RTPG_DATA_DIR: "/opt/rtpg-data",
        APP_BASE_URL: "https://rtpgapp.com",
        SAAS_TRIAL_DAYS: "3"
      }
    }
  ]
};
