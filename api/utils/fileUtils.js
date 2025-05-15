/**
 * Utilities for file operations
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

/**
 * Tải xuống file từ URL
 * @param {string} url URL của file cần tải
 * @param {string} outputPath Đường dẫn lưu file
 * @returns {Promise<void>}
 */
async function downloadFile(url, outputPath) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity;q=1, *;q=0',
      'Range': 'bytes=0-',
      'Referer': 'https://www.douyin.com/'
    }
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Tải xuống nhiều hình ảnh và nén thành file ZIP
 * @param {Array<string>} imageUrls Mảng các URL hình ảnh
 * @param {string} outputPath Đường dẫn lưu file ZIP
 * @param {string} tempDir Đường dẫn thư mục tạm
 * @returns {Promise<void>}
 */
async function downloadAndZipImages(imageUrls, outputPath, tempDir) {
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    // Tải từng hình ảnh
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imagePath = path.join(tempDir, `image_${i + 1}.jpg`);
      await downloadFile(imageUrl, imagePath);
    }
    
    // Tạo file ZIP
    const zip = new AdmZip();
    const files = fs.readdirSync(tempDir);
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      zip.addLocalFile(filePath);
    });
    
    // Lưu file ZIP
    zip.writeZip(outputPath);
    
    // Xóa thư mục tạm
    fs.rmSync(tempDir, { recursive: true, force: true });
    
  } catch (error) {
    // Đảm bảo xóa thư mục tạm nếu có lỗi
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

/**
 * Dọn dẹp các file tạm cũ
 * @param {string} directory Thư mục cần dọn dẹp
 * @param {number} maxAgeMs Tuổi tối đa của file (ms)
 * @returns {number} Số lượng file đã xóa
 */
function cleanupOldFiles(directory, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const files = fs.readdirSync(directory);
    let deleteCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);
      const fileAge = Date.now() - stats.mtimeMs;
      
      if (fileAge > maxAgeMs) {
        fs.unlinkSync(filePath);
        deleteCount++;
      }
    });
    
    return deleteCount;
  } catch (error) {
    console.error('[ERROR] Lỗi khi dọn dẹp file:', error);
    return 0;
  }
}

/**
 * Thiết lập lịch xóa một file sau một khoảng thời gian
 * @param {string} filePath Đường dẫn file cần xóa
 * @param {number} delayMs Thời gian trễ trước khi xóa (ms)
 */
function scheduleFileDeletion(filePath, delayMs = 24 * 60 * 60 * 1000) {
  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[INFO] Đã xóa file: ${filePath}`);
    }
  }, delayMs);
}

/**
 * Đảm bảo thư mục tồn tại
 * @param {string} directory Đường dẫn thư mục
 */
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

module.exports = {
  downloadFile,
  downloadAndZipImages,
  cleanupOldFiles,
  scheduleFileDeletion,
  ensureDirectoryExists
};