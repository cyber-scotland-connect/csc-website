#!/usr/bin/env bun
/**
 * CSC Event Discovery Engine v2.2
 * Deterministic + Local AI/NLP event ingestion across RSS, iCal, Bluesky, WP Tribe Events API,
 * Squarespace JSON API, and HTML Schema.org ld+json + unstructured seed pages.
 *
 * Usage:
 *   bun run scripts/discover-events.ts                # Dry run (deterministic scan)
 *   bun run scripts/discover-events.ts --ai           # Dry run with local Ollama NLP extraction & refinement
 *   bun run scripts/discover-events.ts --ai --write   # Writes AI-verified new events to src/content/events/
 *   bun run scripts/discover-events.ts --json         # Outputs candidates as JSON
 */

import fs from 'fs';
import path from 'path';

interface SeedUrlSource {
  name: string;
  url: string;
  category: string;
  city: string;
  cadence?: string;
}

interface RssFeedSource {
  name: string;
  url: string;
  format: 'rss' | 'atom';
  category: string;
}

interface WpFeedSource {
  name: string;
  url: string;
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

interface JsonFeedSource {
  name: string;
  url: string;
  format: 'squarespace' | 'generic';
  category: string;
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
  seedUrls?: SeedUrlSource[];
  rssFeeds?: RssFeedSource[];
  wpFeeds?: WpFeedSource[];
  jsonFeeds?: JsonFeedSource[];
  iCalFeeds?: ICalFeedSource[];
  blueskyFeeds?: BlueskyFeedSource[];
  filters: EventFilters;
}

export type CityType =
  | 'Edinburgh'
  | 'Glasgow'
  | 'Dundee'
  | 'Aberdeen'
  | 'Virtual'
  | 'Scotland-wide';

export type AccessType =
  | 'Open/Public'
  | 'Corporate/Paid'
  | 'Student/Academic'
  | 'Restricted/Civil Service';

export interface DiscoveredEvent {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  location: string;
  locationUrl?: string;
  city: CityType;
  isPartnerEvent: boolean;
  partnerName: string;
  organizerType?: 'Community' | 'Commercial' | 'Public Sector' | 'Academic';
  accessType?: AccessType;
  meetupUrl: string;
  description: string;
  sourceUrl: string;
  sourceType: 'rss' | 'ical' | 'bluesky' | 'wp-api' | 'ld-json' | 'squarespace';
  isDedicatedScottishSource?: boolean;
}

const REPO_ROOT = process.cwd();
const SOURCES_CONFIG_PATH = path.join(REPO_ROOT, 'scripts/event-sources.json');
const EVENTS_DIR = path.join(REPO_ROOT, 'src/content/events');

const isWriteMode = process.argv.includes('--write');
const isJsonMode = process.argv.includes('--json');
const isAiMode = process.argv.includes('--ai');
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

const LOCAL_AI_BASE_URL = 'http://127.0.0.1:11434';
const LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL || 'gemma3:4b';
let localAiOnline = false;

const USER_AGENT =
  'CSC-Event-Discovery/2.2 (+https://cyberscotlandconnect.com; bot@cyberscotlandconnect.com)';

// Helper: Normalize strings for deduplication
export function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Slugify title for filenames
export function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45)
    .replace(/-+$/, '');
}

const HTML_ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
  '&#038;': '&',
  '&#38;': '&',
  '&#039;': "'",
  '&#39;': "'",
  '&#8217;': "'",
  '&#8216;': "'",
  '&#8220;': '"',
  '&#8221;': '"',
  '&#8211;': '–',
  '&#8212;': '—',
  '&nbsp;': ' ',
};

// Helper: Strip HTML tags and clean up text
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z\d]+);/gi, (entity) => {
      const lower = entity.toLowerCase();
      if (HTML_ENTITIES[lower]) {
        return HTML_ENTITIES[lower];
      }
      if (lower.startsWith('&#x')) {
        const code = parseInt(lower.slice(3, -1), 16);
        if (!isNaN(code) && code > 0 && code <= 0x10ffff) {
          return String.fromCodePoint(code);
        }
      } else if (lower.startsWith('&#')) {
        const code = parseInt(lower.slice(2, -1), 10);
        if (!isNaN(code) && code > 0 && code <= 0x10ffff) {
          return String.fromCodePoint(code);
        }
      }
      return entity;
    })
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

// Helper: Check if a seed URL belongs to a UK-wide organization (rather than a dedicated Scottish source)
// Uses parsed URL.hostname to satisfy CodeQL js/incomplete-url-substring-sanitization
const UK_WIDE_DOMAINS = ['theiet.org', 'ciisec.org', 'thesasig.com'] as const;
function isUkWideSourceUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    // If the path specifically targets Scotland (e.g. /event/scotland-sasig/), treat as dedicated Scottish source
    if (parsed.pathname.toLowerCase().includes('scotland')) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return UK_WIDE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

// Helper: Natural language English date extraction (supports full & abbreviated months, slash dates, and year inference)
const MONTHS: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

const MONTH_PATTERN =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

