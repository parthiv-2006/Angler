const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto('https://www.angler.software');
  await page.click('text="ED telehealth"');
  await page.click('button:has-text("Cast the line")');
  await page.waitForTimeout(14000);
  await page.screenshot({ path: 'docs/screenshot.png' });
  await browser.close();
})();
