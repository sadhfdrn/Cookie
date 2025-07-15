// api/cookies.js
const express = require('express');
const puppeteer = require('puppeteer');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for cookie API
const cookieLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    error: 'Too many cookie requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});

router.use(cookieLimiter);

class CookieCollectorService {
  constructor() {
    this.browser = null;
    this.cookies = {
      animepahe: null,
      paheWin: null,
      kiwik: null,
      lastUpdated: null
    };
    this.isCollecting = false;
    this.collectionInterval = null;
  }

  async init() {
    try {
      const executablePath = process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome';
      
      this.browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--window-size=1920,1080',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
      
      console.log('🍪 Cookie service browser initialized successfully');
      
      // Collect cookies immediately on startup
      await this.collectAllCookies();
      
      // Set up automatic collection every 30 minutes
      this.collectionInterval = setInterval(async () => {
        await this.collectAllCookies();
      }, 30 * 60 * 1000);
      
    } catch (error) {
      console.error('❌ Failed to initialize cookie service browser:', error);
      throw error;
    }
  }

  async visitAnimepahe() {
    const page = await this.browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('📱 Visiting animepahe.com...');
      await page.goto('https://animepahe.com', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const title = await page.title();
      if (title.includes('Just a moment') || title.includes('Cloudflare')) {
        console.log('⏳ Waiting for Cloudflare challenge...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      const cookies = await page.cookies();
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      
      console.log(`✅ Animepahe cookies collected: ${cookies.length} cookies`);
      return cookieString;
      
    } catch (error) {
      console.error('❌ Error visiting animepahe:', error);
      return null;
    } finally {
      await page.close();
    }
  }

  async visitPaheWin() {
    const page = await this.browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('📱 Visiting pahe.win...');
      await page.goto('https://pahe.win', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const title = await page.title();
      if (title.includes('Just a moment') || title.includes('Cloudflare')) {
        console.log('⏳ Waiting for Cloudflare challenge...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      const cookies = await page.cookies();
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      
      console.log(`✅ Pahe.win cookies collected: ${cookies.length} cookies`);
      return cookieString;
      
    } catch (error) {
      console.error('❌ Error visiting pahe.win:', error);
      return null;
    } finally {
      await page.close();
    }
  }

  async visitKiwik() {
    const page = await this.browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('📱 Visiting kwik.si...');
      await page.goto('https://kwik.si', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const title = await page.title();
      if (title.includes('Just a moment') || title.includes('Cloudflare')) {
        console.log('⏳ Waiting for Cloudflare challenge...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      const cookies = await page.cookies();
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      
      console.log(`✅ Kiwik cookies collected: ${cookies.length} cookies`);
      return cookieString;
      
    } catch (error) {
      console.error('❌ Error visiting kiwik:', error);
      return null;
    } finally {
      await page.close();
    }
  }

  async visitCustomUrl(url, options = {}) {
    const page = await this.browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log(`📱 Visiting ${url}...`);
      
      if (options.headers) {
        await page.setExtraHTTPHeaders(options.headers);
      }
      
      if (options.viewport) {
        await page.setViewport(options.viewport);
      }
      
      await page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: options.timeout || 60000
      });
      
      await new Promise(resolve => setTimeout(resolve, options.initialWait || 5000));
      
      const title = await page.title();
      if (title.includes('Just a moment') || title.includes('Cloudflare')) {
        console.log('⏳ Waiting for Cloudflare challenge...');
        await new Promise(resolve => setTimeout(resolve, options.cloudflareWait || 10000));
      }
      
      if (options.additionalWait) {
        await new Promise(resolve => setTimeout(resolve, options.additionalWait));
      }
      
      if (options.executeScript) {
        await page.evaluate(options.executeScript);
      }
      
      const cookies = await page.cookies();
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      
      console.log(`✅ ${url} cookies collected: ${cookies.length} cookies`);
      return {
        success: true,
        cookies: cookieString,
        cookieCount: cookies.length,
        url: url,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error visiting ${url}:`, error);
      return {
        success: false,
        error: error.message,
        url: url,
        timestamp: new Date().toISOString()
      };
    } finally {
      await page.close();
    }
  }

  async collectAllCookies() {
    if (this.isCollecting) {
      console.log('🔄 Collection already in progress, skipping...');
      return;
    }

    this.isCollecting = true;
    console.log('🚀 Starting cookie collection cycle...');
    
    try {
      const results = await Promise.allSettled([
        this.visitAnimepahe(),
        this.visitPaheWin(),
        this.visitKiwik()
      ]);

      const [animepaheResult, paheWinResult, kiwikResult] = results;
      
      if (animepaheResult.status === 'fulfilled' && animepaheResult.value) {
        this.cookies.animepahe = animepaheResult.value;
      }
      if (paheWinResult.status === 'fulfilled' && paheWinResult.value) {
        this.cookies.paheWin = paheWinResult.value;
      }
      if (kiwikResult.status === 'fulfilled' && kiwikResult.value) {
        this.cookies.kiwik = kiwikResult.value;
      }

      this.cookies.lastUpdated = new Date().toISOString();
      console.log('✅ Cookie collection cycle completed successfully');
      
    } catch (error) {
      console.error('❌ Error during cookie collection:', error);
    } finally {
      this.isCollecting = false;
    }
  }

  getCookies() {
    return this.cookies;
  }

  async destroy() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Initialize the service
const cookieService = new CookieCollectorService();

// Helper function to validate URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Routes
router.get('/', (req, res) => {
  try {
    const cookies = cookieService.getCookies();
    
    if (!cookies.lastUpdated) {
      return res.status(503).json({ 
        error: 'Cookies not yet collected. Please try again in a few moments.',
        status: 'collecting'
      });
    }
    
    res.json({
      success: true,
      cookies: {
        animepahe: cookies.animepahe,
        pahewin: cookies.paheWin,
        kiwik: cookies.kiwik
      },
      lastUpdated: cookies.lastUpdated
    });
    
  } catch (error) {
    console.error('❌ Error serving cookies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/create', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
    }
    
    if (cookieService.isCollecting) {
      return res.status(429).json({ error: 'Service is busy, please try again later' });
    }
    
    // Validate options
    const validOptions = {};
    if (options.timeout && typeof options.timeout === 'number' && options.timeout > 0 && options.timeout <= 120000) {
      validOptions.timeout = options.timeout;
    }
    if (options.waitUntil && ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'].includes(options.waitUntil)) {
      validOptions.waitUntil = options.waitUntil;
    }
    if (options.initialWait && typeof options.initialWait === 'number' && options.initialWait >= 0 && options.initialWait <= 30000) {
      validOptions.initialWait = options.initialWait;
    }
    if (options.cloudflareWait && typeof options.cloudflareWait === 'number' && options.cloudflareWait >= 0 && options.cloudflareWait <= 60000) {
      validOptions.cloudflareWait = options.cloudflareWait;
    }
    if (options.additionalWait && typeof options.additionalWait === 'number' && options.additionalWait >= 0 && options.additionalWait <= 30000) {
      validOptions.additionalWait = options.additionalWait;
    }
    if (options.headers && typeof options.headers === 'object') {
      validOptions.headers = options.headers;
    }
    if (options.viewport && typeof options.viewport === 'object') {
      validOptions.viewport = options.viewport;
    }
    
    console.log(`🔧 Creating cookies for custom URL: ${url}`);
    const result = await cookieService.visitCustomUrl(url, validOptions);
    
    if (result.success) {
      res.json({
        success: true,
        cookies: result.cookies,
        cookieCount: result.cookieCount,
        url: result.url,
        timestamp: result.timestamp
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        url: result.url,
        timestamp: result.timestamp
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating cookies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    if (cookieService.isCollecting) {
      return res.status(429).json({ error: 'Collection already in progress' });
    }
    
    cookieService.collectAllCookies();
    
    res.json({ 
      success: true, 
      message: 'Cookie refresh triggered',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error refreshing cookies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', (req, res) => {
  const cookies = cookieService.getCookies();
  
  res.json({
    isCollecting: cookieService.isCollecting,
    lastUpdated: cookies.lastUpdated,
    hasCookies: {
      animepahe: !!cookies.animepahe,
      paheWin: !!cookies.paheWin,
      kiwik: !!cookies.kiwik
    },
    nextCollection: cookies.lastUpdated ? 
      new Date(new Date(cookies.lastUpdated).getTime() + 30 * 60 * 1000).toISOString() : 
      'unknown'
  });
});

// Initialize cookie service
cookieService.init().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Cookie service shutting down...');
  await cookieService.destroy();
});

process.on('SIGINT', async () => {
  console.log('🛑 Cookie service shutting down...');
  await cookieService.destroy();
});

module.exports = router;