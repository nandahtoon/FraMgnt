const https = require('https');
const { chromium } = require('playwright');

async function testNodeHttps() {
  console.log('Testing Node https GET to kroger.com...');
  return new Promise((resolve) => {
    const req = https.get('https://www.kroger.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      console.log(`Node https response status: ${res.statusCode}`);
      resolve(res.statusCode);
    });

    req.on('error', (err) => {
      console.log(`Node https error: ${err.message}`);
      resolve(null);
    });
  });
}

async function testPlaywrightNoFlags() {
  console.log('Testing Playwright without --disable-http2...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    const res = await page.goto('https://www.kroger.com/', { waitUntil: 'commit', timeout: 15000 });
    console.log(`Playwright status: ${res ? res.status() : 'null'}`);
    const title = await page.title();
    console.log(`Playwright page title: ${title}`);
  } catch (err) {
    console.log(`Playwright error: ${err.message}`);
  } finally {
    await browser.close();
  }
}

(async () => {
  await testNodeHttps();
  await testPlaywrightNoFlags();
})();
