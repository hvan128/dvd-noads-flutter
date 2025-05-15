// server.js - File chính của API NodeJS
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');

// Sử dụng plugin Stealth để tránh phát hiện bot
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

// Đảm bảo thư mục tải xuống tồn tại
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/downloads', express.static(DOWNLOAD_DIR));

/**
 * Làm sạch URL Douyin từ chuỗi đầu vào
 * @param {string} url URL đầu vào từ người dùng
 * @returns {string} URL Douyin đã làm sạch
 */
function cleanUrl(url) {
  // Tìm URL Douyin trong chuỗi đầu vào
  const douyinUrlMatch = url.match(/https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+/);
  if (douyinUrlMatch) {
    return douyinUrlMatch[0];
  }
  
  // Nếu đã là URL đầy đủ của Douyin
  if (url.startsWith('https://www.douyin.com/')) {
    return url;
  }
  
  return url; // Trả về URL gốc nếu không tìm thấy mẫu nào
}

/**
 * Trích xuất ID video từ URL Douyin
 * @param {string} url URL Douyin
 * @returns {string|null} ID video hoặc null nếu không tìm thấy
 */
function extractVideoId(url) {
  // Mẫu cho URL dạng /video/{id} hoặc /note/{id}
  const videoPattern = url.match(/\/(?:video|note)\/(\d+)/);
  if (videoPattern) {
    return videoPattern[1];
  }
  
  // Mẫu cho tham số aweme_id trong URL
  const awemePattern = url.match(/aweme_id=(\d+)/);
  if (awemePattern) {
    return awemePattern[1];
  }
  
  // Mẫu cho tham số vid trong URL
  const vidPattern = url.match(/vid=(\d+)/);
  if (vidPattern) {
    return vidPattern[1];
  }
  
  return null;
}

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
 * @returns {Promise<void>}
 */
