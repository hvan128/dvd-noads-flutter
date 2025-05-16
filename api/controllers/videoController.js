// controllers/videoController.js - Điều khiển các yêu cầu liên quan đến video
const { getVideoInfo, getDownloadUrl } = require('../services/videoService');

/**
 * Xử lý yêu cầu lấy thông tin video
 * @param {Object} req Request Express
 * @param {Object} res Response Express
 * @param {Function} next Next middleware
 */
async function getInfo(req, res, next) {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL không được cung cấp' });
    }
    
    const videoData = await getVideoInfo(url);
    
    res.json({
      success: true,
      data: videoData
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Xử lý yêu cầu lấy URL tải xuống
 * @param {Object} req Request Express
 * @param {Object} res Response Express
 * @param {Function} next Next middleware
 */
async function getDownload(req, res, next) {
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
    
    const downloadData = await getDownloadUrl({ url, type, videoUrl, images });
    
    res.json({
      success: true,
      data: downloadData
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInfo,
  getDownload
};