#!/usr/bin/env bun
/**
 * CSC Event Discovery Engine
 * Deterministic, sub-second event ingestion across RSS, iCal, Bluesky, and community feeds.
 *
 * Usage:
 *   bun run scripts/discover-events.ts             # Dry run (scans and reports)
 *   bun run scripts/discover-events.ts --write     # Writes new events to src/content/events/
 *   bun run scripts/discover-events.ts --json      # Outputs candidates as JSON
 */

import fs from 'fs';
import path from 'path';

interface RssFeedSource {
  name: string;
  url: string;
  format: 'rss' | 'atom';
  category: string;
}

interface ICalFeedSource {
  name: string;
  url: string;
  format: 'ical';
  category: string;
}

interface BlueskyFeedSource {
  name: string;
  handle: string;
  rssUrl: string;
}

interface EventFilters {
  requireFutureDate: boolean;
  requireScotlandLocation: boolean;
  requireCyberRelevance: boolean;
  locationKeywords: string[];
  cyberKeywords: string[];
  excludeKeywords: string[];
}

interface EventSourcesConfig {
  rssFeeds?: RssFeedSource[];
  iCalFeeds?: ICalFeedSource[];
  blueskyFeeds?: BlueskyFeedSource[];
  filters: EventFilters;
}

export interface DiscoveredEvent {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  location: string;
  locationUrl?: string;
  city: 'Edinburgh' | 'Glasgow' | 'Dundee' | 'Aberdeen' | 'Virtual' | 'Scotland-wide';
  isPartnerEvent: boolean;
  partnerName: string;
  meetupUrl: string;
  description: string;
  sourceUrl: string;
  sourceType: 'rss' | 'ical' | 'bluesky';
}

const REPO_ROOT = process.cwd();
const SOURCES_CONFIG_PATH = path.join(REPO_ROOT, 'scripts/event-sources.json');
const EVENTS_DIR = path.join(REPO_ROOT, 'src/content/events');

const isWriteMode = process.argv.includes('--write');
const isJsonMode = process.argv.includes('--json');
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

const USER_AGENT =
  'CSC-Event-Discovery/2.0 (+https://cyberscotlandconnect.com; bot@cyberscotlandconnect.com)';

// Helper: Normalize strings for deduplication
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Slugify title for filenames
function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45);
}

// Helper: Strip HTML tags and clean up text
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

// Load existing events to avoid duplicates
function loadExistingEvents(): Set<string> {
  const existing = new Set<string>();
  if (!fs.existsSync(EVENTS_DIR)) return existing;

  const files = fs.readdirSync(EVENTS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  for (const file of files) {
    existing.add(file.replace(/\.mdx?$/, ''));
    try {
      const content = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf-8');
      const titleMatch = content.match(/title:\s*["']?([^"'\n\r]+)["']?/);
      const dateMatch = content.match(/date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      if (titleMatch && dateMatch) {
        existing.add(`${dateMatch[1]}-${normalizeTitle(titleMatch[1])}`);
      }
    } catch {
      // Ignore read errors
    }
  }
  return existing;
}

// Helper: Validate HTTP/HTTPS URLs
function isValidUrl(u?: string): boolean {
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Match city from text
function detectCity(
  text: string
): 'Edinburgh' | 'Glasgow' | 'Dundee' | 'Aberdeen' | 'Virtual' | 'Scotland-wide' {
  const lower = text.toLowerCase();
  if (lower.includes('edinburgh')) return 'Edinburgh';
  if (lower.includes('glasgow')) return 'Glasgow';
  if (lower.includes('dundee') || lower.includes('st andrews')) return 'Dundee';
  if (lower.includes('aberdeen')) return 'Aberdeen';
  if (lower.includes('online') || lower.includes('virtual') || lower.includes('webinar'))
    return 'Virtual';
  return 'Scotland-wide';
}

// Safe HTTP Fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/calendar, text/xml, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Ingest RSS / Atom Feeds
async function parseRssFeed(feed: RssFeedSource, todayStr: string): Promise<DiscoveredEvent[]> {
  const xml = await fetchWithTimeout(feed.url);
  if (!xml) return [];

  const events: DiscoveredEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || itemXml.match(/<title>(.*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);
    const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);

    if (!titleMatch || !linkMatch) continue;

    const rawTitle = stripHtml(titleMatch[1]);
    const link = linkMatch[1].trim();
    const rawDesc = descMatch ? stripHtml(descMatch[1]) : '';

    // Extract embedded event date from title, description, or pubDate
    let eventDateStr = '';
    const datePattern = /(?:202[6-9])-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])/;
    const directDateMatch = link.match(datePattern) || rawDesc.match(datePattern);

    if (directDateMatch) {
      eventDateStr = directDateMatch[0];
    } else if (pubDateMatch) {
      const parsed = new Date(pubDateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        eventDateStr = parsed.toISOString().slice(0, 10);
      }
    }

    if (!eventDateStr || eventDateStr < todayStr) continue;

    events.push({
      title: rawTitle,
      date: eventDateStr,
      location: feed.name.includes('Virtual') ? 'Online (virtual)' : 'Scotland',
      city: detectCity(`${rawTitle} ${rawDesc}`),
      isPartnerEvent: true,
      partnerName: feed.name.split('—')[0].trim(),
      meetupUrl: link,
      description: rawDesc.slice(0, 280) || rawTitle,
      sourceUrl: feed.url,
      sourceType: 'rss',
    });
  }

  return events;
}

