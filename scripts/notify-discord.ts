#!/usr/bin/env bun
/**
 * CSC Discord Event Feed Notifier
 * Routes newly added future events in src/content/events/ into two distinct Discord streams:
 *   1. --scope csc      -> Official CSC events only (isPartnerEvent: false) -> DISCORD_CSC_WEBHOOK_URL
 *   2. --scope scotland -> External Scottish cyber events only (isPartnerEvent: true, excludes CSC) -> DISCORD_SCOTLAND_WEBHOOK_URL
 *
 * Usage:
 *   bun run scripts/notify-discord.ts --scope csc                      # Posts CSC events added in the last 7 days
 *   bun run scripts/notify-discord.ts --scope scotland                 # Posts Scotland partner events added in the last 7 days (excludes CSC)
 *   bun run scripts/notify-discord.ts --scope csc --since-days 14      # Custom lookback window in days
 *   bun run scripts/notify-discord.ts --scope csc --latest --dry-run   # Dry-run next upcoming CSC event
 *   bun run scripts/notify-discord.ts --scope scotland --latest --dry-run # Dry-run next upcoming Scotland partner event
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export type EventScope = 'csc' | 'scotland' | 'all';

interface ParsedEventFile {
  slug: string;
  filePath: string;
  title: string;
  date: string;
  time?: string;
  location: string;
  city: string;
  isPartnerEvent: boolean;
  partnerName: string;
  accessType: string;
  meetupUrl?: string;
  registrationUrl?: string;
  description: string;
}

interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  author: {
    name: string;
    url: string;
    icon_url: string;
  };
  title: string;
  url: string;
  color: number;
  description: string;
  fields: DiscordEmbedField[];
  footer: {
    text: string;
  };
  timestamp: string;
}

const SITE_ORIGIN = 'https://cyberscotlandconnect.com';
const CSC_BOT_AVATAR_URL = `${SITE_ORIGIN}/branding/discord-bot-csc.png`;
const SCOTLAND_BOT_AVATAR_URL = `${SITE_ORIGIN}/branding/discord-bot-scotland.png`;
const REPO_ROOT = process.cwd();
const EVENTS_DIR = path.join(REPO_ROOT, 'src/content/events');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isLatestMode = args.includes('--latest');

const fileFlagIndex = args.indexOf('--file');
const explicitFileArg = fileFlagIndex !== -1 ? args[fileFlagIndex + 1] : undefined;

const sinceDaysFlagIndex = args.indexOf('--since-days');
const rawSinceDays =
  sinceDaysFlagIndex !== -1 ? Number.parseInt(args[sinceDaysFlagIndex + 1], 10) : 7;
const sinceDays = Number.isFinite(rawSinceDays) && rawSinceDays > 0 ? rawSinceDays : 7;

const scopeFlagIndex = args.indexOf('--scope');
const rawScope = scopeFlagIndex !== -1 ? args[scopeFlagIndex + 1] : 'all';
const scope: EventScope =
  rawScope === 'csc' || rawScope === 'scotland' ? rawScope : 'all';

// Validate Discord Webhook URL strictly (Security Protocol: ALWAYS validate URLs)
export function isValidDiscordWebhookUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    const allowedHosts = new Set([
      'discord.com',
      'discordapp.com',
      'ptb.discord.com',
      'canary.discord.com',
    ]);
    return (
      parsed.protocol === 'https:' &&
      allowedHosts.has(parsed.hostname.toLowerCase()) &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

// Check if an event matches the requested channel scope
export function matchesScope(ev: ParsedEventFile, targetScope: EventScope): boolean {
  if (targetScope === 'csc') {
    return !ev.isPartnerEvent;
  }
  if (targetScope === 'scotland') {
    // Scotland-wide channel strictly excludes CSC's own events
    return ev.isPartnerEvent === true;
  }
  return true;
}

// Extract YAML frontmatter field value
function extractFrontmatterValue(frontmatter: string, key: string): string | undefined {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(regex);
  if (!match) return undefined;
  return match[1]
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/''/g, "'");
}

// Parse an event markdown file into structured fields
export function parseEventMarkdown(filePath: string): ParsedEventFile | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  const title = extractFrontmatterValue(frontmatter, 'title');
  const date = extractFrontmatterValue(frontmatter, 'date');
  if (!title || !date) return null;

  const time = extractFrontmatterValue(frontmatter, 'time');
  const location = extractFrontmatterValue(frontmatter, 'location') || 'Scotland';
  const city = extractFrontmatterValue(frontmatter, 'city') || 'Scotland-wide';
  const isPartnerRaw = extractFrontmatterValue(frontmatter, 'isPartnerEvent');
  const isPartnerEvent = isPartnerRaw === 'true';
  const partnerName =
    extractFrontmatterValue(frontmatter, 'partnerName') ||
    (isPartnerEvent ? 'Community Partner' : 'Cyber Scotland Connect');
  const accessType = extractFrontmatterValue(frontmatter, 'accessType') || 'Open/Public';
  const meetupUrl = extractFrontmatterValue(frontmatter, 'meetupUrl');
  const registrationUrl = extractFrontmatterValue(frontmatter, 'registrationUrl');

  const cleanBody = body
    .replace(/\[SOURCE:.*?\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const slug = path.basename(filePath).replace(/\.mdx?$/, '');

  return {
    slug,
    filePath,
    title,
    date: date.slice(0, 10),
    time,
    location,
    city,
    isPartnerEvent,
    partnerName,
    accessType,
    meetupUrl,
    registrationUrl,
    description: cleanBody.slice(0, 350) || title,
  };
}

// Format YYYY-MM-DD into readable UK date (e.g. "Thu, 26 Nov 2026")
function formatReadableDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T12:00:00Z`);
  if (isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Build Discord Embed object for an event
export function buildDiscordEmbed(ev: ParsedEventFile): DiscordEmbed {
  const eventPageUrl = `${SITE_ORIGIN}/events/${ev.slug}/`;
  const externalActionUrl = ev.meetupUrl || ev.registrationUrl;
  const dateDisplay = ev.time
    ? `${formatReadableDate(ev.date)} • ${ev.time}`
    : formatReadableDate(ev.date);

  const linksLine = externalActionUrl
    ? `🔗 **[Event Details on CSC](${eventPageUrl})** • **[Register / Official Page](${externalActionUrl})**`
    : `🔗 **[Event Details on CSC](${eventPageUrl})**`;

  return {
    author: {
      name: ev.isPartnerEvent
        ? `${ev.partnerName} • Scottish Cyber Ecosystem`
        : 'Cyber Scotland Connect • Official Meetup',
      url: `${SITE_ORIGIN}/events/`,
      icon_url: ev.isPartnerEvent ? SCOTLAND_BOT_AVATAR_URL : CSC_BOT_AVATAR_URL,
    },
    title: ev.title,
    url: eventPageUrl,
    color: ev.isPartnerEvent ? 0x10b981 : 0x3b82f6,
    description: `${ev.description}\n\n${linksLine}`,
    fields: [
      {
        name: '📅 Date & Time',
        value: dateDisplay,
        inline: true,
      },
      {
        name: '📍 Location',
        value:
          ev.location.toLowerCase() === ev.city.toLowerCase()
            ? ev.city
            : `${ev.city} — ${ev.location}`,
        inline: true,
      },
      {
        name: '🎟️ Access',
        value: ev.accessType,
        inline: true,
      },
    ],
    footer: {
      text: ev.isPartnerEvent
        ? 'Scottish Cyber Community Feed • cyberscotlandconnect.com/feeds/community.xml'
        : 'Cyber Scotland Connect • cyberscotlandconnect.com/feeds/csc.xml',
    },
    timestamp: new Date().toISOString(),
  };
}

// Discover newly added event files via execFileSync (no shell interpolation):
// - On initial integration commit (when scripts/notify-discord.ts itself is added in HEAD~1..HEAD)
//   or when --since-days is explicitly passed (or in --dry-run), look back N days (default 7).
// - On subsequent normal commits to main, diff HEAD~1..HEAD so unrelated site commits never double-post.
export function getNewlyAddedEventFiles(days = 7): string[] {
  try {
    const hasExplicitSinceDays = sinceDaysFlagIndex !== -1;
    let isInitialIntegrationCommit = false;
    try {
      const selfDiff = execFileSync(
        'git',
        ['diff', '--name-only', '--diff-filter=A', 'HEAD~1', 'HEAD', '--', 'scripts/notify-discord.ts'],
        { cwd: REPO_ROOT, encoding: 'utf-8' }
      ).trim();
      isInitialIntegrationCommit = selfDiff.includes('scripts/notify-discord.ts');
    } catch {
      isInitialIntegrationCommit = false;
    }

    const useLookbackWindow = hasExplicitSinceDays || isInitialIntegrationCommit || isDryRun;
    const gitArgs = useLookbackWindow
      ? [
          'log',
          `--since=${days} days ago`,
          '--diff-filter=A',
          '--pretty=format:',
          '--name-only',
          '--',
          'src/content/events/',
        ]
      : ['diff', '--name-only', '--diff-filter=A', 'HEAD~1', 'HEAD', '--', 'src/content/events/'];

    const output = execFileSync('git', gitArgs, { cwd: REPO_ROOT, encoding: 'utf-8' });
    const uniqueRelPaths = Array.from(
      new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.endsWith('.md') || line.endsWith('.mdx'))
      )
    );
    return uniqueRelPaths
      .map((relPath) => path.resolve(REPO_ROOT, relPath))
      .filter((absPath) => fs.existsSync(absPath))
      .sort();
  } catch {
    return [];
  }
}

// Find the next upcoming event in src/content/events/ matching the target scope
function getNextUpcomingEventFile(todayStr: string, targetScope: EventScope): string[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  const files = fs
    .readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .sort();
  for (const file of files) {
    const datePrefix = file.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePrefix) || datePrefix < todayStr) continue;
    const fullPath = path.join(EVENTS_DIR, file);
    const parsed = parseEventMarkdown(fullPath);
    if (parsed && matchesScope(parsed, targetScope)) {
      return [fullPath];
    }
  }
  return [];
}

// Resolve webhook URL for the given scope
function resolveWebhookUrl(targetScope: EventScope): { envName: string; url?: string } {
  if (targetScope === 'csc') {
    return {
      envName: 'DISCORD_CSC_WEBHOOK_URL',
      url: (process.env.DISCORD_CSC_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL)?.trim(),
    };
  }
  if (targetScope === 'scotland') {
    return {
      envName: 'DISCORD_SCOTLAND_WEBHOOK_URL',
      url: (process.env.DISCORD_SCOTLAND_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL)?.trim(),
    };
  }
  return {
    envName: 'DISCORD_WEBHOOK_URL',
    url: process.env.DISCORD_WEBHOOK_URL?.trim(),
  };
}

async function main() {
  const todayStr = new Date().toISOString().slice(0, 10);

  let targetFiles: string[] = [];
  if (explicitFileArg) {
    targetFiles = [path.resolve(REPO_ROOT, explicitFileArg)];
  } else if (isLatestMode) {
    targetFiles = getNextUpcomingEventFile(todayStr, scope);
  } else {
    targetFiles = getNewlyAddedEventFiles(sinceDays);
  }

  const upcomingEvents = targetFiles
    .map((f) => parseEventMarkdown(f))
    .filter(
      (ev): ev is ParsedEventFile =>
        ev !== null && ev.date >= todayStr && matchesScope(ev, scope)
    );

  if (upcomingEvents.length === 0) {
    console.log(
      `ℹ️  [${scope.toUpperCase()}] No matching upcoming events added in the last ${sinceDays} day(s) to announce to Discord.`
    );
    return;
  }

  const embeds = upcomingEvents.map((ev) => buildDiscordEmbed(ev));
  const isCscOnly = scope === 'csc' || upcomingEvents.every((e) => !e.isPartnerEvent);

  const headlineSingle = isCscOnly
    ? `📣 **New Cyber Scotland Connect Meetup:** *${upcomingEvents[0].title}*`
    : `🏴󠁧󠁢󠁳󠁣󠁴󠁿 **New Scottish Cyber Event (${upcomingEvents[0].partnerName}):** *${upcomingEvents[0].title}*`;

  const headlineMulti = isCscOnly
    ? `📣 **${upcomingEvents.length} New Cyber Scotland Connect Meetups Added This Week:**`
    : `🏴󠁧󠁢󠁳󠁣󠁴󠁿 **${upcomingEvents.length} New Scottish Cyber Ecosystem Events Added This Week:**`;

  const payload = {
    username: isCscOnly ? 'Cyber Scotland Connect' : 'CSC • Scottish Cyber Events',
    avatar_url: isCscOnly ? CSC_BOT_AVATAR_URL : SCOTLAND_BOT_AVATAR_URL,
    content: upcomingEvents.length === 1 ? headlineSingle : headlineMulti,
    embeds: embeds.slice(0, 10),
  };

  if (isDryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const { envName, url: webhookUrl } = resolveWebhookUrl(scope);
  if (!webhookUrl) {
    console.log(
      `ℹ️  [${scope.toUpperCase()}] ${envName} secret is not set — skipping Discord webhook delivery (exit 0).`
    );
    return;
  }

  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    console.error(
      `❌ [${scope.toUpperCase()}] Invalid ${envName}: must be https://discord.com/api/webhooks/...`
    );
    process.exit(1);
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(
      `❌ [${scope.toUpperCase()}] Discord webhook failed (${res.status}): ${errText.slice(0, 200)}`
    );
    process.exit(1);
  }

  console.log(`✅ [${scope.toUpperCase()}] Announced ${upcomingEvents.length} event(s) to Discord.`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('❌ Unexpected error in notify-discord.ts:', err);
    process.exit(1);
  });
}
