// services/videoService.js - Xử lý logic lấy dữ liệu video
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { cleanUrl, extractVideoId } = require('../utils/urlUtils');
const { getVideoDataUsingPuppeteer } = require('../utils/puppeteerUtils');
const { USER_AGENT } = require('../config/config');

/**
 * Lấy ID video từ URL Douyin, bao gồm cả xử lý chuyển hướng nếu cần
 * @param {string} url URL cần xử lý
 * @returns {Promise<string|null>} ID video hoặc null nếu không tìm thấy
 */
async function getVideoIdFromUrl(url) {
  // Làm sạch URL đầu vào
  const cleanedUrl = cleanUrl(url);
  console.log(`[INFO] Đang xử lý URL đã làm sạch: ${cleanedUrl}`);

  // Trích xuất ID video từ URL (nếu có thể)
  let videoId = extractVideoId(cleanedUrl);

  // Nếu không tìm thấy ID trực tiếp, thực hiện quick check để lấy URL chuyển hướng
  if (!videoId) {
    try {
      // Sử dụng axios để lấy URL sau khi chuyển hướng mà không cần Puppeteer
      const response = await axios.get(cleanedUrl, {
        maxRedirects: 5,
        timeout: 10000,
        headers: {
          'User-Agent': USER_AGENT
        }
      });

      // Lấy URL cuối cùng sau khi chuyển hướng
      const finalUrl = response.request.res.responseUrl;
      console.log(`[INFO] URL sau khi chuyển hướng: ${finalUrl}`);

      // Trích xuất ID video từ URL chuyển hướng
      videoId = extractVideoId(finalUrl);
    } catch (error) {
      console.error('[ERROR] Lỗi khi lấy URL chuyển hướng:', error.message);
      // Tiếp tục với code flow, có thể videoId sẽ được tìm thấy bằng cách khác
    }
  }

  return videoId;
}

/**
 * Xử lý và định dạng dữ liệu video để trả về cho client
 * @param {Object} videoData Dữ liệu video thô từ API
 * @returns {Object} Dữ liệu video đã được định dạng
 */
function processVideoData(videoData) {
  if (!videoData || !videoData.aweme_detail) {
    return null;
  }

  const data = videoData.aweme_detail;
  const isImagePost = data.images !== null && Array.isArray(data.images);

  // Chuẩn bị dữ liệu trả về
  const result = {
    id: data.aweme_id,
    desc: data.desc || '',
    author: data.author?.nickname || 'Unknown',
    cover: data.video?.cover?.url_list?.[0] || '',
    type: isImagePost ? 'images' : 'video'
  };

  if (isImagePost) {
    // Trường hợp bài đăng hình ảnh
    result.images = data.images.map(image => image.url_list[image.url_list.length - 1]);
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

    result.videoUrl = videoUrl;
  }

  return result;
}

async function getVideoDataUsing3rdPartyApi(videoId) {
  const apiUrl = 'http://35.241.110.76/api/douyin/web/fetch_one_video';
  const headers = {
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/json'
  };

  console.time(`[TIMER] Thời gian lấy dữ liệu video ${videoId}`);

  try {
    const response = await axios.get(apiUrl, {
      headers,
      params: { aweme_id: videoId }
    });

    console.timeEnd(`[TIMER] Thời gian lấy dữ liệu video ${videoId}`);

    if (response.status === 200) {
      console.log('[INFO] Đã lấy dữ liệu từ API Douyin thành công');
      return response.data.data;
    } else {
      throw new Error('Lỗi khi lấy dữ liệu từ API Douyin');
    }
  } catch (error) {
    console.timeEnd(`[TIMER] Thời gian lấy dữ liệu video ${videoId}`);
    console.error('[ERROR] Lỗi khi gọi API:', error.message);
    return null;
  }
}

/**
 * Lấy thông tin video Douyin từ URL
 * @param {string} url URL video Douyin
 * @returns {Promise<Object>} Thông tin video đã xử lý
 */
async function getVideoInfo(url) {
  const videoId = await getVideoIdFromUrl(url);

  if (!videoId) {
    throw new Error('Không thể xác định ID video từ URL cung cấp');
  }

  console.log(`[INFO] Đã tìm thấy video ID: ${videoId}`);

  const videoData = await getVideoDataUsing3rdPartyApi(videoId);

  console.log('[INFO] Đang xử lý dữ liệu video...');

  if (!videoData || !videoData.aweme_detail) {
    throw new Error('Không thể lấy dữ liệu từ video Douyin. Liên kết có thể không hợp lệ hoặc đã hết hạn.');
  }

  const processedData = processVideoData(videoData);

  if (!processedData) {
    throw new Error('Không thể xử lý dữ liệu video.');
  }

  if (processedData.type === 'video' && !processedData.videoUrl) {
    throw new Error('Không thể trích xuất URL video. Video có thể đã bị giới hạn hoặc không có sẵn.');
  }

  return processedData;
}

/**
 * Lấy URL tải xuống cho video hoặc hình ảnh
 * @param {Object} params Thông số cho việc lấy URL tải xuống
 * @returns {Promise<Object>} Thông tin URL tải xuống
 */
async function getDownloadUrl(params) {
  const { url, type, videoUrl, images } = params;

  if (type === 'video') {
    // Kiểm tra xem videoUrl có phải là URL thực sự của video không
    let finalVideoUrl = videoUrl;

    if (videoUrl.includes('douyin.com') && !videoUrl.endsWith('.mp4')) {
      // Nếu là URL Douyin, chứ không phải URL trực tiếp đến video, lấy lại thông tin
      console.log('[INFO] videoUrl không phải là URL trực tiếp đến video, đang thử lấy lại...');

      // Làm sạch URL và lấy videoId
      const cleanedUrl = cleanUrl(url);
      const videoId = extractVideoId(videoUrl) || extractVideoId(cleanedUrl);

      if (!videoId) {
        throw new Error('Không thể xác định ID video từ URL cung cấp');
      }

      // Lấy dữ liệu video bằng Puppeteer
      const videoData = await getVideoDataUsingPuppeteer(videoId);

      if (!videoData || !videoData.aweme_detail || !videoData.aweme_detail.video) {
        throw new Error('Không thể lấy dữ liệu video. Vui lòng thử lại sau.');
      }

      // Tìm URL video thực
      const data = videoData.aweme_detail;

      if (data.video && data.video.play_addr) {
        finalVideoUrl = data.video.play_addr.url_list[0];
      } else if (data.video && data.video.download_addr) {
        finalVideoUrl = data.video.download_addr.url_list[0];
      }

      if (!finalVideoUrl) {
        throw new Error('Không thể tìm thấy URL video hợp lệ.');
      }

      console.log(`[INFO] Đã tìm thấy URL video thực: ${finalVideoUrl}`);
    }

    return {
      type: 'video',
      url: finalVideoUrl,
      filename: `douyin_video_${uuidv4().slice(0, 8)}.mp4`
    };
  } else {
    // Trường hợp hình ảnh
    return {
      type: 'images',
      urls: images,
      prefix: `douyin_image_${uuidv4().slice(0, 8)}`
    };
  }
}

module.exports = {
  getVideoInfo,
  getDownloadUrl
};