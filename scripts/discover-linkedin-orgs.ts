#!/usr/bin/env bun
/**
 * CSC LinkedIn Organization Handle & Page Discovery Tool
 *
 * Scans src/content/partners/, src/content/community/, and src/utils/partner-registry.ts
 * to resolve, verify, and record LinkedIn company/school handles and URLs for @tagging.
 *
 * Usage:
 *   bun run scripts/discover-linkedin-orgs.ts --simulate        # Reports resolved LinkedIn handles (read-only)
 *   bun run scripts/discover-linkedin-orgs.ts --probe           # Probes org websites for linkedin.com/company|school links
 *   bun run scripts/discover-linkedin-orgs.ts --write           # Syncs linkedinUrl & linkedinHandle into partner/community markdown frontmatter
 */

import fs from 'fs';
import path from 'path';
import {
  REGISTERED_PARTNERS,
  COMMUNITY_LINKEDIN_DIRECTORY,
  resolveLinkedinOrg,
} from '../src/utils/partner-registry';

export interface DiscoveredOrgLinkedin {
  name: string;
  collection: 'partners' | 'community' | 'registry-only';
  filePath?: string;
  websiteUrl?: string;
  linkedinHandle?: string;
  linkedinUrl?: string;
  source: 'registry' | 'frontmatter' | 'website-scrape' | 'unresolved';
}

const REPO_ROOT = process.cwd();
const PARTNERS_DIR = path.join(REPO_ROOT, 'src/content/partners');
const COMMUNITY_DIR = path.join(REPO_ROOT, 'src/content/community');

const args = process.argv.slice(2);
const isWriteMode = args.includes('--write');
const isProbeMode = args.includes('--probe');
const isResolveUrnsMode = args.includes('--resolve-urns');
const isJsonMode = args.includes('--json');

/**
 * Queries LinkedIn's REST API `/rest/organizationsLookup?q=vanityName&vanityName=<slug>`
 * when `--resolve-urns` and `LINKEDIN_ACCESS_TOKEN` are provided, returning the numeric
 * Organization ID (`urn:li:organization:<id>`) for LittleText `@[Name](urn:li:organization:ID)` tagging.
 */
