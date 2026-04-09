const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, '../client/public/screenshots');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Login via raw HTTP and return the session cookie string
function loginHTTP() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost', port: 3000,
      path: '/api/auth/login', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (!setCookie) return reject(new Error('No Set-Cookie header: ' + data));
        // Parse session cookie
        const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        const [nameVal] = cookieStr.split(';');
        const [name, value] = nameVal.trim().split('=');
        console.log('  Session cookie:', name);
        resolve({ name, value });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function takeScreenshots() {
  // Step 1: get session cookie via raw HTTP (avoids the 401→redirect loop in the SPA)
  console.log('Logging in via HTTP…');
  const cookie = await loginHTTP();
  console.log('  Got cookie:', cookie.name);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // Step 2: inject the session cookie before navigating
  await page.setCookie({
    name: cookie.name,
    value: cookie.value,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });

  // helper: navigate and wait for meaningful content
  async function goto(url, selector = 'nav, main, [class*="sidebar"]') {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector(selector, { timeout: 10000 }).catch(() => {});
    await sleep(3500);
  }

  // helper: click a button by exact label text
  async function clickBtn(label) {
    const handles = await page.$$('button');
    for (const h of handles) {
      const txt = await h.evaluate(el => el.textContent.trim());
      if (new RegExp(`^${label}$`, 'i').test(txt)) {
        await h.click();
        await sleep(1500);
        return true;
      }
    }
    return false;
  }

  // ── Dashboard ──
  console.log('Dashboard…');
  await goto(`${BASE}/dashboard`);
  await page.screenshot({ path: `${OUTPUT_DIR}/dashboard.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`✓ Dashboard (${Math.round(fs.statSync(`${OUTPUT_DIR}/dashboard.png`).size/1024)}KB)`);

  // ── Find first project ──
  let projectUrl = `${BASE}/projects/1`;
  try {
    const href = await page.$eval('a[href*="/projects/"]', el => el.getAttribute('href'));
    if (href) projectUrl = href.startsWith('http') ? href : `${BASE}${href}`;
  } catch(e) {}
  console.log('  Project URL:', projectUrl);

  // ── Project list ──
  console.log('Project list…');
  await goto(projectUrl, 'table, button');
  await clickBtn('List');
  await page.screenshot({ path: `${OUTPUT_DIR}/project-list.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`✓ Project list (${Math.round(fs.statSync(`${OUTPUT_DIR}/project-list.png`).size/1024)}KB)`);

  // ── Kanban board ──
  console.log('Kanban…');
  await goto(projectUrl, 'table, button');
  await clickBtn('Board');
  await sleep(500);
  await page.screenshot({ path: `${OUTPUT_DIR}/kanban.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`✓ Kanban (${Math.round(fs.statSync(`${OUTPUT_DIR}/kanban.png`).size/1024)}KB)`);

  // ── Gantt ──
  console.log('Gantt…');
  await goto(projectUrl, 'table, button');
  await clickBtn('Gantt');
  await sleep(500);
  await page.screenshot({ path: `${OUTPUT_DIR}/gantt.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`✓ Gantt (${Math.round(fs.statSync(`${OUTPUT_DIR}/gantt.png`).size/1024)}KB)`);

  // ── Task detail ──
  console.log('Task detail…');
  await goto(projectUrl, 'table, button');
  await clickBtn('List');
  await sleep(500);
  const rows = await page.$$('tbody tr');
  if (rows.length > 0) {
    await rows[0].click();
    await sleep(2000);
  }
  await page.screenshot({ path: `${OUTPUT_DIR}/task-detail.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`✓ Task detail (${Math.round(fs.statSync(`${OUTPUT_DIR}/task-detail.png`).size/1024)}KB)`);

  // ── Pages ──
  console.log('Pages…');
  // Find a pages link in the sidebar and click it
  await goto(`${BASE}/dashboard`);
  const pagesLink = await page.$('a[href*="/pages"]');
  if (pagesLink) {
    const href = await pagesLink.evaluate(el => el.getAttribute('href'));
    await goto(`${BASE}${href}`, 'main');
  }
  await page.screenshot({ path: `${OUTPUT_DIR}/pages.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`✓ Pages (${Math.round(fs.statSync(`${OUTPUT_DIR}/pages.png`).size/1024)}KB)`);

  // ── Chat ──
  console.log('Chat…');
  await goto(`${BASE}/chat`, 'main, [class*="chat"]');
  await page.screenshot({ path: `${OUTPUT_DIR}/chat.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`✓ Chat (${Math.round(fs.statSync(`${OUTPUT_DIR}/chat.png`).size/1024)}KB)`);

  // ── Calendar ──
  console.log('Calendar…');
  await goto(`${BASE}/calendar`, 'main, table');
  await page.screenshot({ path: `${OUTPUT_DIR}/calendar.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  console.log(`✓ Calendar (${Math.round(fs.statSync(`${OUTPUT_DIR}/calendar.png`).size/1024)}KB)`);

  await browser.close();
  console.log('\n✅ All screenshots saved to client/public/screenshots/');
}

takeScreenshots().catch(err => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
