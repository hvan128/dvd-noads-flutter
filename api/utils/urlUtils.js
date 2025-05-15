/**
 * Utilities for handling Douyin URLs
 */

/**
 * Làm sạch URL Douyin từ chuỗi đầu vào
 * @param {string} url URL đầu vào từ người dùng
 * @returns {string} URL Douyin đã làm sạch
 */
function cleanUrl(url) {
  // Tìm URL Douyin trong chuỗi đầu vào
  const douyinUrlMatch = url.match(/https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+/);
  if (douyinUrlMatch) {
    return douyinUrlMatch[0];
  }
  
  // Nếu đã là URL đầy đủ của Douyin
  if (url.startsWith('https://www.douyin.com/')) {
    return url;
  }
  
  return url; // Trả về URL gốc nếu không tìm thấy mẫu nào
}

/**
 * Trích xuất ID video từ URL Douyin
 * @param {string} url URL Douyin
 * @returns {string|null} ID video hoặc null nếu không tìm thấy
 */
function extractVideoId(url) {
  // Mẫu cho URL dạng /video/{id} hoặc /note/{id}
  const videoPattern = url.match(/\/(?:video|note)\/(\d+)/);
  if (videoPattern) {
    return videoPattern[1];
  }
  
  // Mẫu cho tham số aweme_id trong URL
  const awemePattern = url.match(/aweme_id=(\d+)/);
  if (awemePattern) {
    return awemePattern[1];
  }
  
  // Mẫu cho tham số vid trong URL
  const vidPattern = url.match(/vid=(\d+)/);
  if (vidPattern) {
    return vidPattern[1];
  }
  
  return null;
}

/**
 * Tạo token ngẫu nhiên cho API Douyin
 * @returns {string} Token ngẫu nhiên
 */
function generateRandomMSToken() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 107; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

module.exports = {
  cleanUrl,
  extractVideoId,
  generateRandomMSToken
};