// routes/api.js - Các API endpoint
const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

// API lấy thông tin video
router.post('/info', videoController.getInfo);

// API lấy URL tải xuống
router.post('/get-download-url', videoController.getDownload);

module.exports = router;