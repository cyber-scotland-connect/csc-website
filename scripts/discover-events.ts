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
import {
  hasScottishPostcode,
  isNonScottishLocation,
} from '../src/utils/scottish-geography';
import { isOfficialPartnerOrSponsor } from '../src/utils/partner-registry';

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
  partnerName?: string;
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

interface ExistingEventsIndex {
  exactSlugs: Set<string>;
  normalizedKeys: Set<string>;
  urls: Set<string>;
  eventbriteIds: Set<string>;
  dateTitleWords: Map<string, Array<{ title: string; words: Set<string> }>>;
}

function normalizeUrlKey(raw?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return raw.split('?')[0].replace(/\/+$/, '').toLowerCase();
  }
}

function extractEventbriteId(raw?: string): string | null {
  if (!raw) return null;
  const match = raw.match(/(?:tickets-|\/e\/[a-z0-9-]+-)([0-9]{9,})/i);
  return match ? match[1] : null;
}

const TITLE_DEDUP_STOPWORDS = new Set([
  'about',
  'aberdeen',
  'after',
  'annual',
  'before',
  'between',
  'business',
  'chapter',
  'cloud',
  'community',
  'conference',
  'cyber',
  'cybersecurity',
  'digital',
  'dundee',
  'edinburgh',
  'event',
  'events',
  'from',
  'gathering',
  'glasgow',
  'group',
  'hack',
  'hacking',
  'highlands',
  'info',
  'information',
  'infosec',
  'into',
  'meetup',
  'meeting',
  'monthly',
  'more',
  'national',
  'network',
  'networking',
  'north',
  'online',
  'organisation',
  'organisations',
  'organization',
  'over',
  'partner',
  'portal',
  'programme',
  'resilience',
  'scotland',
  'scottish',
  'security',
  'seminar',
  'series',
  'session',
  'sessions',
  'showcase',
  'society',
  'summit',
  'symposium',
  'tech',
  'technology',
  'that',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'threat',
  'threats',
  'through',
  'training',
  'under',
  'user',
  'virtual',
  'webinar',
  'week',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'within',
  'workshop',
  'your',
]);

export function getSignificantTitleWords(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(' ')
      .filter((w) => w.length > 3 && !TITLE_DEDUP_STOPWORDS.has(w))
  );
}