export function extractNaturalDate(text: string, referenceTodayStr?: string): string | null {
  // Pattern 1: ISO YYYY-MM-DD
  const isoMatch = text.match(/\b(202[6-9])-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b/);
  if (isoMatch) return isoMatch[0];

  // Pattern 2: DD/MM/YYYY (UK slash format)
  const slashMatch = text.match(
    /\b(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[0-2])\/(202[6-9])\b/
  );
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Pattern 3: 2 October 2026, 2nd Oct 2026
  const dmyRegex = new RegExp(
    `\\b([0-9]{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\.?[,]?\\s+(202[6-9])\\b`,
    'i'
  );
  const dmyMatch = text.match(dmyRegex);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = MONTHS[dmyMatch[2].toLowerCase().replace(/\.$/, '')];
    const year = dmyMatch[3];
    if (month) return `${year}-${month}-${day}`;
  }

  // Pattern 4: October 2, 2026 or Oct 2nd 2026
  const mdyRegex = new RegExp(
    `\\b(${MONTH_PATTERN})\\.?\\s+([0-9]{1,2})(?:st|nd|rd|th)?,?\\s+(202[6-9])\\b`,
    'i'
  );
  const mdyMatch = text.match(mdyRegex);
  if (mdyMatch) {
    const month = MONTHS[mdyMatch[1].toLowerCase().replace(/\.$/, '')];
    const day = mdyMatch[2].padStart(2, '0');
    const year = mdyMatch[3];
    if (month) return `${year}-${month}-${day}`;
  }

  // Pattern 5: Day + Month without explicit year (when referenceTodayStr is supplied)
  if (referenceTodayStr) {
    const refYear = parseInt(referenceTodayStr.slice(0, 4), 10);
    const shortDmyRegex = new RegExp(
      `\\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)[,\\s]+([0-9]{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\b`,
      'i'
    );
    const shortMatch = text.match(shortDmyRegex);
    if (shortMatch) {
      const day = shortMatch[1].padStart(2, '0');
      const month = MONTHS[shortMatch[2].toLowerCase()];
      if (month) {
        const candidateThisYear = `${refYear}-${month}-${day}`;
        if (candidateThisYear >= referenceTodayStr) {
          return candidateThisYear;
        }
        return `${refYear + 1}-${month}-${day}`;
      }
    }
  }

  return null;
}

// Match city from text
export function detectCity(text: string, fallbackCity?: string): CityType {
  const lower = text.toLowerCase();
  if (lower.includes('edinburgh') || lower.includes('gogarburn') || lower.includes('leith') || lower.includes('heriot-watt') || lower.includes('napier'))
    return 'Edinburgh';
  if (lower.includes('glasgow') || lower.includes('strathclyde') || lower.includes('clyde'))
    return 'Glasgow';
  if (lower.includes('dundee') || lower.includes('st andrews') || lower.includes('abertay') || lower.includes('cyberquarter') || lower.includes('tayside'))
    return 'Dundee';
  if (lower.includes('aberdeen') || lower.includes('rgu') || lower.includes('robert gordon'))
    return 'Aberdeen';
  if (lower.includes('online') || lower.includes('virtual') || lower.includes('webinar'))
    return 'Virtual';
  if (
    fallbackCity === 'Edinburgh' ||
    fallbackCity === 'Glasgow' ||
    fallbackCity === 'Dundee' ||
    fallbackCity === 'Aberdeen' ||
    fallbackCity === 'Virtual'
  ) {
    return fallbackCity;
  }
  return 'Scotland-wide';
}

// Infer accessType from category and description
export function detectAccessType(category: string, text: string): AccessType {
  const lower = text.toLowerCase();
  if (
    category === 'academic' ||
    /\b(student society|ethical hacking society|compsoc|freshers|undergraduate)\b/i.test(lower)
  ) {
    return 'Student/Academic';
  }
  if (
    /\b(civil service only|public sector only|closed forum|government only|clearance required)\b/i.test(
      lower
    )
  ) {
    return 'Restricted/Civil Service';
  }
  if (
    category === 'industry' ||
    /\b(awards dinner|black tie|sponsorship table|delegate pass|commercial conference)\b/i.test(lower)
  ) {
    return 'Corporate/Paid';
  }
  return 'Open/Public';
}

// Check whether an organizing entity is an official CSC partner
export function isOfficialPartner(partnerName: string): boolean {
  const normalized = partnerName.toLowerCase();
  const partners = [
    'abertay cyberquarter',
    'adarma',
    'codebase',
    'cyber and fraud centre scotland',
    'cyera',
    'digit',
    'edinburgh napier university',
    'enusec',
    'extrahop',
    'freeagent',
    'harvey nash',
    'riversafe',
    'scotlandis',
    'skyscanner',
    'the cyber academy',
    'the data lab',
    'trustpilot',
    'university of strathclyde',
    'wood mackenzie',
    'cyberscotland',
  ];
  return partners.some((p) => normalized.includes(p));
}

// Detect hosting entity classification
export function detectOrganizerType(
  category: string,
  name: string,
  text: string
): 'Community' | 'Commercial' | 'Public Sector' | 'Academic' {
  const combined = `${category} ${name} ${text}`.toLowerCase();
  if (
    /\b(university|college|academic|student society|napier|abertay|strathclyde|enusec)\b/.test(
      combined
    )
  ) {
    return 'Academic';
  }
  if (
    /\b(public sector|police|nhs|council|government|cyber and fraud centre|cyberscotland)\b/.test(
      combined
    )
  ) {
    return 'Public Sector';
  }
  if (
    /\b(conference|summit|expo|commercial|vendor|sponsor|techforce|futurescot|digit|barclays|holyrood|sasig|private|corporate)\b/.test(
      combined
    )
  ) {
    return 'Commercial';
  }
  return 'Community';
}

