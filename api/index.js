// server.js - File chính của API NodeJS
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { cleanUrl, extractVideoId, generateRandomMSToken } = require('./utils/urlUtils');

// Sử dụng plugin Stealth để tránh phát hiện bot
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

/**
 * Thực hiện truy vấn API riêng cho video Douyin
 * @param {string} videoId ID của video Douyin
 * @returns {Promise<Object|null>} Dữ liệu video hoặc null nếu thất bại
 */
async function fetchVideoDataDirectly(videoId) {
  try {
    console.log(`[INFO] Truy vấn API trực tiếp cho video ID: ${videoId}`);
    
    // Tạo các header giống trình duyệt thật
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.douyin.com/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': 'douyin.com; ttwid=1%7C3YKRuDjD_yHY9DkvHbJOXZXk8OfHV9Mp5jNYF3EYNA8%7C1677649113%7C99ce39ceecd30164c9d26c33fa53524d6b6f735c455d4ae97708d87c43d416a7'
    };
    
    // URL của API video chi tiết
    const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${videoId}&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=en-US&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=50&webid=7129360599857284651&msToken=${generateRandomMSToken()}`;
    
    const response = await axios.get(apiUrl, { 
      headers,
      timeout: 10000 // Giảm timeout xuống 10 giây
    });
    
    if (response.data && response.data.aweme_detail) {
      return response.data;
    }
    
    return null;
  } catch (error) {
    console.error('[ERROR] Lỗi khi truy vấn API trực tiếp:', error.message);
    return null;
  }
}

/**
 * Lấy dữ liệu video từ trang video Douyin bằng puppeteer
 * @param {string} videoId ID video
 * @returns {Promise<Object|null>} Dữ liệu video hoặc null nếu thất bại
 */
async function getVideoDataUsingPuppeteer(videoId) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  let page = null;
  
  try {
    console.log(`[INFO] Sử dụng puppeteer để lấy dữ liệu video ID: ${videoId}`);
    
    page = await browser.newPage();
    
    // Đặt User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Biến để lưu trữ dữ liệu từ API
    let videoData = null;
    
    // Flag để theo dõi khi nào đã tìm thấy dữ liệu
    let dataFound = false;
    
    // Chặn response từ API chi tiết video
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      // Chỉ tiếp tục các request nếu chưa tìm thấy dữ liệu
      if (dataFound) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Chặn tất cả các response để tìm dữ liệu video
    page.on('response', async response => {
      // Nếu đã tìm thấy dữ liệu, không xử lý thêm
      if (dataFound) return;
      
      const url = response.url();
      
      // Kiểm tra nhiều API endpoint có thể chứa dữ liệu video
      if (url.includes('aweme/v1/web/aweme/detail') || 
          url.includes('aweme/v1/web/detail') ||
          url.includes('/web/api/v2/aweme/iteminfo')) {
        try {
          const text = await response.text();
          if (text && text.trim() !== '') {
            try {
              const responseData = JSON.parse(text);
              if ((responseData.aweme_detail) || 
                  (responseData.item_list && responseData.item_list.length > 0)) {
                videoData = responseData;
                dataFound = true;
                console.log('[INFO] Đã bắt được dữ liệu video từ API response');
              }
            } catch (jsonError) {
              console.error('[ERROR] Không thể phân tích JSON từ response:', jsonError);
            }
          }
        } catch (error) {
          console.error('[ERROR] Không thể đọc nội dung response:', error);
        }
      }
      
    });
    
    // Truy cập trang video
    const videoUrl = `https://www.douyin.com/video/${videoId}`;
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log(`[INFO] Đã truy cập trang video: ${videoUrl}`);
    
    // Chờ thêm thời gian nhưng giảm xuống chỉ còn 2 giây
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Nếu đã tìm thấy dữ liệu, không cần thực hiện các bước phức tạp khác
    if (dataFound && videoData && videoData.aweme_detail) {
      console.log('[INFO] Đã tìm thấy dữ liệu, bỏ qua các bước trích xuất khác');
      return videoData;
    }
    
    // Trích xuất video URLs từ thẻ video trong trang (chỉ khi chưa tìm thấy dữ liệu)
    if (!videoData || !videoData.aweme_detail || !videoData.aweme_detail.video) {
      console.log('[INFO] Thử trích xuất video URL từ các phần tử trong trang...');
      
      const videoSources = await page.evaluate(() => {
        const results = [];
        // Tìm tất cả thẻ video
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
          if (video.src) results.push(video.src);
          
          // Kiểm tra thẻ source bên trong video
          const sources = video.querySelectorAll('source');
          sources.forEach(source => {
            if (source.src) results.push(source.src);
          });
        });
        
        // Tìm thêm trong các thuộc tính dữ liệu
        const elements = document.querySelectorAll('[data-src]');
        elements.forEach(el => {
          if (el.dataset.src) results.push(el.dataset.src);
        });
        
        return results;
      });
      
      if (videoSources.length > 0) {
        console.log(`[INFO] Đã tìm thấy ${videoSources.length} nguồn video trong trang`);
        // Tạo dữ liệu giả với URL video tìm được
        videoData = {
          aweme_detail: {
            aweme_id: videoId,
            desc: await page.title(),
            video: {
              play_addr: {
                url_list: videoSources
              }
            },
            author: {
              nickname: 'Unknown'
            }
          }
        };
      }
    }
    
    return videoData;
  } catch (error) {
    console.error('[ERROR] Lỗi khi sử dụng puppeteer:', error);
    return null;
  } finally {
    // Đảm bảo đóng trang và browser để giải phóng tài nguyên
    if (page) await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * API endpoint để lấy thông tin video từ URL Douyin
 */
app.post('/api/info', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL không được cung cấp' });
    }
    
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không thể xác định ID video từ URL cung cấp' 
      });
    }
    
    console.log(`[INFO] Đã tìm thấy video ID: ${videoId}`);
    
    // Đi thẳng đến phương pháp hiệu quả
    let videoData = await fetchVideoDataDirectly(videoId);
    
    // Nếu vẫn không thành công, thử phương pháp cuối cùng
    if (!videoData) {
      videoData = await getVideoDataUsingPuppeteer(videoId);
    }
    
    // Kiểm tra dữ liệu và trả về
    if (!videoData || !videoData.aweme_detail) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không thể lấy dữ liệu từ video Douyin. Liên kết có thể không hợp lệ hoặc đã hết hạn.'
      });
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
      
      // Nếu không có URL video hợp lệ, trả về lỗi
      if (!videoUrl) {
        return res.status(404).json({ 
          success: false, 
          message: 'Không thể trích xuất URL video. Video có thể đã bị giới hạn hoặc không có sẵn.'
        });
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ success: false, message: `Lỗi: ${error.message}` });
  }
});