// Ingest iCal Feeds
async function parseICalFeed(feed: ICalFeedSource, todayStr: string): Promise<DiscoveredEvent[]> {
  const ics = await fetchWithTimeout(feed.url);
  if (!ics) return [];

  const events: DiscoveredEvent[] = [];
  const eventBlocks = ics.split(/BEGIN:VEVENT/i).slice(1);

  for (const block of eventBlocks) {
    const summaryMatch = block.match(/SUMMARY(?::|;[^:]*:)(.*)/i);
    const dtstartMatch = block.match(/DTSTART(?::|;[^:]*:)([0-9]{8})/i);
    const locationMatch = block.match(/LOCATION(?::|;[^:]*:)(.*)/i);
    const descMatch = block.match(/DESCRIPTION(?::|;[^:]*:)(.*)/i);
    const urlMatch = block.match(/URL(?::|;[^:]*:)(.*)/i);

    if (!summaryMatch || !dtstartMatch) continue;

    const rawDate = dtstartMatch[1]; // YYYYMMDD
    const eventDateStr = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

    if (eventDateStr < todayStr) continue;

    const rawTitle = summaryMatch[1].replace(/\\,/g, ',').trim();
    const rawLocation = locationMatch ? locationMatch[1].replace(/\\,/g, ',').trim() : 'Scotland';
    const rawUrl = urlMatch ? urlMatch[1].trim() : feed.url;
    const rawDesc = descMatch ? descMatch[1].replace(/\\n/g, ' ').replace(/\\,/g, ',').trim() : '';

    events.push({
      title: rawTitle,
      date: eventDateStr,
      location: rawLocation,
      city: detectCity(`${rawTitle} ${rawLocation}`),
      isPartnerEvent: true,
      partnerName: feed.name.split('—')[0].trim(),
      meetupUrl: rawUrl,
      description: rawDesc.slice(0, 280) || `Upcoming community meetup organized by ${feed.name}.`,
      sourceUrl: feed.url,
      sourceType: 'ical',
    });
  }

  return events;
}

// Ingest Bluesky Profile RSS
async function parseBlueskyFeed(source: BlueskyFeedSource, todayStr: string): Promise<DiscoveredEvent[]> {
  const xml = await fetchWithTimeout(source.rssUrl);
  if (!xml) return [];

  const events: DiscoveredEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);

    if (!descMatch || !linkMatch) continue;

    const postText = stripHtml(descMatch[1]);
    const link = linkMatch[1].trim();

    // Check if post references event triggers
    const hasEventKeyword = /\b(meetup|gathering|talk|conference|tickets|doors open|tickets live)\b/i.test(postText);
    const hasScotlandKeyword = /\b(scotland|edinburgh|glasgow|dundee|aberdeen|leith|codebase)\b/i.test(postText);

    if (!hasEventKeyword || !hasScotlandKeyword) continue;

    // Check for future date mentions like 'October 15', '15th Oct', '15.10.26', '2026-10-15'
    const dateMatch = postText.match(/(?:202[6-9])-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])/);
    if (!dateMatch) continue;

    const eventDateStr = dateMatch[0];
    if (eventDateStr < todayStr) continue;

    events.push({
      title: postText.slice(0, 60).replace(/\n/g, ' ') + '...',
      date: eventDateStr,
      location: 'Scotland',
      city: detectCity(postText),
      isPartnerEvent: true,
      partnerName: source.name,
      meetupUrl: link,
      description: postText.slice(0, 300),
      sourceUrl: source.rssUrl,
      sourceType: 'bluesky',
    });
  }

  return events;
}

