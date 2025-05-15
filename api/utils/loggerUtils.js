// File: src/utils/loggerUtils.js
// Utility for logging
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => {
    console.error(`[ERROR] ${message}`);
    if (error) console.error(error);
  },
  warn: (message) => console.warn(`[WARN] ${message}`)
};

module.exports = { logger };