// Safe HTTP Fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'application/json, application/ld+json, application/rss+xml, application/xml, text/calendar, text/xml, text/html, */*',
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

// Format HH:MM from Date if valid and non-midnight
function extractTimeRange(startIso?: string, endIso?: string): string | undefined {
  if (!startIso || !startIso.includes('T')) return undefined;
  try {
    const start = new Date(startIso);
    if (isNaN(start.getTime())) return undefined;
    const fmt = (d: Date) =>
      d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/London',
      });
    const startTime = fmt(start);
    if (startTime === '00:00') return undefined;
    if (endIso && endIso.includes('T')) {
      const end = new Date(endIso);
      if (!isNaN(end.getTime())) {
        const endTime = fmt(end);
        if (endTime !== '00:00' && endTime !== startTime) {
          return `${startTime} - ${endTime}`;
        }
      }
    }
    return startTime;
  } catch {
    return undefined;
  }
}

// Ingest RSS / Atom Feeds
async function parseRssFeed(feed: RssFeedSource, todayStr: string): Promise<DiscoveredEvent[]> {
  const xml = await fetchWithTimeout(feed.url);
  if (!xml) return [];

  const events: DiscoveredEvent[] = [];
  const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch =
      itemXml.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
      itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch =
      itemXml.match(/<link[^>]+href=["']([^"']+)["']/i) ||
      itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const descMatch =
      itemXml.match(/<(?:description|summary)[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/(?:description|summary)>/i) ||
      itemXml.match(/<(?:description|summary)[^>]*>([\s\S]*?)<\/(?:description|summary)>/i);
    const contentMatch =
      itemXml.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i) ||
      itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);
    const evStartMatch =
      itemXml.match(/<(?:ev:startdate|tribe:start_date|startDate)>([\s\S]*?)<\/(?:ev:startdate|tribe:start_date|startDate)>/i);
    const pubDateMatch = itemXml.match(/<(?:pubDate|published|updated)>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);

    if (!titleMatch || !linkMatch) continue;

    const rawTitle = stripHtml(titleMatch[1]);
    const link = linkMatch[1].trim();
    const rawDesc = descMatch ? stripHtml(descMatch[1]) : '';
    const rawContent = contentMatch ? stripHtml(contentMatch[1]) : '';
    const fullText = `${rawTitle} ${rawDesc} ${rawContent}`;

    let pubRefStr = todayStr;
    if (pubDateMatch) {
      const parsedPub = new Date(pubDateMatch[1]);
      if (!isNaN(parsedPub.getTime())) {
        pubRefStr = parsedPub.toISOString().slice(0, 10);
      }
    }

    // 1. Check structured RSS event date tags first
    let eventDateStr: string | null = null;
    if (evStartMatch) {
      const parsedEv = new Date(evStartMatch[1].trim());
      if (!isNaN(parsedEv.getTime())) {
        eventDateStr = parsedEv.toISOString().slice(0, 10);
      }
    }

    // 2. Extract embedded natural date from link, title, description, or content
    if (!eventDateStr) {
      eventDateStr =
        extractNaturalDate(link, pubRefStr) || extractNaturalDate(fullText, pubRefStr);
    }

    // 3. Fall back to pubDate if no embedded future event date found
    if (!eventDateStr && pubDateMatch) {
      const parsed = new Date(pubDateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        eventDateStr = parsed.toISOString().slice(0, 10);
      }
    }

    if (!eventDateStr || eventDateStr < todayStr) continue;

    const city = detectCity(fullText);
    let location = 'Scotland';
    if (fullText.toLowerCase().includes('gogarburn')) {
      location = 'RBS Gogarburn, Edinburgh';
    } else if (fullText.toLowerCase().includes('dynamic earth')) {
      location = 'Dynamic Earth, Edinburgh';
    } else if (fullText.toLowerCase().includes('eicc')) {
      location = 'EICC, Edinburgh';
    } else if (fullText.toLowerCase().includes('codebase')) {
      location = 'CodeBase, 37a Castle Terrace, Edinburgh';
    } else if (feed.name.includes('Virtual') || city === 'Virtual') {
      location = 'Online (virtual)';
    } else if (city !== 'Scotland-wide') {
      location = city;
    }

    const cleanDesc = rawDesc.replace(/The post .*? appeared first on .*?\./gi, '').trim();

    const pName = feed.name.split('—')[0].trim();
    events.push({
      title: rawTitle,
      date: eventDateStr,
      location,
      city,
      isPartnerEvent: isOfficialPartner(pName),
      partnerName: pName,
      organizerType: detectOrganizerType(feed.category, pName, fullText),
      accessType: detectAccessType(feed.category, fullText),
      meetupUrl: link,
      description: cleanDesc.slice(0, 320) || rawTitle,
      sourceUrl: feed.url,
      sourceType: 'rss',
      isDedicatedScottishSource: true,
    });
  }

  return events;
}

