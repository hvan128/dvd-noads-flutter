/**
 * Download Service - Xử lý các thao tác tải video và hình ảnh
 */
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fileUtils = require('../utils/fileUtils');

/**
 * Tải video từ URL
 * @param {string} videoUrl URL của video
 * @param {string} downloadDir Thư mục tải xuống
 * @returns {Promise<Object>} Thông tin về video đã tải
 */
async function downloadVideo(videoUrl, downloadDir) {
  const fileId = uuidv4();
  const filePath = path.join(downloadDir, `${fileId}.mp4`);
  
  await fileUtils.downloadFile(videoUrl, filePath);
  
  // Lên lịch xóa file sau 24 giờ
  fileUtils.scheduleFileDeletion(filePath);
  
  return {
    fileId: fileId,
    filePath: filePath,
    fileName: `${fileId}.mp4`,
    downloadUrl: `/downloads/${fileId}.mp4`,
    expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
}

/**
 * Tải và nén nhiều hình ảnh
 * @param {Array<string>} imageUrls Mảng các URL hình ảnh
 * @param {string} downloadDir Thư mục tải xuống
 * @returns {Promise<Object>} Thông tin về file ZIP đã tạo
 */
async function downloadAndZipImages(imageUrls, downloadDir) {
  const fileId = uuidv4();
  const filePath = path.join(downloadDir, `${fileId}.zip`);
  const tempDir = path.join(downloadDir, 'temp_' + fileId);
  
  await fileUtils.downloadAndZipImages(imageUrls, filePath, tempDir);
  
  // Lên lịch xóa file ZIP sau 24 giờ
  fileUtils.scheduleFileDeletion(filePath);
  
  return {
    fileId: fileId,
    filePath: filePath,
    fileName: `${fileId}.zip`,
    downloadUrl: `/downloads/${fileId}.zip`,
    expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
}

/**
 * Xử lý tải xuống nội dung (video hoặc hình ảnh)
 * @param {string} type Loại nội dung ('video' hoặc 'images')
 * @param {string} videoUrl URL video (nếu type là 'video')
 * @param {Array<string>} images Mảng URL hình ảnh (nếu type là 'images')
 * @param {string} downloadDir Thư mục tải xuống
 * @returns {Promise<Object>} Thông tin về file đã tải
 */
async function processContentDownload(type, videoUrl, images, downloadDir) {
  if (type === 'video') {
    return await downloadVideo(videoUrl, downloadDir);
  } else if (type === 'images') {
    return await downloadAndZipImages(images, downloadDir);
  } else {
    throw new Error('Loại nội dung không hợp lệ');
  }
}

module.exports = {
  downloadVideo,
  downloadAndZipImages,
  processContentDownload
};