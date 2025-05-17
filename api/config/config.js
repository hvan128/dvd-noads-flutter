// config/config.js - Cấu hình tập trung
module.exports = {
  PORT: process.env.PORT || 3000,
  IS_RENDER_ENVIRONMENT: process.env.RENDER === 'true',
  PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};