// Ingest WordPress Tribe Events REST API (/wp-json/tribe/events/v1/events)
async function parseWpTribeEvents(
  source: WpFeedSource,
  todayStr: string
): Promise<DiscoveredEvent[]> {
  const url = source.url.includes('start_date=')
    ? source.url
    : `${source.url}${source.url.includes('?') ? '&' : '?'}start_date=${todayStr}`;
  const raw = await fetchWithTimeout(url);
  if (!raw) return [];

  try {
    const data = JSON.parse(raw);
    const items = Array.isArray(data.events) ? data.events : [];
    const events: DiscoveredEvent[] = [];

    for (const item of items) {
      if (!item.title || !item.start_date) continue;

      const eventDateStr = String(item.start_date).slice(0, 10);
      if (eventDateStr < todayStr) continue;

      const title = stripHtml(String(item.title));
      const desc = item.description ? stripHtml(String(item.description)).slice(0, 320) : title;
      const venueName = item.venue?.venue ? stripHtml(String(item.venue.venue)) : '';
      const venueCity = item.venue?.city ? stripHtml(String(item.venue.city)) : '';
      const locationStr =
        [venueName, venueCity].filter(Boolean).join(', ') || 'Scotland';
      const fullText = `${title} ${desc} ${locationStr}`;
      const city = detectCity(fullText);
      const time = extractTimeRange(
        String(item.start_date).replace(' ', 'T'),
        item.end_date ? String(item.end_date).replace(' ', 'T') : undefined
      );

      const pName = source.name.split('—')[0].trim();
      events.push({
        title,
        date: eventDateStr,
        time,
        location: locationStr,
        city,
        isPartnerEvent: isOfficialPartner(pName),
        partnerName: pName,
        organizerType: detectOrganizerType(source.category, pName, fullText),
        accessType: detectAccessType(source.category, fullText),
        meetupUrl: item.url || item.website || source.url,
        description: desc,
        sourceUrl: source.url,
        sourceType: 'wp-api',
        isDedicatedScottishSource: true,
      });
    }

    return events;
  } catch {
    return [];
  }
}

// Ingest iCal Feeds (with RFC 5545 line unfolding)
async function parseICalFeed(feed: ICalFeedSource, todayStr: string): Promise<DiscoveredEvent[]> {
  const ics = await fetchWithTimeout(feed.url);
  if (!ics) return [];

  // RFC 5545 §3.1: unfold lines split with CRLF/LF followed by a single linear whitespace character
  const unfoldedIcs = ics.replace(/\r?\n[ \t]/g, '');

  const events: DiscoveredEvent[] = [];
  const eventBlocks = unfoldedIcs.split(/BEGIN:VEVENT/i).slice(1);

  for (const block of eventBlocks) {
    const summaryMatch = block.match(/SUMMARY(?::|;[^:]*:)(.*)/i);
    const dtstartMatch = block.match(/DTSTART(?::|;[^:]*:)([0-9]{8}(?:T[0-9]{6}Z?)?)/i);
    const locationMatch = block.match(/LOCATION(?::|;[^:]*:)(.*)/i);
    const descMatch = block.match(/DESCRIPTION(?::|;[^:]*:)(.*)/i);
    const urlMatch = block.match(/URL(?::|;[^:]*:)(.*)/i);

    if (!summaryMatch || !dtstartMatch) continue;

    const rawDate = dtstartMatch[1]; // YYYYMMDD or YYYYMMDDTHHMMSSZ
    const eventDateStr = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

    if (eventDateStr < todayStr) continue;

    const rawTitle = summaryMatch[1].replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
    const rawLocation = locationMatch
      ? locationMatch[1].replace(/\\,/g, ',').replace(/\\;/g, ';').trim()
      : 'Scotland';
    const rawUrl = urlMatch ? urlMatch[1].trim() : feed.url;
    const rawDesc = descMatch
      ? stripHtml(descMatch[1].replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';'))
      : '';

    const pName = feed.name.split('—')[0].trim();
    events.push({
      title: rawTitle,
      date: eventDateStr,
      location: rawLocation || 'Scotland',
      city: detectCity(`${rawTitle} ${rawLocation} ${feed.name}`),
      isPartnerEvent: isOfficialPartner(pName),
      partnerName: pName,
      organizerType: detectOrganizerType(feed.category, pName, `${rawTitle} ${rawDesc}`),
      accessType: detectAccessType(feed.category, `${rawTitle} ${rawDesc}`),
      meetupUrl: rawUrl,
      description:
        rawDesc.length > 280
          ? `${rawDesc.slice(0, 280).replace(/\s+\S*$/, '')}...`
          : rawDesc || `Upcoming community meetup organized by ${feed.name}.`,
      sourceUrl: feed.url,
      sourceType: 'ical',
      isDedicatedScottishSource: true,
    });
  }

  return events;
}

// Ingest Squarespace Events JSON API
async function parseSquarespaceJson(
  source: JsonFeedSource,
  todayStr: string
): Promise<DiscoveredEvent[]> {
  const raw = await fetchWithTimeout(source.url);
  if (!raw) return [];

  try {
    const data = JSON.parse(raw);
    const events: DiscoveredEvent[] = [];
    const items = [...(data.upcoming || []), ...(data.items || [])];
    const baseOrigin = new URL(source.url).origin;

    for (const item of items) {
      if (!item.title || !item.startDate) continue;

      const eventDateStr = new Date(item.startDate).toISOString().slice(0, 10);
      if (eventDateStr < todayStr) continue;

      const title = stripHtml(item.title);
      const desc = item.body ? stripHtml(item.body).slice(0, 300) : title;
      const fullUrl = item.fullUrl
        ? item.fullUrl.startsWith('http')
          ? item.fullUrl
          : `${baseOrigin}${item.fullUrl}`
        : source.url;
      const partnerName = source.name.split('—')[0].trim();
      const defaultLoc = partnerName.includes('CodeBase')
        ? 'CodeBase, 37a Castle Terrace, Edinburgh'
        : 'Abertay cyberQuarter, Dundee';

      events.push({
        title,
        date: eventDateStr,
        location: item.location?.addressTitle || defaultLoc,
        city: detectCity(`${title} ${item.location?.addressLine2 || ''} ${defaultLoc}`),
        isPartnerEvent: isOfficialPartner(partnerName),
        partnerName,
        organizerType: detectOrganizerType(source.category, partnerName, `${title} ${desc}`),
        accessType: detectAccessType(source.category, `${title} ${desc}`),
        meetupUrl: fullUrl,
        description: desc,
        sourceUrl: source.url,
        sourceType: 'squarespace',
        isDedicatedScottishSource: true,
      });
    }
    return events;
  } catch {
    return [];
  }
}

