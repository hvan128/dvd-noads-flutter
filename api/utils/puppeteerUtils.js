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
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport || null,
      }
    : {
        headless: false, // bạn có thể bật headless nếu thích
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

    let videoData = null;
    let dataFound = false;

    await page.setRequestInterception(true);

    page.on('request', request => {
      if (dataFound) {
        request.abort();
      } else {
        request.continue();
      }
    });

    page.on('response', async response => {
      if (dataFound) return;

      const url = response.url();

      if (
        url.includes('aweme/v1/web/aweme/detail') ||
        url.includes('aweme/v1/web/detail') ||
        url.includes('/web/api/v2/aweme/iteminfo')
      ) {
        try {
          const text = await response.text();
          if (text && text.trim() !== '') {
            try {
              const responseData = JSON.parse(text);
              if (
                responseData.aweme_detail ||
                (responseData.item_list && responseData.item_list.length > 0)
              ) {
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

    const videoUrl = `https://www.douyin.com/video/${videoId}`;
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log(`[INFO] Đã truy cập trang video: ${videoUrl}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    return videoData;
  } catch (error) {
    console.error('[ERROR] Lỗi khi sử dụng puppeteer:', error);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = {
  getVideoDataUsingPuppeteer
};
