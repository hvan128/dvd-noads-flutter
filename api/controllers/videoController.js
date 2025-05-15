/**
 * Controller functions for video operations
 */
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { DOWNLOAD_DIR, DOWNLOAD_EXPIRY_HOURS } = require('../config/config');
const douyinService = require('../services/douyinService');
const downloadService = require('../services/downloadService');
const cleanupService = require('../services/cleanupService');
const urlUtils = require('../utils/urlUtils');

/**
 * Lấy thông tin video từ URL Douyin
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
exports.getVideoInfo = async (req, res, next) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL không được cung cấp' });
    }
    
    // Làm sạch URL đầu vào
    const cleanedUrl = urlUtils.cleanUrl(url);
    console.log(`[INFO] Đang truy cập URL đã làm sạch: ${cleanedUrl}`);
    
    // Lấy thông tin video
    const videoData = await douyinService.fetchVideoInfo(cleanedUrl);
    
    if (!videoData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không thể lấy dữ liệu từ video Douyin. Liên kết có thể không hợp lệ hoặc đã hết hạn.'
      });
    }
    
    res.json(videoData);
    
  } catch (error) {
    next(error);
  }
};

/**
 * Tải xuống video hoặc hình ảnh
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
exports.downloadContent = async (req, res, next) => {
  try {
    const { url, type, videoUrl, images } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL không được cung cấp' });
    }
    
    if (type !== 'video' && type !== 'images') {
      return res.status(400).json({ success: false, message: 'Loại nội dung không hợp lệ' });
    }
    
    if (type === 'video' && !videoUrl) {
      return res.status(400).json({ success: false, message: 'URL video không được cung cấp' });
    }
    
    if (type === 'images' && (!images || !Array.isArray(images) || images.length === 0)) {
      return res.status(400).json({ success: false, message: 'Danh sách hình ảnh không hợp lệ' });
    }
    
    // Tạo ID duy nhất cho file
    const fileId = uuidv4();
    let filePath;
    let downloadUrl;
    
    if (type === 'video') {
      // Xử lý và tải video
      const result = await downloadService.downloadVideo(url, videoUrl, fileId);
      filePath = result.filePath;
      downloadUrl = result.downloadUrl;
    } else {
      // Tải và nén hình ảnh
      const result = await downloadService.downloadAndZipImages(images, fileId);
      filePath = result.filePath;
      downloadUrl = result.downloadUrl;
    }
    
    res.json({
      success: true,
      data: {
        downloadUrl,
        expireAt: new Date(Date.now() + DOWNLOAD_EXPIRY_HOURS * 60 * 60 * 1000)
      }
    });
    
    // Xóa file sau thời gian hết hạn
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[INFO] Đã xóa file: ${filePath}`);
      }
    }, DOWNLOAD_EXPIRY_HOURS * 60 * 60 * 1000);
    
  } catch (error) {
    next(error);
  }
};

/**
 * Dọn dẹp file tạm
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
exports.cleanupFiles = async (req, res, next) => {
  try {
    const deleteCount = await cleanupService.cleanupExpiredFiles();
    
    res.json({
      success: true,
      message: `Đã dọn dẹp ${deleteCount} file`
    });
    
  } catch (error) {
    next(error);
  }
};