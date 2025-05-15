/**
 * Core logic for Douyin video processing
 */
const urlUtils = require('../utils/urlUtils');
const puppeteerService = require('./puppeteerService');

/**
 * Trích xuất và chuẩn bị dữ liệu từ response của API Douyin
 * @param {Object} videoData - Dữ liệu video từ API
 * @returns {Object} Dữ liệu đã được chuẩn bị
 */
function prepareVideoData(videoData) {
  if (!videoData || !videoData.aweme_detail) {
    return null;
  }

  const data = videoData.aweme_detail;
  const isImagePost = data.images !== null && Array.isArray(data.images);

  // Chuẩn bị dữ liệu trả về
  const result = {
    success: true,
    data: {
      id: data.aweme_id,
      desc: data.desc || '',
      author: data.author?.nickname || 'Unknown',
      cover: data.video?.cover?.url_list?.[0] || '',
      type: isImagePost ? 'images' : 'video'
    }
  };

  if (isImagePost) {
    // Trường hợp bài đăng hình ảnh
    result.data.images = data.images.map(image => image.url_list[image.url_list.length - 1]);
  } else {
    // Trường hợp video
    let videoUrl = '';

    // Tìm URL video chất lượng cao nhất
    if (data.video && data.video.bit_rate) {
      let maxBitRate = 0;

      for (const item of data.video.bit_rate) {
        if (item.bit_rate > maxBitRate && item.play_addr && item.play_addr.url_list.length > 0) {
          maxBitRate = item.bit_rate;
          videoUrl = item.play_addr.url_list[0];
        }
      }
    }

    // Nếu không tìm thấy từ bit_rate, thử từ play_addr
    if (!videoUrl && data.video && data.video.play_addr) {
      videoUrl = data.video.play_addr.url_list[0];
    }

    // Nếu vẫn không tìm thấy, kiểm tra download_addr
    if (!videoUrl && data.video && data.video.download_addr) {
      videoUrl = data.video.download_addr.url_list[0];
    }

    // Nếu vẫn không có URL video, thử lấy từ URI
    if (!videoUrl && data.video && data.video.play_addr && data.video.play_addr.uri) {
      const uri = data.video.play_addr.uri;
      videoUrl = `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=720p&line=0`;
    }

    result.data.videoUrl = videoUrl;
  }

  return result;
}

/**
 * Lấy thông tin video từ URL Douyin
 * @param {string} url - URL Douyin
 * @returns {Promise<Object|null>} Thông tin video hoặc null nếu không tìm thấy
 */
exports.fetchVideoInfo = async (url) => {
  // Lấy dữ liệu video từ puppeteer
  const videoData = await puppeteerService.scrapeVideoData(url);

  if (!videoData) {
    // Nếu không lấy được dữ liệu từ puppeteer, thử phương pháp khác
    const currentUrl = puppeteerService.getRedirectedUrl(url);
    const videoId = urlUtils.extractVideoId(currentUrl);

    if (!videoId) {
      console.log('[INFO] Không thể xác định ID video');
      return null;
    }

    // Thử truy vấn API trực tiếp
    const directData = await puppeteerService.fetchVideoDataDirectly(videoId);

    if (directData) {
      return prepareVideoData(directData);
    }

    // Thử sử dụng puppeteer với URL đầy đủ
    const fullPageData = await puppeteerService.getVideoDataUsingPuppeteer(videoId);

    if (fullPageData) {
      return prepareVideoData(fullPageData);
    }

    return null;
  }

  return prepareVideoData(videoData);
};

/**
 * Lấy URL video thực từ URL và videoUrl đã cung cấp
 * @param {string} url - URL gốc
 * @param {string} videoUrl - URL video đã cung cấp
 * @returns {Promise<string>} URL video thực
 */
exports.getActualVideoUrl = async (url, videoUrl) => {
  // Kiểm tra xem videoUrl có phải là URL thực sự của video không
  if (videoUrl.includes('douyin.com') && !videoUrl.endsWith('.mp4')) {
    // Nếu là URL Douyin, chứ không phải URL trực tiếp đến video, lấy lại thông tin
    console.log('[INFO] videoUrl không phải là URL trực tiếp đến video, đang thử lấy lại...');

    // Làm sạch URL và lấy videoId
    const cleanedUrl = urlUtils.cleanUrl(url);
    const videoId = urlUtils.extractVideoId(videoUrl) || urlUtils.extractVideoId(cleanedUrl);

    if (!videoId) {
      throw new Error('Không thể xác định ID video từ URL cung cấp');
    }

    // Lấy dữ liệu video trực tiếp
    const videoData =
      await puppeteerService.getVideoDataUsingPuppeteer(videoId);

    if (!videoData || !videoData.aweme_detail || !videoData.aweme_detail.video) {
      throw new Error('Không thể lấy dữ liệu video. Vui lòng thử lại sau.');
    }

    // Tìm URL video thực
    const data = videoData.aweme_detail;
    let actualVideoUrl = '';

    if (data.video && data.video.play_addr) {
      actualVideoUrl = data.video.play_addr.url_list[0];
    } else if (data.video && data.video.download_addr) {
      actualVideoUrl = data.video.download_addr.url_list[0];
    }

    if (!actualVideoUrl) {
      throw new Error('Không thể tìm thấy URL video hợp lệ.');
    }

    // Cập nhật videoUrl
    console.log(`[INFO] Đã tìm thấy URL video thực: ${actualVideoUrl}`);
    return actualVideoUrl;
  }

  return videoUrl;
};