// Load existing events to avoid duplicates
function loadExistingEvents(): ExistingEventsIndex {
  const index: ExistingEventsIndex = {
    exactSlugs: new Set<string>(),
    normalizedKeys: new Set<string>(),
    urls: new Set<string>(),
    eventbriteIds: new Set<string>(),
    dateTitleWords: new Map(),
  };

  if (!fs.existsSync(EVENTS_DIR)) return index;

  const files = fs.readdirSync(EVENTS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  for (const file of files) {
    index.exactSlugs.add(file.replace(/\.mdx?$/, ''));
    try {
      const content = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf-8');
      const titleMatch = content.match(/title:\s*["']?([^"'\n\r]+)["']?/);
      const dateMatch = content.match(/date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      const regMatch = content.match(/registrationUrl:\s*["']?([^"'\n\r]+)["']?/);
      const meetupMatch = content.match(/meetupUrl:\s*["']?([^"'\n\r]+)["']?/);

      if (titleMatch && dateMatch) {
        const rawTitle = titleMatch[1].trim();
        const dateStr = dateMatch[1];
        index.normalizedKeys.add(`${dateStr}-${normalizeTitle(rawTitle)}`);

        const words = getSignificantTitleWords(rawTitle);
        const existingForDate = index.dateTitleWords.get(dateStr) || [];
        existingForDate.push({ title: rawTitle, words });
        index.dateTitleWords.set(dateStr, existingForDate);
      }

      for (const u of [regMatch?.[1], meetupMatch?.[1]]) {
        const norm = normalizeUrlKey(u);
        if (norm) index.urls.add(norm);
        const eb = extractEventbriteId(u);
        if (eb) index.eventbriteIds.add(eb);
      }
    } catch {
      // Ignore read errors
    }
  }
  return index;
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

// Helper: Check if a seed URL belongs to a UK-wide organization or regional search directory
// (where individual listings may bleed across the border into Northern England)
// Uses parsed URL.hostname to satisfy CodeQL js/incomplete-url-substring-sanitization
const UK_WIDE_DOMAINS = ['theiet.org', 'ciisec.org', 'thesasig.com'] as const;
const EVENTBRITE_DOMAINS = ['eventbrite.co.uk', 'eventbrite.com'] as const;
function isUkWideSourceUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const pathLower = parsed.pathname.toLowerCase();
    // Eventbrite regional directory searches (/d/...) include "nearby" events up to ~100 miles away
    // (e.g. Newcastle & Gateshead on the Edinburgh search page), so each listing must independently prove Scottish location.
    if (
      EVENTBRITE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`)) &&
      pathLower.startsWith('/d/')
    ) {
      return true;
    }
    // If the path specifically targets Scotland (e.g. /event/scotland-sasig/), treat as dedicated Scottish source
    if (pathLower.includes('scotland')) {
      return false;
    }
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

export const MAX_FUTURE_DAYS = 366;

export function getMaxFutureDateStr(refDate: string | Date = new Date()): string {
  const base = typeof refDate === 'string' ? new Date(refDate) : refDate;
  const target = new Date(base.getTime() + MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

export const GENERIC_TICKETING_PLATFORMS = new Set([
  'eventbrite',
  'meetup',
  'luma',
  'ticketmaster',
  'ticketing',
]);

export function sanitizePartnerName(name?: string): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  if (GENERIC_TICKETING_PLATFORMS.has(trimmed.toLowerCase())) {
    return undefined;
  }
  return trimmed;
}

// Check whether an organizing entity is an official CSC partner
export function isOfficialPartner(partnerName: string): boolean {
  if (!partnerName) return false;
  return isOfficialPartnerOrSponsor(partnerName);
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

interface SourceHealthEntry {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
}

const sourceHealthLog: SourceHealthEntry[] = [];

// Safe HTTP Fetch with timeout and source health tracking
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
    if (!res.ok) {
      sourceHealthLog.push({ url, ok: false, status: res.status });
      return null;
    }
    sourceHealthLog.push({ url, ok: true, status: res.status });
    return await res.text();
  } catch (err) {
    const msg = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network-error';
    sourceHealthLog.push({ url, ok: false, error: msg });
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
      itemXml.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i) ||
      itemXml.match(/<link[^>]+href=["']([^"']+)["']/i) ||
      itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i) ||
      itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const descMatch =
      itemXml.match(/<(?:description|summary)[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/(?:description|summary)>/i) ||
      itemXml.match(/<(?:description|summary)[^>]*>([\s\S]*?)<\/(?:description|summary)>/i);
    const contentMatch =
      itemXml.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i) ||
      itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);
    const evStartMatch =
      itemXml.match(/<(?:ev:startdate|tribe:start_date|startDate)>([\s\S]*?)<\/(?:ev:startdate|tribe:start_date|startDate)>/i);
    const evEndMatch =
      itemXml.match(/<(?:ev:enddate|tribe:end_date|endDate)>([\s\S]*?)<\/(?:ev:enddate|tribe:end_date|endDate)>/i);
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
    let eventTimeStr: string | undefined;
    if (evStartMatch) {
      const rawEvStart = evStartMatch[1].trim();
      const rawEvEnd = evEndMatch ? evEndMatch[1].trim() : undefined;
      const parsedEv = new Date(rawEvStart);
      if (!isNaN(parsedEv.getTime())) {
        eventDateStr = parsedEv.toISOString().slice(0, 10);
        eventTimeStr = extractTimeRange(
          rawEvStart.replace(' ', 'T'),
          rawEvEnd ? rawEvEnd.replace(' ', 'T') : undefined
        );
      }
    }

    // 2. Extract embedded natural date from link, title, description, or content
    if (!eventDateStr) {
      eventDateStr =
        extractNaturalDate(link, pubRefStr) || extractNaturalDate(fullText, pubRefStr);
    }

    // 3. Only fall back to pubDate if it is strictly in the future (> todayStr),
    // which some WordPress event feeds use to encode future event dates.
    // Never treat an article published today or earlier (<= todayStr) as an event date.
    if (!eventDateStr && pubDateMatch) {
      const parsed = new Date(pubDateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        const candidatePubDate = parsed.toISOString().slice(0, 10);
        if (candidatePubDate > todayStr) {
          eventDateStr = candidatePubDate;
        }
      }
    }

    const maxFutureDateStr = getMaxFutureDateStr(todayStr);
    if (!eventDateStr || eventDateStr < todayStr || eventDateStr > maxFutureDateStr) continue;

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

    const pName = sanitizePartnerName(feed.name.split('—')[0].trim());
    events.push({
      title: rawTitle,
      date: eventDateStr,
      time: eventTimeStr,
      location,
      city,
      isPartnerEvent: isOfficialPartner(pName || ''),
      partnerName: pName,
      organizerType: detectOrganizerType(feed.category, pName || '', fullText),
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

// Ingest WordPress Events REST API (supports both Tribe Events /wp-json/tribe/events/v1/events and WP v2 /wp-json/wp/v2/event CPTs)
async function parseWpTribeEvents(
  source: WpFeedSource,
  todayStr: string
): Promise<DiscoveredEvent[]> {
  const isWpV2Cpt = source.url.includes('/wp-json/wp/v2/');
  const url =
    isWpV2Cpt || source.url.includes('start_date=')
      ? source.url
      : `${source.url}${source.url.includes('?') ? '&' : '?'}start_date=${todayStr}`;
  const raw = await fetchWithTimeout(url);
  if (!raw) return [];

  try {
    const data = JSON.parse(raw);
    const maxFutureDateStr = getMaxFutureDateStr(todayStr);
    const pName = sanitizePartnerName(source.name.split('—')[0].trim());
    const events: DiscoveredEvent[] = [];

    // Format A: WordPress /wp-json/wp/v2/<event-cpt> array
    if (Array.isArray(data)) {
      for (const item of data) {
        const rawTitle = item.title?.rendered ? stripHtml(String(item.title.rendered)) : '';
        if (!rawTitle) continue;

        const rawContent = item.content?.rendered ? stripHtml(String(item.content.rendered)) : '';
        const rawExcerpt = item.excerpt?.rendered ? stripHtml(String(item.excerpt.rendered)) : '';
        const desc = (rawExcerpt || rawContent || rawTitle).slice(0, 320);
        const link = typeof item.link === 'string' && isValidUrl(item.link) ? item.link : source.url;
        const fullText = `${rawTitle} ${rawExcerpt} ${rawContent}`;

        const pubRefStr =
          typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.date)
            ? item.date.slice(0, 10)
            : todayStr;

        // Extract event date from ACF fields if present, or natural date in title/content, or future post date
        const acfDate =
          typeof item.acf?.event_date === 'string' || typeof item.acf?.start_date === 'string'
            ? extractNaturalDate(String(item.acf.event_date || item.acf.start_date), pubRefStr)
            : null;
        let eventDateStr =
          acfDate ||
          extractNaturalDate(link, pubRefStr) ||
          extractNaturalDate(fullText, pubRefStr);

        if (!eventDateStr && pubRefStr > todayStr) {
          eventDateStr = pubRefStr;
        }
        if (!eventDateStr || eventDateStr < todayStr || eventDateStr > maxFutureDateStr) continue;

        const city = detectCity(fullText);
        const locationStr =
          typeof item.acf?.location === 'string' && item.acf.location.trim()
            ? stripHtml(item.acf.location)
            : city !== 'Scotland-wide'
              ? city
              : 'Scotland';

        events.push({
          title: rawTitle,
          date: eventDateStr,
          location: locationStr,
          city,
          isPartnerEvent: isOfficialPartner(pName || ''),
          partnerName: pName,
          organizerType: detectOrganizerType(source.category, pName || '', fullText),
          accessType: detectAccessType(source.category, fullText),
          meetupUrl: link,
          description: desc,
          sourceUrl: source.url,
          sourceType: 'wp-api',
          isDedicatedScottishSource: true,
        });
      }
      return events;
    }

    // Format B: Tribe Events /wp-json/tribe/events/v1/events
    const items = Array.isArray(data.events) ? data.events : [];

    for (const item of items) {
      if (!item.title || !item.start_date) continue;

      const eventDateStr = String(item.start_date).slice(0, 10);
      if (eventDateStr < todayStr || eventDateStr > maxFutureDateStr) continue;

      const title = stripHtml(String(item.title));
      const desc = item.description ? stripHtml(String(item.description)).slice(0, 320) : title;
      const venueName = item.venue?.venue ? stripHtml(String(item.venue.venue)) : '';
      const venueAddress = item.venue?.address ? stripHtml(String(item.venue.address)) : '';
      const venueCity = item.venue?.city ? stripHtml(String(item.venue.city)) : '';
      const venueZip = item.venue?.zip ? stripHtml(String(item.venue.zip)) : '';
      const locationStr =
        [venueName, venueAddress, venueCity, venueZip].filter(Boolean).join(', ') || 'Scotland';
      const fullText = `${title} ${desc} ${locationStr}`;
      const city = detectCity(fullText);
      const time = extractTimeRange(
        String(item.start_date).replace(' ', 'T'),
        item.end_date ? String(item.end_date).replace(' ', 'T') : undefined
      );

      events.push({
        title,
        date: eventDateStr,
        time,
        location: locationStr,
        city,
        isPartnerEvent: isOfficialPartner(pName || ''),
        partnerName: pName,
        organizerType: detectOrganizerType(source.category, pName || '', fullText),
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

    const maxFutureDateStr = getMaxFutureDateStr(todayStr);
    if (eventDateStr < todayStr || eventDateStr > maxFutureDateStr) continue;

    const rawTitle = summaryMatch[1].replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
    const rawLocation = locationMatch
      ? locationMatch[1].replace(/\\,/g, ',').replace(/\\;/g, ';').trim()
      : 'Scotland';
    const rawUrl = urlMatch ? urlMatch[1].trim() : feed.url;
    const rawDesc = descMatch
      ? stripHtml(descMatch[1].replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';'))
      : '';

    const pName = sanitizePartnerName(feed.name.split('—')[0].trim());
    events.push({
      title: rawTitle,
      date: eventDateStr,
      location: rawLocation || 'Scotland',
      city: detectCity(`${rawTitle} ${rawLocation} ${feed.name}`),
      isPartnerEvent: isOfficialPartner(pName || ''),
      partnerName: pName,
      organizerType: detectOrganizerType(feed.category, pName || '', `${rawTitle} ${rawDesc}`),
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

      const maxFutureDateStr = getMaxFutureDateStr(todayStr);
      const eventDateStr = new Date(item.startDate).toISOString().slice(0, 10);
      if (eventDateStr < todayStr || eventDateStr > maxFutureDateStr) continue;

      const title = stripHtml(item.title);
      const desc = item.body ? stripHtml(item.body).slice(0, 300) : title;
      const fullUrl = item.fullUrl
        ? item.fullUrl.startsWith('http')
          ? item.fullUrl
          : `${baseOrigin}${item.fullUrl}`
        : source.url;
      const rawPartnerName = source.name.split('—')[0].trim();
      const partnerName = sanitizePartnerName(rawPartnerName);
      const defaultLoc = (rawPartnerName || '').includes('CodeBase')
        ? 'CodeBase, 37a Castle Terrace, Edinburgh'
        : 'Abertay cyberQuarter, Dundee';

      events.push({
        title,
        date: eventDateStr,
        location: item.location?.addressTitle || defaultLoc,
        city: detectCity(`${title} ${item.location?.addressLine2 || ''} ${defaultLoc}`),
        isPartnerEvent: isOfficialPartner(partnerName || ''),
        partnerName,
        organizerType: detectOrganizerType(source.category, partnerName || '', `${title} ${desc}`),
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
      const cleanedJson = match[1]
        .replace(/^\s*<!--/, '')
        .replace(/-->\s*$/, '')
        .trim();
      const parsed = JSON.parse(cleanedJson);
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
    const maxFutureDateStr = getMaxFutureDateStr(todayStr);
    if (!eventDateStr || eventDateStr < todayStr || eventDateStr > maxFutureDateStr) continue;

    const rawUrl =
      typeof node.url === 'string' && isValidUrl(node.url) ? node.url : seed.url;
    const rawDesc =
      typeof node.description === 'string' && node.description.trim()
        ? stripHtml(node.description).slice(0, 320)
        : `Upcoming event hosted by ${seed.name}.`;

    let locName = seed.city;
    const locCandidates = Array.isArray(node.location) ? node.location : [node.location];
    const physicalOrFirstLoc =
      locCandidates.find(
        (l) => l && typeof l === 'object' && (l as Record<string, unknown>)['@type'] !== 'VirtualLocation'
      ) || locCandidates[0];
    if (physicalOrFirstLoc && typeof physicalOrFirstLoc === 'object') {
      const locObj = physicalOrFirstLoc as Record<string, unknown>;
      const placeName = typeof locObj.name === 'string' ? stripHtml(locObj.name) : '';
      const addrParts: string[] = [];
      if (locObj.address && typeof locObj.address === 'object') {
        const addr = locObj.address as Record<string, unknown>;
        for (const field of ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode']) {
          if (typeof addr[field] === 'string' && addr[field].trim()) {
            addrParts.push(stripHtml(String(addr[field]).trim()));
          }
        }
      } else if (typeof locObj.address === 'string') {
        addrParts.push(stripHtml(locObj.address));
      }
      locName = [placeName, ...addrParts].filter(Boolean).join(', ') || seed.city;
    }

    const isDedicatedScottish = !isUkWideSourceUrl(seed.url);
    const fullText = `${rawName} ${rawDesc} ${locName}`;
    const city = detectCity(fullText, isDedicatedScottish ? seed.city : undefined);

    let organizerName: string | undefined;
    if (node.organizer && typeof node.organizer === 'object') {
      const org = node.organizer as Record<string, unknown>;
      if (typeof org.name === 'string' && org.name.trim()) {
        organizerName = stripHtml(org.name).trim();
      }
    }
    const rawPName = seed.name.split('—')[0].trim();
    const pName = sanitizePartnerName(organizerName) || sanitizePartnerName(rawPName);
    events.push({
      title: rawName,
      date: eventDateStr,
      time: extractTimeRange(rawStart, rawEnd),
      location: locName || city,
      city,
      isPartnerEvent: isOfficialPartner(pName || ''),
      partnerName: pName,
      organizerType: detectOrganizerType(seed.category, pName || '', fullText),
      accessType: detectAccessType(seed.category, fullText),
      meetupUrl: rawUrl,
      description: rawDesc,
      sourceUrl: seed.url,
      sourceType: 'ld-json',
      isDedicatedScottishSource: isDedicatedScottish,
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

  // Only invoke local AI if the page text actually mentions a current/future year or upcoming event cues
  const currentYear = parseInt(todayStr.slice(0, 4), 10);
  const yearCueRegex = new RegExp(`\\b(${currentYear}|${currentYear + 1})\\b`);
  if (
    !yearCueRegex.test(cleanedText) ||
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
    const maxFutureDateStr = getMaxFutureDateStr(todayStr);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || item.date < todayStr || item.date > maxFutureDateStr) continue;

    const fullText = `${item.title} ${item.description || ''} ${item.location || ''}`;
    const city = detectCity(fullText, (item.city as CityType) || seed.city);

    const pName = sanitizePartnerName(seed.name.split('—')[0].trim());
    extracted.push({
      title: stripHtml(item.title).slice(0, 110),
      date: item.date,
      time: item.time && /\d{1,2}:\d{2}/.test(item.time) ? item.time.trim() : undefined,
      location: item.location ? stripHtml(item.location) : city,
      city,
      isPartnerEvent: isOfficialPartner(pName || ''),
      partnerName: pName,
      organizerType: detectOrganizerType(seed.category, pName || '', fullText),
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

    const maxFutureDateStr = getMaxFutureDateStr(todayStr);
    const eventDateStr = extractNaturalDate(postText, pubRefStr);
    if (!eventDateStr || eventDateStr < todayStr || eventDateStr > maxFutureDateStr) continue;

    const pName = sanitizePartnerName(source.name);
    events.push({
      title: postText.slice(0, 60).replace(/\n/g, ' ') + '...',
      date: eventDateStr,
      location: 'Scotland',
      city: detectCity(postText),
      isPartnerEvent: isOfficialPartner(source.name),
      partnerName: pName,
      organizerType: detectOrganizerType('community', pName || '', postText),
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
    console.log(
      `📂 Loaded ${existingEvents.exactSlugs.size} existing events (${existingEvents.urls.size} URLs, ${existingEvents.eventbriteIds.size} Eventbrite IDs) for deduplication.`
    );
    console.log(`🌐 Ingesting sources...\n`);
  }

  const candidateEvents: DiscoveredEvent[] = [];

  // 1. Ingest RSS feeds concurrently
  const rssFeeds = config.rssFeeds || [];
  if (rssFeeds.length > 0) {
    if (!isJsonMode && isVerbose) {
      console.log(`  [RSS] Fetching ${rssFeeds.length} RSS/Atom feeds (concurrency: 6)...`);
    }
    const rssResults = await mapConcurrent(rssFeeds, 6, async (feed) => {
      const found = await parseRssFeed(feed, todayStr);
      if (!isJsonMode && isVerbose) console.log(`    [RSS] ${feed.name}: ${found.length} items`);
      return found;
    });
    for (const found of rssResults) candidateEvents.push(...found);
  }

  // 2. Ingest WordPress Tribe Events API feeds concurrently
  const wpFeeds = config.wpFeeds || [];
  if (wpFeeds.length > 0) {
    if (!isJsonMode && isVerbose) {
      console.log(`  [WP-API] Fetching ${wpFeeds.length} WordPress Tribe API feeds (concurrency: 4)...`);
    }
    const wpResults = await mapConcurrent(wpFeeds, 4, async (feed) => {
      const found = await parseWpTribeEvents(feed, todayStr);
      if (!isJsonMode && isVerbose) console.log(`    [WP-API] ${feed.name}: ${found.length} items`);
      return found;
    });
    for (const found of wpResults) candidateEvents.push(...found);
  }

  // 3. Ingest iCal feeds concurrently
  const iCalFeeds = config.iCalFeeds || [];
  if (iCalFeeds.length > 0) {
    if (!isJsonMode && isVerbose) {
      console.log(`  [iCal] Fetching ${iCalFeeds.length} iCal feeds (concurrency: 5)...`);
    }
    const iCalResults = await mapConcurrent(iCalFeeds, 5, async (feed) => {
      const found = await parseICalFeed(feed, todayStr);
      if (!isJsonMode && isVerbose) console.log(`    [iCal] ${feed.name}: ${found.length} items`);
      return found;
    });
    for (const found of iCalResults) candidateEvents.push(...found);
  }

  // 4. Ingest JSON API feeds (Squarespace, etc.) concurrently
  const jsonFeeds = config.jsonFeeds || [];
  if (jsonFeeds.length > 0) {
    if (!isJsonMode && isVerbose) {
      console.log(`  [JSON] Fetching ${jsonFeeds.length} JSON API feeds...`);
    }
    const jsonResults = await mapConcurrent(jsonFeeds, 4, async (feed) => {
      const found = await parseSquarespaceJson(feed, todayStr);
      if (!isJsonMode && isVerbose) console.log(`    [JSON] ${feed.name}: ${found.length} items`);
      return found;
    });
    for (const found of jsonResults) candidateEvents.push(...found);
  }

  // 5. Ingest Bluesky feeds concurrently
  const blueskyFeeds = config.blueskyFeeds || [];
  if (blueskyFeeds.length > 0) {
    if (!isJsonMode && isVerbose) {
      console.log(`  [Bluesky] Fetching ${blueskyFeeds.length} Bluesky feeds (concurrency: 6)...`);
    }
    const bskyResults = await mapConcurrent(blueskyFeeds, 6, async (source) => {
      const found = await parseBlueskyFeed(source, todayStr);
      if (!isJsonMode && isVerbose) console.log(`    [Bluesky] @${source.handle}: ${found.length} items`);
      return found;
    });
    for (const found of bskyResults) candidateEvents.push(...found);
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
  const seenUrlsInRun = new Set<string>();
  const seenEventbriteIdsInRun = new Set<string>();

  for (const ev of candidateEvents) {
    const maxFutureDateStr = getMaxFutureDateStr(todayStr);
    if (!ev.date || ev.date < todayStr || ev.date > maxFutureDateStr) {
      continue;
    }

    const fullText = `${ev.title} ${ev.description} ${ev.location} ${ev.partnerName || ''}`.toLowerCase();
    const eventContentText = `${ev.title} ${ev.description}`;

    // 1. Check exclude keywords & deterministic non-Scottish UK geography/postcode guard
    if (
      config.filters.excludeKeywords?.some((kw) => fullText.includes(kw.toLowerCase())) ||
      isNonScottishLocation(`${ev.location} ${ev.title}`)
    ) {
      if (!isJsonMode && isVerbose && isNonScottishLocation(`${ev.location} ${ev.title}`)) {
        console.log(
          `  [GEO-GUARD] Rejecting non-Scottish event "${ev.title}" (location: "${ev.location}")`
        );
      }
      continue;
    }

    // 2. Check Scotland location requirement (positive keyword, valid Scottish postcode, or verified Scottish source)
    if (config.filters.requireScotlandLocation) {
      const hasLocationKeyword =
        config.filters.locationKeywords?.some((kw) => fullText.includes(kw.toLowerCase())) ||
        hasScottishPostcode(`${ev.location} ${ev.description}`);
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

    // 1. Exact slug or date+normalized title match
    if (existingEvents.exactSlugs.has(slug) || existingEvents.normalizedKeys.has(normalizedKey)) {
      continue;
    }

    // 2. Exact URL match or Eventbrite Ticket ID match against archive
    const candidateNormUrl = normalizeUrlKey(ev.meetupUrl);
    if (candidateNormUrl && existingEvents.urls.has(candidateNormUrl)) {
      if (!isJsonMode && isVerbose) {
        console.log(`  [DEDUP] Skipping "${ev.title}" (URL matches existing archive: ${candidateNormUrl})`);
      }
      continue;
    }
    const candidateEbId = extractEventbriteId(ev.meetupUrl);
    if (candidateEbId && existingEvents.eventbriteIds.has(candidateEbId)) {
      if (!isJsonMode && isVerbose) {
        console.log(`  [DEDUP] Skipping "${ev.title}" (Eventbrite ID matches existing archive: ${candidateEbId})`);
      }
      continue;
    }

    // 3. Same-date title similarity match against archive (using significant non-stopword tokens)
    const existingOnDate = existingEvents.dateTitleWords.get(ev.date);
    if (existingOnDate) {
      const evWords = getSignificantTitleWords(ev.title);
      const normEv = normalizeTitle(ev.title);
      let isDuplicateOfArchive = false;
      for (const item of existingOnDate) {
        const overlap = [...item.words].filter((w) => evWords.has(w)).length;
        const normEx = normalizeTitle(item.title);
        if (overlap >= 2 || (normEv.length > 8 && (normEv.includes(normEx) || normEx.includes(normEv)))) {
          isDuplicateOfArchive = true;
          if (!isJsonMode && isVerbose) {
            console.log(
              `  [DEDUP] Skipping "${ev.title}" (matches existing event on ${ev.date}: "${item.title}")`
            );
          }
          break;
        }
      }
      if (isDuplicateOfArchive) continue;
    }

    // 4. Check if an event with the same URL, Eventbrite ID, or same-date similar title was already seen in this run
    if (candidateNormUrl && seenUrlsInRun.has(candidateNormUrl)) {
      continue;
    }
    if (candidateEbId && seenEventbriteIdsInRun.has(candidateEbId)) {
      continue;
    }

    let isDuplicateInRun = false;
    for (const seenKey of seenInRun) {
      if (seenKey === normalizedKey) {
        isDuplicateInRun = true;
        break;
      }
      if (seenKey.startsWith(`${ev.date}-`)) {
        const normEv = normalizeTitle(ev.title);
        const normSeen = seenKey.slice(ev.date.length + 1);
        const evWords = getSignificantTitleWords(ev.title);
        const seenWords = [...getSignificantTitleWords(normSeen)];
        const overlap = seenWords.filter((w) => evWords.has(w)).length;
        if (
          overlap >= 2 ||
          (normEv.length > 8 && (normEv.includes(normSeen) || normSeen.includes(normEv)))
        ) {
          isDuplicateInRun = true;
          break;
        }
      }
    }
    if (isDuplicateInRun) continue;

    seenInRun.add(normalizedKey);
    if (candidateNormUrl) seenUrlsInRun.add(candidateNormUrl);
    if (candidateEbId) seenEventbriteIdsInRun.add(candidateEbId);

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

  const okSources = sourceHealthLog.filter((s) => s.ok).length;
  const failedSources = sourceHealthLog.filter((s) => !s.ok);

  console.log(`\n-------------------------------------------------`);
  console.log(`📊 Ingestion Complete:`);
  console.log(`   Sources Checked: ${totalSourcesCount} sources (RSS, WP-API, iCal, JSON, Bluesky, LD+JSON Seeds)`);
  console.log(`   Source Health:   ${okSources} reachable, ${failedSources.length} unreachable/failed`);
  if (failedSources.length > 0 && isVerbose) {
    for (const fail of failedSources) {
      console.log(`     ⚠️  ${fail.url} (${fail.status ? `HTTP ${fail.status}` : fail.error})`);
    }
  }
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
${ev.partnerName && sanitizePartnerName(ev.partnerName) ? `partnerName: '${sanitizePartnerName(ev.partnerName)!.replace(/'/g, "''")}'\n` : ''}organizerType: '${ev.organizerType || 'Community'}'
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
