/**
 * Utilities for browser interactions using Puppeteer
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Sử dụng plugin Stealth để tránh phát hiện bot
puppeteer.use(StealthPlugin());

/**
 * Tạo và trả về một instance trình duyệt Puppeteer với cấu hình stealth
 * @returns {Promise<Browser>} Instance trình duyệt
 */
async function createBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}

/**
 * Tạo trang mới trong trình duyệt và cấu hình User-Agent
 * @param {Browser} browser Instance trình duyệt
 * @returns {Promise<Page>} Trang trình duyệt
 */
async function createPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  return page;
}

/**
 * Theo dõi các request và response trong trang
 * @param {Page} page Trang trình duyệt
 * @param {Function} onResponse Callback khi nhận response
 */
async function setupNetworkInterceptors(page, onResponse) {
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    request.continue();
  });
  
  if (onResponse) {
    page.on('response', onResponse);
  }
}

/**
 * Truy cập URL và chờ trang tải xong
 * @param {Page} page Trang trình duyệt
 * @param {string} url URL cần truy cập
 * @param {number} waitTime Thời gian chờ thêm sau khi trang tải xong (ms)
 * @returns {Promise<string>} URL hiện tại sau khi chuyển hướng
 */
async function navigateToUrl(page, url, waitTime = 5000) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log(`[INFO] Đã truy cập URL: ${url}`);
  
  // Chờ thêm thời gian để JS thực thi và API load
  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  return page.url();
}

/**
 * Trích xuất dữ liệu video từ các phần tử trong trang
 * @param {Page} page Trang trình duyệt
 * @returns {Promise<Array<string>>} Mảng các URL video
 */
async function extractVideoSourcesFromPage(page) {
  return await page.evaluate(() => {
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
}

/**
 * Trích xuất tiêu đề trang
 * @param {Page} page Trang trình duyệt
 * @returns {Promise<string>} Tiêu đề trang
 */
async function getPageTitle(page) {
  return await page.title();
}

module.exports = {
  createBrowser,
  createPage,
  setupNetworkInterceptors,
  navigateToUrl,
  extractVideoSourcesFromPage,
  getPageTitle
};