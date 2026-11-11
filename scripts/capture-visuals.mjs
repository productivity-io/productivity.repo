import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = '/Users/pendemjr/.gemini/antigravity/brain/30c5dfa3-c360-4a3d-98c3-bda830928c3e/screenshots';
fs.mkdirSync(outDir, { recursive: true });

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  console.log('Starting dev preview server...');
  const devServer = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: '/Users/pendemjr/productivity.io',
    env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:' + process.env.PATH },
    stdio: 'ignore'
  });

  // Wait 1.5s for server
  await new Promise(r => setTimeout(r, 1500));

  console.log('Launching Chrome...');
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  console.log('Capturing /login...');
  await page.goto('http://localhost:4173/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, '01-login-desktop.png') });

  console.log('Capturing mobile /login...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(outDir, '02-login-mobile.png') });

  await browser.close();
  devServer.kill();
  console.log('Screenshots captured successfully in', outDir);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
