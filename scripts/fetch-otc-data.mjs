/**
 * fetch-otc-data.mjs — 在 CI/CD build 時抓取 TPEx 上櫃每日收盤行情
 *
 * 將資料存為 static/data/otc_daily.json，供前端直接讀取（無 CORS 問題）。
 * 同時也抓取上櫃公司基本資料存為 static/data/otc_company.json。
 *
 * 用法：node scripts/fetch-otc-data.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'static', 'data');

// 確保目錄存在
mkdirSync(DATA_DIR, { recursive: true });

const OTC_DAILY_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';
const OTC_COMPANY_URL = 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O';

async function fetchAndSave(url, filename) {
  console.log(`Fetching ${filename} from ${url}...`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      console.error(`  HTTP ${res.status} for ${url}`);
      return false;
    }
    const data = await res.json();
    const path = join(DATA_DIR, filename);
    writeFileSync(path, JSON.stringify(data));
    const items = Array.isArray(data) ? data.length : 'N/A';
    console.log(`  Saved ${path} (${items} items)`);
    return true;
  } catch (e) {
    console.error(`  Failed: ${e.message}`);
    return false;
  }
}

const results = await Promise.all([
  fetchAndSave(OTC_DAILY_URL, 'otc_daily.json'),
  fetchAndSave(OTC_COMPANY_URL, 'otc_company.json'),
]);

if (results.every(Boolean)) {
  console.log('\n✅ All OTC data fetched successfully.');
} else {
  console.warn('\n⚠️ Some fetches failed. Build will continue with available data.');
}
