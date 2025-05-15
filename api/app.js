/**
 * Express application setup
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { DOWNLOAD_DIR } = require('./config/config');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Đảm bảo thư mục tải xuống tồn tại
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/downloads', express.static(DOWNLOAD_DIR));

// Routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use(errorHandler);

module.exports = app;