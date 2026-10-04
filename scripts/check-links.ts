import fs from 'fs';
import path from 'path';

interface CacheEntry {
  status: number;
  lastChecked: string;
}

type LinkCache = Record<string, CacheEntry>;

const CACHE_FILE = path.resolve(process.cwd(), '.link-cache.json');
const CACHE_TTL_DAYS = 30;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
const forceCheck = process.argv.includes('--force') || process.argv.includes('--all');
const checkAllCollections = process.argv.includes('--all-collections');
const reportOnly = process.argv.includes('--report-only') || process.argv.includes('--non-fatal');

let reportFilePath: string | null = null;
const reportFileIndex = process.argv.indexOf('--report-file');
if (reportFileIndex !== -1 && process.argv[reportFileIndex + 1]) {
  reportFilePath = path.resolve(process.cwd(), process.argv[reportFileIndex + 1]);
}

function loadCache(): LinkCache {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveCache(cache: LinkCache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

async function verifyUrl(url: string): Promise<{ status: number; ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    // 2xx and 3xx are OK. 403 (anti-bot WAF) is treated as a soft-pass for known sites, not a dead link
    const isOk = (res.status >= 200 && res.status < 400) || res.status === 403;
    return { status: res.status, ok: isOk };
  } catch (err: any) {
    return { status: 0, ok: false, error: err.message || 'Network error' };
  }
}

function extractUrlsFromDir(dirPath: string): { source: string; url: string }[] {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  const results: { source: string; url: string }[] = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const matches = content.matchAll(/(?:url|websiteUrl|chatUrl|meetupUrl|registrationUrl|locationUrl):\s*['"]([^'"]+)['"]/g);
    for (const match of matches) {
      if (match[1]) {
        results.push({ source: file, url: match[1] });
      }
    }
  }
  return results;
}

function extractStaticUrls(): { source: string; url: string }[] {
  return [
    { source: 'resources.astro (SAMH)', url: 'https://www.samh.org.uk' },
    { source: 'resources.astro (Breathing Space)', url: 'https://breathingspace.scot/' },
    { source: 'resources.astro (Edinburgh Nightline)', url: 'https://ednightline.com/' },
    { source: 'resources.astro (Discord)', url: 'https://discord.gg/cyberscotlandconnect' },
  ];
}

async function main() {
  console.log('🔍 Running Automated External Link Validator...\n');
  if (forceCheck) {
    console.log('⚡ Force mode enabled: Bypassing 30-day cache.');
  }

  const cache = loadCache();
  const now = Date.now();

  const resourcesDir = path.resolve(process.cwd(), 'src/content/resources');
  const communityDir = path.resolve(process.cwd(), 'src/content/community');
  const partnersDir = path.resolve(process.cwd(), 'src/content/partners');
  const eventsDir = path.resolve(process.cwd(), 'src/content/events');

  const targets = [
    ...extractStaticUrls(),
    ...extractUrlsFromDir(resourcesDir),
    ...extractUrlsFromDir(communityDir),
    ...(checkAllCollections ? [...extractUrlsFromDir(partnersDir), ...extractUrlsFromDir(eventsDir)] : []),
  ];

  // Deduplicate by URL
  const uniqueUrls = new Map<string, string>();
  for (const t of targets) {
    if (!uniqueUrls.has(t.url)) {
      uniqueUrls.set(t.url, t.source);
    }
  }

  let checkedCount = 0;
  let cachedCount = 0;
  let failedCount = 0;
  const failures: { url: string; source: string; status: number | string }[] = [];

  for (const [url, source] of uniqueUrls.entries()) {
    const cached = cache[url];
    const isCachedValid =
      !forceCheck &&
      cached &&
      ((cached.status >= 200 && cached.status < 400) || cached.status === 403) &&
      now - new Date(cached.lastChecked).getTime() < CACHE_TTL_MS;

    if (isCachedValid) {
      const ageDays = Math.floor((now - new Date(cached.lastChecked).getTime()) / (24 * 60 * 60 * 1000));
      console.log(`[CACHED] (${ageDays}d ago) ${source} -> ${url}`);
      cachedCount++;
      continue;
    }

    // Perform live check
    process.stdout.write(`[CHECKING] ${source} -> ${url} ... `);
    const result = await verifyUrl(url);
    checkedCount++;

    if (result.ok) {
      console.log(`✅ ${result.status}`);
      cache[url] = {
        status: result.status,
        lastChecked: new Date().toISOString(),
      };
    } else {
      console.log(`❌ ${result.status || result.error}`);
      failedCount++;
      failures.push({
        url,
        source,
        status: result.status || result.error || 'FAILED',
      });
      delete cache[url];
    }
  }

  saveCache(cache);

  console.log('\n=============================================');
  console.log(`Link Validation Summary:`);
  console.log(`  Total URLs Evaluated: ${uniqueUrls.size}`);
  console.log(`  Live Network Checks:  ${checkedCount}`);
  console.log(`  Valid Cached (<=30d): ${cachedCount}`);
  console.log(`  Failed / Broken:      ${failedCount}`);
  console.log('=============================================\n');

  const summaryMarkdown: string[] = [
    `### 🔗 External Link Health Audit Report`,
    ``,
    `* **Run Date:** ${new Date().toISOString()}`,
    `* **Total Evaluated:** ${uniqueUrls.size}`,
    `* **Live Checked:** ${checkedCount}`,
    `* **Valid Cached:** ${cachedCount}`,
    `* **Broken / Failed:** ${failedCount}`,
    ``,
  ];

  if (failedCount > 0) {
    summaryMarkdown.push(`#### ❌ Broken Links Detected`);
    summaryMarkdown.push(``);
    summaryMarkdown.push(`| Source File | Target URL | Error / Status |`);
    summaryMarkdown.push(`| :--- | :--- | :--- |`);
    for (const f of failures) {
      summaryMarkdown.push(`| \`${f.source}\` | [${f.url}](${f.url}) | \`${f.status}\` |`);
    }
    summaryMarkdown.push(``);
    summaryMarkdown.push(`> ℹ️ *Please review and update or remove dead links in the content directory.*`);
  } else {
    summaryMarkdown.push(`✅ All external links passed health checks.`);
  }

  const summaryText = summaryMarkdown.join('\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryText + '\n');
    } catch (e) {
      console.warn('Failed to write to GITHUB_STEP_SUMMARY:', e);
    }
  }

  if (reportFilePath) {
    if (failedCount > 0) {
      fs.writeFileSync(reportFilePath, summaryText, 'utf-8');
      console.log(`📝 Broken link report written to: ${reportFilePath}`);
    } else if (fs.existsSync(reportFilePath)) {
      fs.unlinkSync(reportFilePath);
    }
  }

  if (failedCount > 0) {
    console.error('❌ Broken links detected:');
    for (const f of failures) {
      console.error(`  - [${f.status}] ${f.source} -> ${f.url}`);
    }
    if (reportOnly) {
      console.log('⚠️ Running in report-only mode: Exiting with code 0.');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } else {
    console.log('✅ All external links verified successfully.');
    process.exit(0);
  }
}

main();
