/**
 * Configuration settings for the application
 */
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  DOWNLOAD_DIR: path.join(__dirname, '..', 'downloads'),
  DOWNLOAD_EXPIRY_HOURS: 24, // File expiry time in hours
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  REFERER: 'https://www.douyin.com/'
};