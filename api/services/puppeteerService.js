/**
 * puppeteerService.js - Service for browser automation and scraping Douyin video data
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const urlUtils = require('../utils/urlUtils');

// Use Stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// Cache for storing redirected URLs
const urlCache = new Map();

/**
 * Generate a random MS Token for Douyin API
 * @returns {string} Random MS Token
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
 * Get the redirected URL for a Douyin short URL
 * @param {string} url - Original Douyin URL
 * @returns {string} Redirected URL or original URL if no redirection
 */
exports.getRedirectedUrl = (url) => {
  // Check cache first
  if (urlCache.has(url)) {
    return urlCache.get(url);
  }
  
  // If no cached value, return the original URL
  // The actual redirection will happen during scraping
  return url;
};

/**
 * Directly query Douyin API for video information
 * @param {string} videoId - Douyin video ID
 * @returns {Promise<Object|null>} Video data or null if failed
 */
exports.fetchVideoDataDirectly = async (videoId) => {
  try {
    console.log(`[INFO] Directly querying API for video ID: ${videoId}`);
    
    // Create headers that resemble a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.douyin.com/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': 'douyin.com; ttwid=1%7C3YKRuDjD_yHY9DkvHbJOXZXk8OfHV9Mp5jNYF3EYNA8%7C1677649113%7C99ce39ceecd30164c9d26c33fa53524d6b6f735c455d4ae97708d87c43d416a7'
    };
    
    // Video details API URL
    const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${videoId}&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=en-US&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=50&webid=7129360599857284651&msToken=${generateRandomMSToken()}`;
    
    const response = await axios.get(apiUrl, { headers });
    
    if (response.data && response.data.aweme_detail) {
      return response.data;
    }
    
    // Try alternative API endpoint if first one fails
    const alternativeApiUrl = `https://www.douyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}`;
    const alternativeResponse = await axios.get(alternativeApiUrl, { headers });
    
    if (alternativeResponse.data && alternativeResponse.data.item_list && alternativeResponse.data.item_list.length > 0) {
      // Transform response to match expected format
      return {
        aweme_detail: alternativeResponse.data.item_list[0]
      };
    }
    
    return null;
  } catch (error) {
    console.error('[ERROR] Error when directly querying API:', error.message);
    return null;
  }
};

/**
 * Get video data from Douyin video page using puppeteer
 * @param {string} videoId - Video ID
 * @returns {Promise<Object|null>} Video data or null if failed
 */
exports.getVideoDataUsingPuppeteer = async (videoId) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    console.log(`[INFO] Using puppeteer to get data for video ID: ${videoId}`);
    
    const page = await browser.newPage();
    
    // Set User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Variable to store API data
    let videoData = null;
    
    // Intercept responses
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      request.continue();
    });
    
    // Intercept all responses to find video data
    page.on('response', async response => {
      const url = response.url();
      
      // Check multiple API endpoints that might contain video data
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
                
                // Transform data to match expected format if needed
                if (responseData.item_list && !responseData.aweme_detail) {
                  videoData = {
                    aweme_detail: responseData.item_list[0]
                  };
                } else {
                  videoData = responseData;
                }
                
                console.log('[INFO] Successfully captured video data from API response');
              }
            } catch (jsonError) {
              console.error('[ERROR] Could not parse JSON from response:', jsonError);
            }
          }
        } catch (error) {
          console.error('[ERROR] Could not read response content:', error);
        }
      }
      
      // Look for embedded video data in script tags
      if (url.includes('.douyin.com') && response.headers()['content-type']?.includes('text/html')) {
        try {
          const html = await response.text();
          // Search for embedded video data in script tags
          const renderDataMatch = html.match(/window\.__RENDER_DATA__\s*=\s*([^<]+)(<\/script>|;)/);
          if (renderDataMatch && renderDataMatch[1]) {
            try {
              const decodedData = decodeURIComponent(renderDataMatch[1]);
              const jsonData = JSON.parse(decodedData);
              
              // Search for video data in complex structure
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
                console.log('[INFO] Found video data in RENDER_DATA');
                if (foundData.aweme_detail) {
                  videoData = { aweme_detail: foundData.aweme_detail };
                } else if (foundData.aweme && foundData.aweme.detail) {
                  videoData = { aweme_detail: foundData.aweme.detail };
                } else if (foundData.aweme_list && foundData.aweme_list.length > 0) {
                  videoData = { aweme_detail: foundData.aweme_list[0] };
                }
              }
            } catch (jsonError) {
              console.error('[ERROR] Could not parse RENDER_DATA:', jsonError);
            }
          }
        } catch (error) {
          console.error('[ERROR] Could not read HTML to find embedded data:', error);
        }
      }
    });
    
    // Access video page
    const videoUrl = `https://www.douyin.com/video/${videoId}`;
    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log(`[INFO] Accessed video page: ${videoUrl}`);
    
    // Wait additional time for all APIs to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract video URLs from video tags in the page
    if (!videoData || !videoData.aweme_detail || !videoData.aweme_detail.video) {
      console.log('[INFO] Trying to extract video URL from page elements...');
      
      const videoSources = await page.evaluate(() => {
        const results = [];
        // Find all video tags
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach(video => {
          if (video.src) results.push(video.src);
          
          // Check source tags inside video
          const sources = video.querySelectorAll('source');
          sources.forEach(source => {
            if (source.src) results.push(source.src);
          });
        });
        
        // Find additional data in data attributes
        const elements = document.querySelectorAll('[data-src]');
        elements.forEach(el => {
          if (el.dataset.src) results.push(el.dataset.src);
        });
        
        return results;
      });
      
      if (videoSources.length > 0) {
        console.log(`[INFO] Found ${videoSources.length} video sources in page`);
        // Create mock data with found video URLs
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
    console.error('[ERROR] Error when using puppeteer:', error);
    return null;
  } finally {
    await browser.close();
  }
};

/**
 * Scrape video data from a Douyin URL
 * @param {string} url - Douyin URL
 * @returns {Promise<Object|null>} Video data or null if failed
 */
exports.scrapeVideoData = async (url) => {
  try {
    // Clean input URL
    const cleanedUrl = urlUtils.cleanUrl(url);
    console.log(`[INFO] Accessing cleaned URL: ${cleanedUrl}`);
    
    // Initialize browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Variable to store API data
    let videoData = null;
    
    // Intercept responses from video detail API
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      request.continue();
    });
    
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('aweme/v1/web/aweme/detail')) {
        try {
          // Add content check before parsing JSON
          const text = await response.text();
          if (text && text.trim() !== '') {
            try {
              const responseData = JSON.parse(text);
              if (responseData && responseData.aweme_detail) {
                videoData = responseData;
              }
            } catch (jsonError) {
              console.error('[ERROR] Could not parse JSON from response:', jsonError);
            }
          }
        } catch (error) {
          console.error('[ERROR] Could not read response content:', error);
        }
      }
    });
    
    // Access URL
    await page.goto(cleanedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for JavaScript processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Handle redirection if needed
    const currentUrl = page.url();
    console.log(`[INFO] URL after redirection: ${currentUrl}`);
    
    // Store the redirected URL in cache
    urlCache.set(url, currentUrl);
    
    // Close the initial browser to free resources
    await browser.close();
    
    return videoData;
  } catch (error) {
    console.error('[ERROR]', error);
    return null;
  }
};