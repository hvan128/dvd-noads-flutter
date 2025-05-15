/**
 * Cleanup Service - Quản lý việc dọn dẹp file tạm
 */
const fileUtils = require('../utils/fileUtils');

/**
 * Dọn dẹp các file tạm trong thư mục tải xuống
 * @param {string} downloadDir Thư mục tải xuống
 * @param {number} maxAgeMs Tuổi tối đa của file (ms), mặc định là 24 giờ
 * @returns {number} Số lượng file đã xóa
 */
function cleanupDownloadDirectory(downloadDir, maxAgeMs = 24 * 60 * 60 * 1000) {
  console.log(`[INFO] Đang dọn dẹp thư mục tải xuống: ${downloadDir}`);
  const deletedCount = fileUtils.cleanupOldFiles(downloadDir, maxAgeMs);
  console.log(`[INFO] Đã xóa ${deletedCount} file tạm`);
  return deletedCount;
}

/**
 * Thiết lập lịch trình tự động dọn dẹp
 * @param {string} downloadDir Thư mục tải xuống
 * @param {number} intervalMs Khoảng thời gian giữa các lần dọn dẹp (ms)
 */
function setupCleanupSchedule(downloadDir, intervalMs = 6 * 60 * 60 * 1000) {
  // Dọn dẹp ngay lập tức khi khởi động
  cleanupDownloadDirectory(downloadDir);
  
  // Thiết lập dọn dẹp định kỳ (mặc định 6 giờ một lần)
  setInterval(() => {
    cleanupDownloadDirectory(downloadDir);
  }, intervalMs);
  
  console.log(`[INFO] Đã thiết lập lịch trình dọn dẹp tự động mỗi ${intervalMs / (60 * 60 * 1000)} giờ`);
}

module.exports = {
  cleanupDownloadDirectory,
  setupCleanupSchedule
};