// Main Execution
async function main() {
  const todayStr = new Date().toISOString().slice(0, 10);

  if (!isJsonMode) {
    console.log(`\n=================================================`);
    console.log(`  CSC Event Discovery Engine v2.0`);
    console.log(`  Date: ${todayStr} | Mode: ${isWriteMode ? 'WRITE' : 'DRY-RUN'}`);
    console.log(`=================================================\n`);
  }

  if (!fs.existsSync(SOURCES_CONFIG_PATH)) {
    console.error(`❌ Missing config: ${SOURCES_CONFIG_PATH}`);
    process.exit(1);
  }

  const config: EventSourcesConfig = JSON.parse(fs.readFileSync(SOURCES_CONFIG_PATH, 'utf-8'));
  const existingEvents = loadExistingEvents();

  if (!isJsonMode) {
    console.log(`📂 Loaded ${existingEvents.size} existing event signatures for deduplication.`);
    console.log(`🌐 Ingesting sources...\n`);
  }

  const candidateEvents: DiscoveredEvent[] = [];

  // 1. Ingest RSS feeds
  for (const feed of config.rssFeeds || []) {
    if (!isJsonMode && isVerbose) process.stdout.write(`  [RSS] Fetching ${feed.name}... `);
    const found = await parseRssFeed(feed, todayStr);
    if (!isJsonMode && isVerbose) console.log(`${found.length} items`);
    candidateEvents.push(...found);
  }

  // 2. Ingest iCal feeds
  for (const feed of config.iCalFeeds || []) {
    if (!isJsonMode && isVerbose) process.stdout.write(`  [iCal] Fetching ${feed.name}... `);
    const found = await parseICalFeed(feed, todayStr);
    if (!isJsonMode && isVerbose) console.log(`${found.length} items`);
    candidateEvents.push(...found);
  }

  // 3. Ingest Bluesky feeds
  for (const source of config.blueskyFeeds || []) {
    if (!isJsonMode && isVerbose) process.stdout.write(`  [Bluesky] Fetching @${source.handle}... `);
    const found = await parseBlueskyFeed(source, todayStr);
    if (!isJsonMode && isVerbose) console.log(`${found.length} items`);
    candidateEvents.push(...found);
  }

  // Deduplicate candidates
  const newEvents: DiscoveredEvent[] = [];
  const seenInRun = new Set<string>();

  for (const ev of candidateEvents) {
    const slug = `${ev.date}-${slugify(ev.title)}`;
    const normalizedKey = `${ev.date}-${normalizeTitle(ev.title)}`;

    if (existingEvents.has(slug) || existingEvents.has(normalizedKey)) {
      continue;
    }
    if (seenInRun.has(normalizedKey)) {
      continue;
    }

    seenInRun.add(normalizedKey);
    newEvents.push(ev);
  }

  if (isJsonMode) {
    console.log(JSON.stringify(newEvents, null, 2));
    return;
  }

  console.log(`\n-------------------------------------------------`);
  console.log(`📊 Ingestion Complete:`);
  console.log(`   Sources Checked: ${(config.rssFeeds?.length || 0) + (config.iCalFeeds?.length || 0) + (config.blueskyFeeds?.length || 0)} feeds`);
  console.log(`   Total Items Scanned: ${candidateEvents.length}`);
  console.log(`   New Candidate Events: ${newEvents.length}`);
  console.log(`-------------------------------------------------\n`);

  if (newEvents.length === 0) {
    console.log(`✅ No new uncatalogued events found today. Website archive is up to date!`);
    return;
  }

  for (const ev of newEvents) {
    const filename = `${ev.date}-${slugify(ev.title)}.md`;
    console.log(`🗓️  [${ev.date}] ${ev.title} (${ev.city})`);
    console.log(`    Source: ${ev.meetupUrl}`);
    console.log(`    File:   src/content/events/${filename}`);

    if (isWriteMode) {
      const targetFile = path.join(EVENTS_DIR, filename);
      const content = `---
title: '${ev.title.replace(/'/g, "''")}'
date: ${ev.date}
${ev.time ? `time: '${ev.time}'\n` : ''}location: '${ev.location.replace(/'/g, "''")}'
${isValidUrl(ev.locationUrl) ? `locationUrl: '${ev.locationUrl}'\n` : ''}city: '${ev.city}'
isPartnerEvent: ${ev.isPartnerEvent}
partnerName: '${ev.partnerName.replace(/'/g, "''")}'
${isValidUrl(ev.meetupUrl) ? `meetupUrl: '${ev.meetupUrl}'\n` : ''}accessibility:
  stepFree: true
  hearingLoop: false
  notes: 'Check organizer registration link for full accessibility accommodations.'
speakers: []
agenda: []
---

${ev.description}

[SOURCE: ${ev.meetupUrl}]
`;
      fs.writeFileSync(targetFile, content, 'utf-8');
      console.log(`    ✓ Written successfully.`);
    }
    console.log('');
  }

  if (!isWriteMode) {
    console.log(`💡 Tip: Run with '--write' to automatically generate these event files.`);
  }
}

main().catch((err) => {
  console.error(`❌ Unexpected error:`, err);
  process.exit(1);
});
