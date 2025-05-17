   // utils/puppeteerUtils.js - Các hàm liên quan đến puppeteer
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { IS_RENDER_ENVIRONMENT, PUPPETEER_EXECUTABLE_PATH, USER_AGENT } = require('../config/config');

// Sử dụng plugin Stealth để tránh phát hiện bot
puppeteer.use(StealthPlugin());

/**
 * Cấu hình và khởi chạy trình duyệt Puppeteer
 * @returns {Promise<Browser>} Instance của trình duyệt
 */
async function launchBrowser() {
  console.log(`[INFO] Đang chạy trong môi trường: ${IS_RENDER_ENVIRONMENT ? 'Render' : 'Local'}`);
  
  const launchOptions = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    headless: 'new'
  };
  
  return await puppeteer.launch(launchOptions);
}

/**
 * Lấy dữ liệu video từ trang video Douyin bằng puppeteer
 * @param {string} videoId ID video
 * @returns {Promise<Object|null>} Dữ liệu video hoặc null nếu thất bại
 */
async function getVideoDataUsingPuppeteer(videoId) {
  let browser;
  try {
    console.log(`[INFO] Sử dụng puppeteer để lấy dữ liệu video ID: ${videoId}`);
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Đặt User-Agent
    await page.setUserAgent(USER_AGENT);
    
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
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return videoData;
  } catch (error) {
    console.error('[ERROR] Lỗi khi sử dụng puppeteer:', error);
    return null;
  } finally {
    // Đảm bảo đóng browser để giải phóng tài nguyên
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = {
  getVideoDataUsingPuppeteer
};