/**
 * API route definitions
 */
const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

// Route để lấy thông tin video từ URL Douyin
router.post('/info', videoController.getVideoInfo);

// Route để tải video hoặc hình ảnh xuống
router.post('/download', videoController.downloadContent);

// Route để dọn dẹp file tạm
router.get('/cleanup', videoController.cleanupFiles);

module.exports = router;