export async function lookupLinkedinOrgIdByVanityName(
  vanityName: string,
  accessToken?: string
): Promise<string | undefined> {
  const token = accessToken || process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  if (!token || !vanityName) return undefined;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = `https://api.linkedin.com/rest/organizationsLookup?q=vanityName&vanityName=${encodeURIComponent(vanityName)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': '202602',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      results?: Record<string, { id?: number | string }>;
    };
    const entry = data.results?.[vanityName];
    if (entry?.id !== undefined) {
      return String(entry.id);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extracts a LinkedIn company/school slug from a LinkedIn URL.
 */
export function extractLinkedinHandleFromUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl.trim());
    if (!parsed.hostname.toLowerCase().includes('linkedin.com')) return undefined;
    const match = parsed.pathname.match(/^\/(?:company|school)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1].toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extracts LinkedIn company/school URLs from raw HTML.
 */
export function extractLinkedinUrlFromHtml(html: string): string | undefined {
  const regex =
    /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|school)\/[a-zA-Z0-9_-]+\/?/gi;
  const matches = html.match(regex);
  if (!matches || matches.length === 0) return undefined;
  return matches[0];
}

function extractFrontmatterField(fm: string, key: string): string | undefined {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = fm.match(regex);
  if (!match) return undefined;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function updateMarkdownFrontmatter(
  filePath: string,
  linkedinUrl: string,
  linkedinHandle?: string
): boolean {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return false;

  let fm = fmMatch[1];
  const body = fmMatch[2];
  let changed = false;

  if (!extractFrontmatterField(fm, 'linkedinUrl')) {
    fm += `\nlinkedinUrl: "${linkedinUrl}"`;
    changed = true;
  }
  if (linkedinHandle && !extractFrontmatterField(fm, 'linkedinHandle')) {
    fm += `\nlinkedinHandle: "${linkedinHandle}"`;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, `---\n${fm}\n---\n${body}`, 'utf-8');
  }
  return changed;
}

async function probeWebsiteForLinkedin(websiteUrl: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CSC-LinkedIn-Discovery/1.0 (+https://cyberscotlandconnect.com)',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const html = await res.text();
    return extractLinkedinUrlFromHtml(html);
  } catch {
    return undefined;
  }
}

export async function discoverAllOrgLinkedin(options?: {
  probe?: boolean;
  write?: boolean;
}): Promise<DiscoveredOrgLinkedin[]> {
  const results: DiscoveredOrgLinkedin[] = [];
  const seenNames = new Set<string>();

  const scanDir = async (dirPath: string, collection: 'partners' | 'community') => {
    if (!fs.existsSync(dirPath)) return;
    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
      .sort();

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];

      const name = extractFrontmatterField(fm, 'name') || file.replace(/\.mdx?$/, '');
      const websiteUrl = extractFrontmatterField(fm, 'websiteUrl');
      const fmLinkedinUrl = extractFrontmatterField(fm, 'linkedinUrl');
      const fmLinkedinHandle = extractFrontmatterField(fm, 'linkedinHandle');

      seenNames.add(name.toLowerCase());

      // 1. Check frontmatter first
      if (fmLinkedinUrl || fmLinkedinHandle) {
        const handle = fmLinkedinHandle || extractLinkedinHandleFromUrl(fmLinkedinUrl);
        results.push({
          name,
          collection,
          filePath: path.relative(REPO_ROOT, fullPath),
          websiteUrl,
          linkedinHandle: handle,
          linkedinUrl: fmLinkedinUrl,
          source: 'frontmatter',
        });
        continue;
      }

      // 2. Check deterministic registry
      const registryMatch = resolveLinkedinOrg(name);
      if (registryMatch && (registryMatch.linkedinUrl || registryMatch.linkedinHandle)) {
        if (options?.write && registryMatch.linkedinUrl) {
          updateMarkdownFrontmatter(
            fullPath,
            registryMatch.linkedinUrl,
            registryMatch.linkedinHandle
          );
        }
        results.push({
          name,
          collection,
          filePath: path.relative(REPO_ROOT, fullPath),
          websiteUrl,
          linkedinHandle: registryMatch.linkedinHandle,
          linkedinUrl: registryMatch.linkedinUrl,
          source: 'registry',
        });
        continue;
      }

      // 3. Check if websiteUrl itself is a LinkedIn URL
      if (websiteUrl && websiteUrl.includes('linkedin.com')) {
        const handle = extractLinkedinHandleFromUrl(websiteUrl);
        results.push({
          name,
          collection,
          filePath: path.relative(REPO_ROOT, fullPath),
          websiteUrl,
          linkedinHandle: handle,
          linkedinUrl: websiteUrl,
          source: 'frontmatter',
        });
        continue;
      }

      // 4. Optional live website HTML scrape
      if (options?.probe && websiteUrl) {
        const scrapedUrl = await probeWebsiteForLinkedin(websiteUrl);
        if (scrapedUrl) {
          const handle = extractLinkedinHandleFromUrl(scrapedUrl);
          if (options?.write) {
            updateMarkdownFrontmatter(fullPath, scrapedUrl, handle);
          }
          results.push({
            name,
            collection,
            filePath: path.relative(REPO_ROOT, fullPath),
            websiteUrl,
            linkedinHandle: handle,
            linkedinUrl: scrapedUrl,
            source: 'website-scrape',
          });
          continue;
        }
      }

      results.push({
        name,
        collection,
        filePath: path.relative(REPO_ROOT, fullPath),
        websiteUrl,
        source: 'unresolved',
      });
    }
  };

  await scanDir(PARTNERS_DIR, 'partners');
  await scanDir(COMMUNITY_DIR, 'community');

  // Include any additional ecosystem orgs in REGISTERED_PARTNERS or COMMUNITY_LINKEDIN_DIRECTORY
  for (const entry of [...REGISTERED_PARTNERS, ...COMMUNITY_LINKEDIN_DIRECTORY]) {
    if (!seenNames.has(entry.canonicalName.toLowerCase())) {
      seenNames.add(entry.canonicalName.toLowerCase());
      results.push({
        name: entry.canonicalName,
        collection: 'registry-only',
        linkedinHandle: entry.linkedinHandle,
        linkedinUrl: entry.linkedinUrl,
        source: 'registry',
      });
    }
  }

  return results;
}

async function main() {
  const discovered = await discoverAllOrgLinkedin({
    probe: isProbeMode,
    write: isWriteMode,
  });

  if (isJsonMode) {
    console.log(JSON.stringify(discovered, null, 2));
    return;
  }

  const resolved = discovered.filter((d) => d.linkedinHandle || d.linkedinUrl);
  const unresolved = discovered.filter((d) => !d.linkedinHandle && !d.linkedinUrl);

  console.log('================================================================');
  console.log('🔎 CSC LinkedIn Organization Handle & Tag Registry Report');
  console.log(
    `Mode: ${isWriteMode ? 'WRITE (Frontmatter Sync)' : 'SIMULATE (Read-Only)'} | Total Orgs: ${discovered.length} | Resolved: ${resolved.length} | Unresolved: ${unresolved.length}`
  );
  console.log('================================================================\n');

  console.log('✅ Resolved LinkedIn Organization Pages & @Handles:');
  for (const org of resolved) {
    const tag = org.linkedinHandle ? `@${org.name} [slug: ${org.linkedinHandle}]` : org.name;
    console.log(
      `  • [${org.collection.padEnd(13)}] ${tag.padEnd(55)} -> ${org.linkedinUrl || 'N/A'}`
    );
  }

  if (unresolved.length > 0) {
    console.log('\n⚠️  Orgs without dedicated LinkedIn Company Page (Plain-text fallback in copy):');
    for (const org of unresolved) {
      console.log(`  • [${org.collection.padEnd(13)}] ${org.name} (${org.websiteUrl || 'no URL'})`);
    }
  }

  if (isResolveUrnsMode) {
    console.log('\n🔑 Resolving missing numeric LinkedIn Organization IDs via /rest/organizationsLookup:');
    const allRegistryOrgs = [...REGISTERED_PARTNERS, ...COMMUNITY_LINKEDIN_DIRECTORY];
    const missingIdOrgs = allRegistryOrgs.filter(
      (o) => o.linkedinHandle && !o.linkedinOrgId
    );
    const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
    if (!token) {
      console.log(
        `  ℹ️  LINKEDIN_ACCESS_TOKEN not set — ${missingIdOrgs.length} orgs queued for URN lookup once authenticated:`
      );
      for (const o of missingIdOrgs) {
        console.log(`     • ${o.canonicalName} (vanityName: ${o.linkedinHandle})`);
      }
    } else {
      for (const o of missingIdOrgs) {
        const id = await lookupLinkedinOrgIdByVanityName(o.linkedinHandle!, token);
        console.log(
          `     • ${o.canonicalName} (${o.linkedinHandle}) -> ${id ? `urn:li:organization:${id}` : 'not found'}`
        );
      }
    }
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('❌ Error in discover-linkedin-orgs.ts:', err);
    process.exit(1);
  });
}
