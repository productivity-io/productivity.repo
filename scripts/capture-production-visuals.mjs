import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const outDir = '/Users/pendemjr/.gemini/antigravity/brain/30c5dfa3-c360-4a3d-98c3-bda830928c3e/screenshots';
fs.mkdirSync(outDir, { recursive: true });

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseUrl = 'https://productivity-io.vercel.app';

async function capture() {
  console.log('Launching browser to capture production screenshots...');
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await desktopContext.newPage();

  // 1. Login Page Desktop
  console.log('Capturing login desktop...');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, '01-login-desktop.png') });

  // 2. Click instant sign-in for Student (Aarav Sharma)
  console.log('Signing in as Student...');
  const instantStudentBtn = page.getByRole('button', { name: 'Instant Sign In' }).first();
  if (await instantStudentBtn.isVisible()) {
    await instantStudentBtn.click();
  } else {
    await page.fill('#login-identifier', 'student1');
    await page.fill('#current-password', 'password123');
    await page.click('button[type="submit"]');
  }

  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('Capturing student dashboard...');
  await page.screenshot({ path: path.join(outDir, '02-student-dashboard.png') });

  // 3. Open Cmd+K Command Palette
  console.log('Opening Cmd+K Command Palette...');
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '03-command-palette.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 4. Capture Attendance Page
  console.log('Navigating to /attendance...');
  await page.goto(`${baseUrl}/attendance`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '04-attendance-page.png') });

  // 5. Capture Assignments Page
  console.log('Navigating to /assignments...');
  await page.goto(`${baseUrl}/assignments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '05-assignments-page.png') });

  // 6. Capture Examinations Page
  console.log('Navigating to /examinations...');
  await page.goto(`${baseUrl}/examinations`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '06-examinations-page.png') });

  // 7. Mobile View
  console.log('Capturing Mobile View...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: path.join(outDir, '07-login-mobile.png') });

  await browser.close();
  console.log('Production screenshots complete!');
}

capture().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