// Walk arbitrary parsed JSON-LD structures to collect Event nodes
function collectJsonLdEvents(node: unknown, results: Record<string, unknown>[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectJsonLdEvents(child, results);
    return;
  }
  const obj = node as Record<string, unknown>;
  const rawType = obj['@type'];
  const types = Array.isArray(rawType) ? rawType.map(String) : rawType ? [String(rawType)] : [];
  if (types.some((t) => /Event$/i.test(t))) {
    results.push(obj);
  }
  if (obj['@graph']) collectJsonLdEvents(obj['@graph'], results);
  if (obj.itemListElement) collectJsonLdEvents(obj.itemListElement, results);
  if (obj.item) collectJsonLdEvents(obj.item, results);
  if (obj.subEvent) collectJsonLdEvents(obj.subEvent, results);
}

// Ingest HTML Seed URLs for Schema.org application/ld+json Event entities
async function parseHtmlSeedUrl(
  seed: SeedUrlSource,
  todayStr: string
): Promise<DiscoveredEvent[]> {
  const html = await fetchWithTimeout(seed.url, 6500);
  if (!html) return [];

  const events: DiscoveredEvent[] = [];
  const ldScriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  const ldNodes: Record<string, unknown>[] = [];

  while ((match = ldScriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      collectJsonLdEvents(parsed, ldNodes);
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }

  for (const node of ldNodes) {
    const rawName = typeof node.name === 'string' ? stripHtml(node.name) : '';
    const rawStart = typeof node.startDate === 'string' ? node.startDate : '';
    const rawEnd = typeof node.endDate === 'string' ? node.endDate : undefined;
    if (!rawName || !rawStart) continue;

    let eventDateStr: string | null = null;
    const parsedStart = new Date(rawStart);
    if (!isNaN(parsedStart.getTime())) {
      eventDateStr = parsedStart.toISOString().slice(0, 10);
    } else {
      eventDateStr = extractNaturalDate(rawStart, todayStr);
    }
    if (!eventDateStr || eventDateStr < todayStr) continue;

    const rawUrl =
      typeof node.url === 'string' && isValidUrl(node.url) ? node.url : seed.url;
    const rawDesc =
      typeof node.description === 'string' && node.description.trim()
        ? stripHtml(node.description).slice(0, 320)
        : `Upcoming event hosted by ${seed.name}.`;

    let locName = seed.city;
    if (node.location && typeof node.location === 'object') {
      const locObj = node.location as Record<string, unknown>;
      const placeName = typeof locObj.name === 'string' ? stripHtml(locObj.name) : '';
      let locality = '';
      if (locObj.address && typeof locObj.address === 'object') {
        const addr = locObj.address as Record<string, unknown>;
        locality =
          typeof addr.addressLocality === 'string'
            ? stripHtml(addr.addressLocality)
            : typeof addr.streetAddress === 'string'
              ? stripHtml(addr.streetAddress)
              : '';
      } else if (typeof locObj.address === 'string') {
        locality = stripHtml(locObj.address);
      }
      locName = [placeName, locality].filter(Boolean).join(', ') || seed.city;
    }

    const fullText = `${rawName} ${rawDesc} ${locName}`;
    const city = detectCity(fullText, seed.city);

    const pName = seed.name.split('—')[0].trim();
    events.push({
      title: rawName,
      date: eventDateStr,
      time: extractTimeRange(rawStart, rawEnd),
      location: locName || city,
      city,
      isPartnerEvent: isOfficialPartner(pName),
      partnerName: pName,
      organizerType: detectOrganizerType(seed.category, pName, fullText),
      accessType: detectAccessType(seed.category, fullText),
      meetupUrl: rawUrl,
      description: rawDesc,
      sourceUrl: seed.url,
      sourceType: 'ld-json',
      isDedicatedScottishSource: !isUkWideSourceUrl(seed.url),
    });
  }

  // Fallback: If 0 JSON-LD events were found on this seed page and --ai (local Ollama) is active,
  // run a lightweight NLP pass over date-bearing HTML snippets on Scottish seed pages.
  if (events.length === 0 && localAiOnline && !isUkWideSourceUrl(seed.url)) {
    const aiEvents = await extractSeedEventsWithLocalAi(html, seed, todayStr);
    events.push(...aiEvents);
  }

  return events;
}

// Check if local Ollama daemon on 127.0.0.1:11434 is reachable
async function checkLocalAiAvailable(): Promise<boolean> {
  try {
    const parsed = new URL(LOCAL_AI_BASE_URL);
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return false;
    const res = await fetch(`${LOCAL_AI_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Call local Ollama OpenAI-compatible JSON completion endpoint on loopback
async function queryLocalAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 18000
): Promise<T | null> {
  try {
    const parsed = new URL(LOCAL_AI_BASE_URL);
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return null;

    const res = await fetch(`${LOCAL_AI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return null;
    return JSON.parse(rawContent) as T;
  } catch {
    return null;
  }
}

interface AiExtractedSeedPayload {
  events?: Array<{
    title?: string;
    date?: string;
    time?: string;
    location?: string;
    city?: string;
    accessType?: string;
    description?: string;
    isCyberRelevant?: boolean;
  }>;
}

// Extract structured events from unstructured HTML seed pages using local Ollama NLP
async function extractSeedEventsWithLocalAi(
  rawHtml: string,
  seed: SeedUrlSource,
  todayStr: string
): Promise<DiscoveredEvent[]> {
  // Strip script/style/svg/nav/footer blocks before extracting text
  const cleanedText = stripHtml(
    rawHtml
      .replace(/<(script|style|svg|nav|footer|header|noscript)[\s\S]*?<\/\1>/gi, ' ')
  );

  // Only invoke local AI if the page text actually mentions a future year or upcoming event cues
  if (
    !/\b(2026|2027)\b/.test(cleanedText) ||
    !/\b(cyber|security|infosec|hacking|owasp|resilience|fraud|ciso|meetup|conference|workshop|summit)\b/i.test(
      cleanedText
    )
  ) {
    return [];
  }

  const snippet = cleanedText.slice(0, 3200);
  const systemPrompt =
    `You extract upcoming Scottish cybersecurity/infosec events from webpage text. Today is ${todayStr}. ` +
    `Return ONLY valid JSON matching: {"events":[{"title":"string","date":"YYYY-MM-DD","time":"HH:MM - HH:MM or empty","location":"venue","city":"Edinburgh|Glasgow|Dundee|Aberdeen|Virtual|Scotland-wide","accessType":"Open/Public|Corporate/Paid|Student/Academic|Restricted/Civil Service","description":"2 factual sentences","isCyberRelevant":true}]}. ` +
    `Never invent dates or events. Omit past events (< ${todayStr}) or general news articles.`;

  const userPrompt = `Source: ${seed.name} (${seed.city}, ${seed.url})\nText:\n${snippet}`;
  const result = await queryLocalAiJson<AiExtractedSeedPayload>(systemPrompt, userPrompt, 15000);
  if (!result || !Array.isArray(result.events)) return [];

  const extracted: DiscoveredEvent[] = [];
  for (const item of result.events) {
    if (!item.title || !item.date || item.isCyberRelevant === false) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || item.date < todayStr) continue;

    const fullText = `${item.title} ${item.description || ''} ${item.location || ''}`;
    const city = detectCity(fullText, (item.city as CityType) || seed.city);

    const pName = seed.name.split('—')[0].trim();
    extracted.push({
      title: stripHtml(item.title).slice(0, 110),
      date: item.date,
      time: item.time && /\d{1,2}:\d{2}/.test(item.time) ? item.time.trim() : undefined,
      location: item.location ? stripHtml(item.location) : city,
      city,
      isPartnerEvent: isOfficialPartner(pName),
      partnerName: pName,
      organizerType: detectOrganizerType(seed.category, pName, fullText),
      accessType: detectAccessType(seed.category, fullText),
      meetupUrl: seed.url,
      description: item.description ? stripHtml(item.description).slice(0, 320) : item.title,
      sourceUrl: seed.url,
      sourceType: 'ld-json',
      isDedicatedScottishSource: true,
    });
  }
  return extracted;
}

interface AiRefinementPayload {
  isActualFutureEvent?: boolean;
  isCyberRelevant?: boolean;
  cleanTitle?: string;
  cleanDescription?: string;
  city?: CityType;
  accessType?: AccessType;
}

// Refine & verify a candidate event using local Ollama NLP
async function refineCandidateWithLocalAi(
  ev: DiscoveredEvent,
  todayStr: string
): Promise<{ keep: boolean; event: DiscoveredEvent }> {
  const systemPrompt =
    `You are the Cyber Scotland Connect event curator. Today is ${todayStr}. ` +
    `Evaluate this candidate Scottish event and return JSON: ` +
    `{"isActualFutureEvent":boolean,"isCyberRelevant":boolean,"cleanTitle":"string","cleanDescription":"2 concise factual sentences without HTML or promotional fluff","city":"Edinburgh|Glasgow|Dundee|Aberdeen|Virtual|Scotland-wide","accessType":"Open/Public|Corporate/Paid|Student/Academic|Restricted/Civil Service"}. ` +
    `Set isActualFutureEvent=false if it is a news recap, award winner announcement, or job listing. ` +
    `Set isCyberRelevant=true for cybersecurity, infosec, hacking, digital resilience, fraud, OT/ICS, AI security, or public sector security events.`;

  const userPrompt = JSON.stringify({
    title: ev.title,
    date: ev.date,
    location: ev.location,
    city: ev.city,
    partnerName: ev.partnerName,
    description: ev.description,
  });

  const refined = await queryLocalAiJson<AiRefinementPayload>(systemPrompt, userPrompt, 15000);
  if (!refined) return { keep: true, event: ev };

  if (refined.isActualFutureEvent === false || refined.isCyberRelevant === false) {
    return { keep: false, event: ev };
  }

  const validCities: CityType[] = [
    'Edinburgh',
    'Glasgow',
    'Dundee',
    'Aberdeen',
    'Virtual',
    'Scotland-wide',
  ];
  const validAccess: AccessType[] = [
    'Open/Public',
    'Corporate/Paid',
    'Student/Academic',
    'Restricted/Civil Service',
  ];

  return {
    keep: true,
    event: {
      ...ev,
      title: refined.cleanTitle?.trim() || ev.title,
      description: refined.cleanDescription?.trim() || ev.description,
      city:
        refined.city && validCities.includes(refined.city) ? refined.city : ev.city,
      accessType:
        refined.accessType && validAccess.includes(refined.accessType)
          ? refined.accessType
          : ev.accessType,
    },
  };
}

// Ingest Bluesky Profile RSS
async function parseBlueskyFeed(
  source: BlueskyFeedSource,
  todayStr: string
): Promise<DiscoveredEvent[]> {
  const xml = await fetchWithTimeout(source.rssUrl);
  if (!xml) return [];

  const events: DiscoveredEvent[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);

    if (!descMatch || !linkMatch) continue;

    const postText = stripHtml(descMatch[1]);
    const link = linkMatch[1].trim();

    let pubRefStr = todayStr;
    if (pubDateMatch) {
      const parsedPub = new Date(pubDateMatch[1]);
      if (!isNaN(parsedPub.getTime())) {
        pubRefStr = parsedPub.toISOString().slice(0, 10);
      }
    }

    const hasEventKeyword =
      /\b(meetup|gathering|talk|conference|tickets|doors open|tickets live|cfp|register|symposium|workshop)\b/i.test(
        postText
      );
    const hasScotlandKeyword =
      /\b(scotland|scottish|edinburgh|glasgow|dundee|aberdeen|st andrews|inverness|stirling|perth|leith|codebase|gogarburn|napier|abertay|strathclyde)\b/i.test(
        postText
      );

    if (!hasEventKeyword || !hasScotlandKeyword) continue;

    const eventDateStr = extractNaturalDate(postText, pubRefStr);
    if (!eventDateStr || eventDateStr < todayStr) continue;

    events.push({
      title: postText.slice(0, 60).replace(/\n/g, ' ') + '...',
      date: eventDateStr,
      location: 'Scotland',
      city: detectCity(postText),
      isPartnerEvent: isOfficialPartner(source.name),
      partnerName: source.name,
      organizerType: detectOrganizerType('community', source.name, postText),
      accessType: 'Open/Public',
      meetupUrl: link,
      description: postText.slice(0, 300),
      sourceUrl: source.rssUrl,
      sourceType: 'bluesky',
      isDedicatedScottishSource: true,
    });
  }

  return events;
}

// Helper: Run async tasks with bounded concurrency
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Main Execution
async function main() {
  const todayStr = new Date().toISOString().slice(0, 10);

  if (isAiMode) {
    localAiOnline = await checkLocalAiAvailable();
  }

  if (!isJsonMode) {
    console.log(`\n=================================================`);
    console.log(`  CSC Event Discovery Engine v2.2`);
    console.log(
      `  Date: ${todayStr} | Mode: ${isWriteMode ? 'WRITE' : 'DRY-RUN'} | Local AI (${LOCAL_AI_MODEL}): ${
        isAiMode ? (localAiOnline ? 'ONLINE' : 'OFFLINE (fallback)') : 'DISABLED'
      }`
    );
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

  // 2. Ingest WordPress Tribe Events API feeds
  for (const feed of config.wpFeeds || []) {
    if (!isJsonMode && isVerbose) process.stdout.write(`  [WP-API] Fetching ${feed.name}... `);
    const found = await parseWpTribeEvents(feed, todayStr);
    if (!isJsonMode && isVerbose) console.log(`${found.length} items`);
    candidateEvents.push(...found);
  }

  // 3. Ingest iCal feeds
  for (const feed of config.iCalFeeds || []) {
    if (!isJsonMode && isVerbose) process.stdout.write(`  [iCal] Fetching ${feed.name}... `);
    const found = await parseICalFeed(feed, todayStr);
    if (!isJsonMode && isVerbose) console.log(`${found.length} items`);
    candidateEvents.push(...found);
  }

  // 4. Ingest JSON API feeds (Squarespace, etc.)
  for (const feed of config.jsonFeeds || []) {
    if (!isJsonMode && isVerbose) process.stdout.write(`  [JSON] Fetching ${feed.name}... `);
    const found = await parseSquarespaceJson(feed, todayStr);
    if (!isJsonMode && isVerbose) console.log(`${found.length} items`);
    candidateEvents.push(...found);
  }

  // 5. Ingest Bluesky feeds
  for (const source of config.blueskyFeeds || []) {
    if (!isJsonMode && isVerbose) process.stdout.write(`  [Bluesky] Fetching @${source.handle}... `);
    const found = await parseBlueskyFeed(source, todayStr);
    if (!isJsonMode && isVerbose) console.log(`${found.length} items`);
    candidateEvents.push(...found);
  }

  // 6. Ingest Seed URLs concurrently for Schema.org ld+json Event payloads
  const seeds = config.seedUrls || [];
  if (seeds.length > 0) {
    if (!isJsonMode && isVerbose) {
      console.log(`  [Seed LD+JSON] Scanning ${seeds.length} seed pages (concurrency: 6)...`);
    }
    const seedResults = await mapConcurrent(seeds, 6, (seed) => parseHtmlSeedUrl(seed, todayStr));
    for (const found of seedResults) {
      candidateEvents.push(...found);
    }
  }

  // Deduplicate and filter candidates
  const newEvents: DiscoveredEvent[] = [];
  const seenInRun = new Set<string>();

  for (const ev of candidateEvents) {
    const fullText = `${ev.title} ${ev.description} ${ev.location} ${ev.partnerName}`.toLowerCase();
    const eventContentText = `${ev.title} ${ev.description}`;

    // 1. Check exclude keywords
    if (config.filters.excludeKeywords?.some((kw) => fullText.includes(kw.toLowerCase()))) {
      continue;
    }

    // 2. Check Scotland location requirement
    if (config.filters.requireScotlandLocation) {
      const hasLocationKeyword = config.filters.locationKeywords?.some((kw) =>
        fullText.includes(kw.toLowerCase())
      );
      if (!hasLocationKeyword && !ev.isDedicatedScottishSource) {
        continue;
      }
    }

    // 3. Check cyber relevance (word-boundary match against event title + description, never partnerName)
    if (config.filters.requireCyberRelevance) {
      const isRelevant = config.filters.cyberKeywords?.some((kw) => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(eventContentText);
      });
      if (!isRelevant) continue;
    }

    // 4. Skip editorial news articles covering announcements or awards recaps
    if (/\b(announces|announced for|reveals|moves to|shortlist|winners announced)\b/i.test(ev.title)) {
      continue;
    }

    // Clean title (remove trailing 'Registration')
    ev.title = ev.title.replace(/\s+Registration$/i, '').trim();

    const slug = `${ev.date}-${slugify(ev.title)}`;
    const normalizedKey = `${ev.date}-${normalizeTitle(ev.title)}`;

    if (existingEvents.has(slug) || existingEvents.has(normalizedKey)) {
      continue;
    }

    // Check if an event on the same date with similar title was already seen in this run
    let isDuplicateInRun = false;
    for (const seenKey of seenInRun) {
      if (seenKey.startsWith(ev.date)) {
        const evWords = new Set(
          normalizeTitle(ev.title)
            .split(' ')
            .filter((w) => w.length > 3)
        );
        const seenWords = seenKey.split(' ').filter((w) => w.length > 3);
        const overlap = seenWords.filter((w) => evWords.has(w)).length;
        if (overlap >= 2) {
          isDuplicateInRun = true;
          break;
        }
      }
    }
    if (isDuplicateInRun) continue;

    seenInRun.add(normalizedKey);

    if (localAiOnline) {
      if (!isJsonMode && isVerbose) {
        process.stdout.write(`  [AI-NLP] Verifying & polishing "${ev.title}"... `);
      }
      const { keep, event: polished } = await refineCandidateWithLocalAi(ev, todayStr);
      if (!isJsonMode && isVerbose) {
        console.log(keep ? 'KEEP' : 'SKIP (filtered by AI)');
      }
      if (!keep) continue;
      newEvents.push(polished);
    } else {
      newEvents.push(ev);
    }
  }

  if (isJsonMode) {
    console.log(JSON.stringify(newEvents, null, 2));
    return;
  }

  const totalSourcesCount =
    (config.rssFeeds?.length || 0) +
    (config.wpFeeds?.length || 0) +
    (config.iCalFeeds?.length || 0) +
    (config.blueskyFeeds?.length || 0) +
    (config.jsonFeeds?.length || 0) +
    (config.seedUrls?.length || 0);

  console.log(`\n-------------------------------------------------`);
  console.log(`📊 Ingestion Complete:`);
  console.log(`   Sources Checked: ${totalSourcesCount} sources (RSS, WP-API, iCal, JSON, Bluesky, LD+JSON Seeds)`);
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
    console.log(`    Source: ${ev.meetupUrl} [${ev.sourceType}]`);
    console.log(`    File:   src/content/events/${filename}`);

    if (isWriteMode) {
      const targetFile = path.join(EVENTS_DIR, filename);
      const isMeetup = (() => {
        try {
          const host = new URL(ev.meetupUrl).hostname.toLowerCase();
          return host === 'meetup.com' || host.endsWith('.meetup.com');
        } catch {
          return false;
        }
      })();
      const urlFrontmatter = isValidUrl(ev.meetupUrl)
        ? isMeetup
          ? `meetupUrl: '${ev.meetupUrl}'\n`
          : `registrationUrl: '${ev.meetupUrl}'\n`
        : '';
      const content = `---
title: '${ev.title.replace(/'/g, "''")}'
date: ${ev.date}
${ev.time ? `time: '${ev.time}'\n` : ''}location: '${ev.location.replace(/'/g, "''")}'
${isValidUrl(ev.locationUrl) ? `locationUrl: '${ev.locationUrl}'\n` : ''}city: '${ev.city}'
isPartnerEvent: ${ev.isPartnerEvent}
partnerName: '${ev.partnerName.replace(/'/g, "''")}'
organizerType: '${ev.organizerType || 'Community'}'
accessType: '${ev.accessType || 'Open/Public'}'
${urlFrontmatter}accessibility:
  stepFree: null
  hearingLoop: null
  notes: '${ev.city === 'Virtual' ? 'Online event. Check registration link for captioning and remote accommodations.' : 'Check organizer registration link for verified venue accessibility accommodations.'}'
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

if (import.meta.main) {
  main().catch((err) => {
    console.error(`❌ Unexpected error:`, err);
    process.exit(1);
  });
}
