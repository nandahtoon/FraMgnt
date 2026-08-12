const { chromium } = require('playwright');

(async () => {
  console.log('Testing Kroger navigation...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-http2', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('purchase') || url.includes('receipt') || url.includes('order') || url.includes('graphql') || url.includes('api')) {
      console.log(`[API Intercept] ${res.status()} ${url}`);
    }
  });

  try {
    console.log('1. Navigating to main site...');
    await page.goto('https://www.kroger.com/', { waitUntil: 'commit', timeout: 30000 });
    console.log('   Main site committed. Waiting 3s...');
    await page.waitForTimeout(3000);

    console.log('2. Navigating to mypurchases...');
    await page.goto('https://www.kroger.com/mypurchases?page=1&tab=purchases', { waitUntil: 'commit', timeout: 30000 });
    console.log('   mypurchases committed. Waiting 5s...');
    await page.waitForTimeout(5000);

    const title = await page.title();
    console.log('Page Title:', title);

    const nextData = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      return el ? el.innerText.slice(0, 300) : 'No __NEXT_DATA__';
    });
    console.log('__NEXT_DATA__ sample:', nextData);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