/**
 * API endpoint mới để trả về URL tải xuống trực tiếp
 * Thay thế cho endpoint /api/download cũ
 */
app.post('/api/get-download-url', async (req, res) => {
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
    
    if (type === 'video') {
      // Kiểm tra xem videoUrl có phải là URL thực sự của video không
      if (videoUrl.includes('douyin.com') && !videoUrl.endsWith('.mp4')) {
        // Nếu là URL Douyin, chứ không phải URL trực tiếp đến video, lấy lại thông tin
        console.log('[INFO] videoUrl không phải là URL trực tiếp đến video, đang thử lấy lại...');
        
        // Làm sạch URL và lấy videoId
        const cleanedUrl = cleanUrl(url);
        const videoId = extractVideoId(videoUrl) || extractVideoId(cleanedUrl);
        
        if (!videoId) {
          return res.status(400).json({ 
            success: false, 
            message: 'Không thể xác định ID video từ URL cung cấp' 
          });
        }
        
        // Lấy dữ liệu video trực tiếp
        const videoData = await fetchVideoDataDirectly(videoId) || 
                           await getVideoDataUsingPuppeteer(videoId);
        
        if (!videoData || !videoData.aweme_detail || !videoData.aweme_detail.video) {
          return res.status(404).json({ 
            success: false, 
            message: 'Không thể lấy dữ liệu video. Vui lòng thử lại sau.' 
          });
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
          return res.status(404).json({ 
            success: false, 
            message: 'Không thể tìm thấy URL video hợp lệ.' 
          });
        }
        
        // Cập nhật videoUrl
        console.log(`[INFO] Đã tìm thấy URL video thực: ${actualVideoUrl}`);
        videoUrl = actualVideoUrl;
      }
      
      // Trả về URL video trực tiếp cho frontend
      res.json({
        success: true,
        data: {
          type: 'video',
          url: videoUrl,
          filename: `douyin_video_${uuidv4().slice(0, 8)}.mp4`
        }
      });
    } else {
      // Trả về danh sách URL hình ảnh cho frontend
      res.json({
        success: true,
        data: {
          type: 'images',
          urls: images,
          prefix: `douyin_image_${uuidv4().slice(0, 8)}`
        }
      });
    }
    
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ success: false, message: `Lỗi: ${error.message}` });
  }
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});