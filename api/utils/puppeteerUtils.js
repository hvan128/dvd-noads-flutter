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
  const launchOptions = IS_RENDER_ENVIRONMENT ? {
    args: [
      ...chromium.args,
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials'
    ],
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: null,
    timeout: 30000,
  } : {
    headless: 'new', // Sử dụng headless mới để tăng hiệu suất
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials'
    ],
    defaultViewport: null,
    timeout: 30000,
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
    await page.setUserAgent(USER_AGENT);
    console.log(`[INFO] Đã thiết lập User-Agent: ${USER_AGENT}`);
    
    // Thiết lập timeout dài hơn cho việc chờ các request network
    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);
    
    let videoData = null;
    let dataPromise = new Promise((resolve) => {
      // Thiết lập timeout toàn cầu cho việc lấy dữ liệu
      const timeoutId = setTimeout(() => {
        console.log('[WARN] Timeout khi chờ dữ liệu API, đang tiếp tục xử lý...');
        resolve(null);
      }, 25000);
      
      page.on('response', async response => {
        const url = response.url();
        
        // Kiểm tra các API endpoint khác nhau có thể chứa dữ liệu video
        if (
          url.includes('aweme/v1/web/aweme/detail') || 
          url.includes('aweme/v1/web/detail') || 
          url.includes('/web/api/v2/aweme/iteminfo')
        ) {
          try {
            const contentType = response.headers()['content-type'] || '';
            console.log(`[INFO] Đã bắt được response API: ${url} (${contentType})`);
            
            if (contentType.includes('application/json') || contentType.includes('text/plain')) {
              const text = await response.text().catch(e => {
                console.error('[ERROR] Không thể lấy text từ response:', e.message);
                return '';
              });
              
              if (text && text.trim() !== '') {
                try {
                  const responseData = JSON.parse(text);
                  if (
                    responseData.aweme_detail || 
                    (responseData.item_list && responseData.item_list.length > 0)
                  ) {
                    console.log('[SUCCESS] Đã bắt được dữ liệu video từ API response');
                    videoData = responseData;
                    clearTimeout(timeoutId);
                    resolve(responseData);
                  } else {
                    console.log('[INFO] Response không chứa dữ liệu video cần thiết');
                  }
                } catch (jsonError) {
                  console.error('[ERROR] Không thể phân tích JSON từ response:', jsonError.message);
                }
              }
            }
          } catch (error) {
            console.error('[ERROR] Lỗi khi xử lý response:', error.message);
          }
        }
      });
    });
    
    // Console log cho mục đích debug
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
    
    const videoUrl = `https://www.douyin.com/video/${videoId}`;
    console.log(`[INFO] Đang truy cập trang video: ${videoUrl}`);
    
    // Theo dõi request network
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.resourceType() === 'document' || request.resourceType() === 'xhr') {
        console.log(`[Network] ${request.method()} ${request.url().slice(0, 100)}...`);
      }
      request.continue();
    });
    
    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 20000 }).catch(e => {
      console.log(`[WARN] Navigation timeout: ${e.message}, nhưng tiếp tục xử lý...`);
    });
    
    console.log('[INFO] Đang chờ dữ liệu từ API response...');
    
    // Thử tương tác với trang để kích hoạt API calls
    await page.evaluate(() => {
      window.scrollBy(0, 300);
    }).catch(e => console.error('[ERROR] Không thể scroll trang:', e.message));
    
    // Chờ dữ liệu với timeout
    const result = await Promise.race([
      dataPromise,
      new Promise(resolve => setTimeout(() => {
        console.log('[INFO] Chờ thêm để đảm bảo tất cả network requests hoàn thành');
        resolve(videoData);
      }, 8000))
    ]);
    
    if (result) {
      return result;
    }
    
    if (videoData) {
      return videoData;
    }
    
    // Fallback: Thử lấy dữ liệu từ window.__INITIAL_STATE__
    console.log('[INFO] Thử phương án dự phòng: lấy dữ liệu từ window.__INITIAL_STATE__');
    const initialState = await page.evaluate(() => {
      try {
        if (window.__INITIAL_STATE__) {
          return JSON.stringify(window.__INITIAL_STATE__);
        }
        return null;
      } catch (e) {
        console.error('Error extracting window.__INITIAL_STATE__:', e);
        return null;
      }
    }).catch(e => {
      console.error('[ERROR] Không thể lấy window.__INITIAL_STATE__:', e.message);
      return null;
    });
    
    if (initialState) {
      try {
        const stateData = JSON.parse(initialState);
        // Tìm dữ liệu video trong state
        if (stateData.aweme && stateData.aweme.detail) {
          console.log('[SUCCESS] Đã lấy được dữ liệu video từ window.__INITIAL_STATE__');
          return stateData.aweme.detail;
        }
      } catch (e) {
        console.error('[ERROR] Không thể phân tích dữ liệu từ window.__INITIAL_STATE__:', e.message);
      }
    }
    
    console.log('[WARN] Không thể lấy dữ liệu video sau khi thử tất cả phương án');
    return null;
    
  } catch (error) {
    console.error('[ERROR] Lỗi khi sử dụng puppeteer:', error.message);
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('[INFO] Đã đóng trình duyệt');
      } catch (e) {
        console.error('[ERROR] Không thể đóng trình duyệt:', e.message);
      }
    }
  }
}

module.exports = {
  getVideoDataUsingPuppeteer,
  launchBrowser,
};