async function downloadAndZipImages(imageUrls, outputPath) {
  const tempDir = path.join(DOWNLOAD_DIR, 'temp_' + uuidv4());
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
    
    const response = await axios.get(apiUrl, { headers });
    
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
 * Tạo token ngẫu nhiên cho API Douyin
 * @returns {string} Token ngẫu nhiên
 */
function generateRandomMSToken() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 107; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
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
  
  try {
    console.log(`[INFO] Sử dụng puppeteer để lấy dữ liệu video ID: ${videoId}`);
    
    const page = await browser.newPage();
    
    // Đặt User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Biến để lưu trữ dữ liệu từ API
    let videoData = null;
    
    // Chặn response từ API chi tiết video
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      request.continue();
    });
    
    // Chặn tất cả các response để tìm dữ liệu video
    page.on('response', async response => {
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
      
      // Tìm script chứa dữ liệu video nhúng
      if (url.includes('.douyin.com') && response.headers()['content-type']?.includes('text/html')) {
        try {
          const html = await response.text();
          // Tìm kiếm dữ liệu video nhúng trong script tags
          const renderDataMatch = html.match(/window\.__RENDER_DATA__\s*=\s*([^<]+)(<\/script>|;)/);
          if (renderDataMatch && renderDataMatch[1]) {
            try {
              const decodedData = decodeURIComponent(renderDataMatch[1]);
              const jsonData = JSON.parse(decodedData);
              
              // Tìm dữ liệu video trong cấu trúc phức tạp
              let foundData = null;
              const searchForVideoData = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                
                if (obj.aweme_detail || 
                   (obj.aweme && obj.aweme.detail) ||
                   (obj.aweme_list && obj.aweme_list.length > 0)) {
                  foundData = obj;
                  return;
                }
                
                for (const key in obj) {
                  searchForVideoData(obj[key]);
                  if (foundData) break;
                }
              };
              
              searchForVideoData(jsonData);
              
              if (foundData) {
                console.log('[INFO] Đã tìm thấy dữ liệu video trong RENDER_DATA');
                if (foundData.aweme_detail) {
                  videoData = { aweme_detail: foundData.aweme_detail };
                } else if (foundData.aweme && foundData.aweme.detail) {
                  videoData = { aweme_detail: foundData.aweme.detail };
                } else if (foundData.aweme_list && foundData.aweme_list.length > 0) {
                  videoData = { aweme_detail: foundData.aweme_list[0] };
                }
              }
            } catch (jsonError) {
              console.error('[ERROR] Không thể phân tích dữ liệu RENDER_DATA:', jsonError);
            }
          }
        } catch (error) {
          console.error('[ERROR] Không thể đọc HTML để tìm dữ liệu nhúng:', error);
        }
      }
    });
    
    // Truy cập trang video
    const videoUrl = `https://www.douyin.com/video/${videoId}`;
    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log(`[INFO] Đã truy cập trang video: ${videoUrl}`);
    
    // Chờ thêm thời gian để tất cả API có thể load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Trích xuất video URLs từ thẻ video trong trang
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
    await browser.close();
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
    console.log(`[INFO] Đang truy cập URL đã làm sạch: ${cleanedUrl}`);
    
    // Khởi tạo trình duyệt
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Đặt User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Biến để lưu trữ dữ liệu từ API
    let videoData = null;
    
    // Chặn response từ API chi tiết video
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      request.continue();
    });
    
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('aweme/v1/web/aweme/detail')) {
        try {
          // Thêm kiểm tra nội dung trước khi phân tích JSON
          const text = await response.text();
          if (text && text.trim() !== '') {
            try {
              const responseData = JSON.parse(text);
              if (responseData && responseData.aweme_detail) {
                videoData = responseData;
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
    
    // Truy cập URL
    await page.goto(cleanedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Chờ xử lý JavaScript
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Xử lý chuyển hướng nếu cần
    const currentUrl = page.url();
    console.log(`[INFO] URL sau khi chuyển hướng: ${currentUrl}`);
    
    // Đóng trình duyệt ban đầu để giải phóng tài nguyên
    await browser.close();
    
    // Tìm ID video từ URL
    const videoId = extractVideoId(currentUrl);
    
    // Nếu không nhận được dữ liệu từ API, thử các phương pháp khác
    if (!videoData && videoId) {
      console.log('[INFO] Không nhận được dữ liệu từ API, đang thử phương pháp thay thế...');
      console.log(`[INFO] Đã tìm thấy video ID: ${videoId}`);
      
      // Phương pháp 1: Truy vấn API trực tiếp
      videoData = await fetchVideoDataDirectly(videoId);
      
      // Phương pháp 2: Sử dụng puppeteer để lấy dữ liệu từ trang video chính
      if (!videoData) {
        videoData = await getVideoDataUsingPuppeteer(videoId);
      }
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
      if (!videoUrl || videoUrl === currentUrl) {
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
 * API endpoint để tải video xuống
 */
app.post('/api/download', async (req, res) => {
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
      
      // Tải video
      filePath = path.join(DOWNLOAD_DIR, `${fileId}.mp4`);
      await downloadFile(videoUrl, filePath);
      downloadUrl = `/downloads/${fileId}.mp4`;
    } else {
      // Tải và nén hình ảnh
      filePath = path.join(DOWNLOAD_DIR, `${fileId}.zip`);
      await downloadAndZipImages(images, filePath);
      downloadUrl = `/downloads/${fileId}.zip`;
    }
    
    res.json({
      success: true,
      data: {
        downloadUrl,
        expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Hết hạn sau 24 giờ
      }
    });
    
    // Xóa file sau 24 giờ
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[INFO] Đã xóa file: ${filePath}`);
      }
    }, 24 * 60 * 60 * 1000);
    
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ success: false, message: `Lỗi: ${error.message}` });
  }
});

/**
 * API endpoint để dọn dẹp file tạm
 */
app.get('/api/cleanup', (req, res) => {
  try {
    // Đọc danh sách file trong thư mục downloads
    const files = fs.readdirSync(DOWNLOAD_DIR);
    
    let deleteCount = 0;
    files.forEach(file => {
      const filePath = path.join(DOWNLOAD_DIR, file);
      const stats = fs.statSync(filePath);
      const fileAge = Date.now() - stats.mtimeMs;
      
      // Xóa các file cũ hơn 24 giờ
      if (fileAge > 24 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        deleteCount++;
      }
    });
    
    res.json({
      success: true,
      message: `Đã dọn dẹp ${deleteCount} file`
    });
    
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ success: false, message: `Lỗi: ${error.message}` });
  }
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});