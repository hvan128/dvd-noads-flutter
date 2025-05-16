// utils/puppeteerUtils.js - Các hàm liên quan đến puppeteer
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require('@sparticuz/chromium');
const { IS_RENDER_ENVIRONMENT, USER_AGENT } = require('../config/config');

// Sử dụng plugin Stealth để tránh phát hiện bot
puppeteer.use(StealthPlugin());

/**
 * Cấu hình và khởi chạy trình duyệt Puppeteer
 * @returns {Promise<Browser>} Instance của trình duyệt
 */
async function launchBrowser() {
  console.log(`[INFO] Đang chạy trong môi trường: ${IS_RENDER_ENVIRONMENT ? 'Render' : 'Local'}`);
  
  // Cấu hình khởi chạy khác nhau dựa trên môi trường
  const launchOptions = IS_RENDER_ENVIRONMENT
    ? {
        args: [
          ...chromium.args,
          '--disable-dev-shm-usage', // Quan trọng cho Render/cloud environments với limited memory
          '--disable-gpu',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-sandbox',
          '--no-zygote',
          '--single-process', // Giảm tài nguyên
        ],
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        defaultViewport: {
          width: 1280,
          height: 720,
        },
      }
    : {
        headless: "new", // Sử dụng headless "new" thay vì false để tối ưu
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
  
  return await puppeteer.launch(launchOptions);
}

/**
 * Lấy dữ liệu video từ trang video Douyin bằng puppeteer với cơ chế retry
 * @param {string} videoId ID video
 * @returns {Promise<Object|null>} Dữ liệu video hoặc null nếu thất bại
 */
async function getVideoDataUsingPuppeteer(videoId) {
  let browser;
  let retries = 2; // Số lần thử lại
  
  while (retries >= 0) {
    try {
      console.log(`[INFO] Sử dụng puppeteer để lấy dữ liệu video ID: ${videoId}, lần thử: ${2 - retries + 1}`);
      
      browser = await launchBrowser();
      const page = await browser.newPage();
      
      // Tối ưu trang để giảm tài nguyên
      await page.setUserAgent(USER_AGENT);
      
      // Tắt các tính năng không cần thiết để tăng hiệu suất
      await page.setRequestInterception(true);
      
      // Cache để theo dõi loại request đã thấy
      const cache = new Set();
      let videoData = null;
      let dataFound = false;
      
      // Xử lý các request để tối ưu hóa
      page.on('request', request => {
        const url = request.url();
        const resourceType = request.resourceType();
        
        // Nếu đã tìm thấy dữ liệu, chỉ cho phép API requests cần thiết
        if (dataFound) {
          request.abort();
          return;
        }
        
        // Chặn các request không cần thiết để tăng tốc
        if (
          resourceType === 'image' || 
          resourceType === 'stylesheet' || 
          resourceType === 'media' ||
          resourceType === 'font' ||
          url.includes('analytics') ||
          url.includes('log') ||
          url.includes('tracker')
        ) {
          request.abort();
          return;
        }
        
        // Nếu là script hoặc xhr chứa dữ liệu cần thiết
        if ((resourceType === 'script' || resourceType === 'xhr') && (
            url.includes('aweme/v1/web/aweme/detail') ||
            url.includes('aweme/v1/web/detail') ||
            url.includes('/web/api/v2/aweme/iteminfo')
          )) {
          request.continue();
          return;
        }
        
        // Tránh các request trùng lặp
        if (cache.has(url)) {
          request.abort();
          return;
        }
        
        cache.add(url);
        request.continue();
      });
      
      // Giám sát các response để lấy dữ liệu
      page.on('response', async response => {
        if (dataFound) return;
        
        const url = response.url();
        const status = response.status();
        
        // Chỉ quan tâm đến response thành công
        if (status !== 200) return;
        
        // Chỉ kiểm tra các API endpoint có thể chứa dữ liệu video
        if (
          url.includes('aweme/v1/web/aweme/detail') ||
          url.includes('aweme/v1/web/detail') ||
          url.includes('/web/api/v2/aweme/iteminfo')
        ) {
          try {
            const contentType = response.headers()['content-type'] || '';
            // Chỉ phân tích response có content-type JSON hoặc text
            if (!(contentType.includes('json') || contentType.includes('text'))) {
              return;
            }
            
            const text = await response.text();
            if (!text || text.trim() === '') return;
            
            try {
              const responseData = JSON.parse(text);
              if (
                responseData.aweme_detail ||
                (responseData.item_list && responseData.item_list.length > 0)
              ) {
                videoData = responseData;
                dataFound = true;
                console.log('[INFO] Đã bắt được dữ liệu video từ API response');
                
                // Ngắt navigation ngay khi tìm thấy dữ liệu
                try {
                  await page.evaluate(() => window.stop());
                } catch (e) {}
              }
            } catch (jsonError) {
              console.error('[ERROR] Không thể phân tích JSON từ response');
            }
          } catch (error) {
            console.error('[ERROR] Không thể đọc nội dung response');
          }
        }
      });
      
      // Xử lý lỗi console để gỡ lỗi
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
        }
      });

      // Promise race để đảm bảo không bị treo quá lâu
      const navigationPromise = page.goto(
        `https://www.douyin.com/video/${videoId}`, 
        { 
          waitUntil: 'domcontentloaded', 
          timeout: 12000 // Giảm timeout
        }
      );
      
      // Đặt một timeout tổng thể
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Navigation timeout')), 15000)
      );
      
      const dataFoundPromise = new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (dataFound && videoData) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
      });
      
      // Chờ điều kiện đầu tiên thỏa mãn: navigation hoàn thành HOẶC tìm thấy dữ liệu HOẶC timeout
      await Promise.race([navigationPromise, dataFoundPromise, timeoutPromise])
        .catch(err => console.log(`[INFO] Navigation stopped: ${err.message}`));
      
      // Nếu đã tìm thấy dữ liệu, không cần chờ thêm
      if (dataFound && videoData) {
        console.log('[INFO] Đã tìm thấy dữ liệu, kết thúc truy vấn sớm');
        return videoData;
      }
      
      // Chờ thêm một khoảng thời gian ngắn để đảm bảo nhận được dữ liệu
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Nếu tìm thấy dữ liệu sau khi chờ
      if (videoData) {
        return videoData;
      }
      
      // Thử một phương pháp khác - trích xuất dữ liệu từ render data trong HTML
      try {
        const renderData = await page.evaluate(() => {
          try {
            for (const script of document.querySelectorAll('script')) {
              if (script.textContent.includes('__RENDER_DATA__')) {
                const match = script.textContent.match(/window\.__RENDER_DATA__\s*=\s*([^<]+)(<\/script>|;)/);
                if (match && match[1]) {
                  return match[1];
                }
              }
            }
            return null;
          } catch (e) {
            return null;
          }
        });
        
        if (renderData) {
          try {
            const decodedData = decodeURIComponent(renderData);
            const jsonData = JSON.parse(decodedData);
            
            // Tìm dữ liệu video trong cấu trúc
            const findAwemeDetail = (obj) => {
              if (!obj || typeof obj !== 'object') return null;
              
              if (obj.aweme_detail) return { aweme_detail: obj.aweme_detail };
              if (obj.aweme && obj.aweme.detail) return { aweme_detail: obj.aweme.detail };
              if (obj.aweme_list && obj.aweme_list.length > 0) return { aweme_detail: obj.aweme_list[0] };
              
              for (const key in obj) {
                const result = findAwemeDetail(obj[key]);
                if (result) return result;
              }
              
              return null;
            };
            
            const foundData = findAwemeDetail(jsonData);
            if (foundData) {
              console.log('[INFO] Đã tìm thấy dữ liệu video trong RENDER_DATA');
              return foundData;
            }
          } catch (e) {
            console.error('[ERROR] Không thể phân tích dữ liệu RENDER_DATA:', e.message);
          }
        }
      } catch (e) {
        console.error('[ERROR] Lỗi khi trích xuất RENDER_DATA:', e.message);
      }
      
      // Nếu vẫn không thành công, giảm số lần retry và thử lại
      retries--;
      
      // Đóng trang và trình duyệt trước khi thử lại
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
      browser = null;
      
    } catch (error) {
      console.error('[ERROR] Lỗi khi sử dụng puppeteer:', error.message);
      retries--;
      
      // Đảm bảo trình duyệt được đóng trước khi thử lại
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }
    }
  }
  
  // Nếu đã hết số lần thử, trả về null
  console.error('[ERROR] Đã hết số lần thử lấy dữ liệu video');
  return null;
}

module.exports = {
  getVideoDataUsingPuppeteer
};