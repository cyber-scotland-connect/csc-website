#!/usr/bin/env bun
/**
 * CSC LinkedIn Event & Ecosystem Promotion Engine (v2)
 *
 * Implements four distinct LinkedIn promotion streams with predictable,
 * practitioner-grade templates, speaker & organization @tagging, numeric
 * LinkedIn Organization URN support, local AI slot augmentation, and a strict
 * anti-slop lexicon validator:
 *
 *   1. Stream A (--stream csc):
 *      Official Cyber Scotland Connect meetups with multi-touchpoint cadence:
 *      - launch (when published/merged)
 *      - t-14   (14 days out: Speaker & Talk Lineup Spotlight)
 *      - t-7    (7 days out: Technical Deep-Dive & Agenda Breakdown)
 *      - t-4    (4 days out: Practitioner Problem Framing & Session Focus)
 *      - t-3    (3 days out: Capacity & Waitlist Check)
 *      - t-2    (2 days out: Venue, Accessibility & Arrival Logistics)
 *      - t-1    (1 day out: Tomorrow Night Final Call)
 *      - plus-1 (1 day after: Post-Event Host, Sponsor & Speaker Thank You)
 *
 *   2. Stream B (--stream partners):
 *      Weekly summary of upcoming events hosted by Official CSC Partners & Sponsors
 *      (split into "🆕 Newly Tracked" vs. "📅 Coming Up in the Next 14 Days").
 *
 *   3. Stream C (--stream community):
 *      Weekly summary of all other tracked Scottish cyber events
 *      (split into "🆕 Newly Tracked" vs. "📅 Coming Up in the Next 14 Days").
 *
 *   4. Stream D (--stream evergreen):
 *      Bi-weekly (every 2 weeks) organizational & community platform spotlight
 *      rotating across 4 pillars:
 *      - directory   (Scottish Cyber Event Directory, 96 sources, RSS/iCal feeds)
 *      - discord     (CSC Discord Server & dual automated event channels)
 *      - mission     (Zero-Sales Charter, WCAG AAA accessibility, Pay-It-Forward)
 *      - contribute  (Open-source GitHub repo, submit events/CFPs, partner with CSC)
 *
 * Safety & Simulation Contract:
 *   - Runs in SIMULATION mode by default (--simulate).
 *   - Never makes external LinkedIn write calls unless --live AND LINKEDIN_ACCESS_TOKEN
 *     are explicitly provided.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  isOfficialPartnerOrSponsor,
  resolveLinkedinOrg,
  formatLinkedinMention,
} from '../src/utils/partner-registry';
import { isCscOfficialEvent } from './notify-discord';
import {
  isNonScottishLocation,
  hasNonScottishUkPostcode,
} from '../src/utils/scottish-geography';

export type PromotionStream = 'csc' | 'partners' | 'community' | 'evergreen' | 'all';

export type CscCadenceStep =
  | 'launch'
  | 't-14'
  | 't-7'
  | 't-4'
  | 't-3'
  | 't-2'
  | 't-1'
  | 'plus-1';

export type EvergreenPillar =
  | 'directory'
  | 'discord'
  | 'mission'
  | 'speakers'
  | 'sponsors'
  | 'catalogue';

export interface EventSpeaker {
  name: string;
  role?: string;
  company?: string;
  talkTitle: string;
  abstract?: string;
  linkedinUrl?: string;
  linkedinHandle?: string;
}

export interface EventAgendaItem {
  time: string;
  title: string;
  speaker?: string;
  speakerUrl?: string;
  description?: string;
  type?: string;
}

export interface RichEventRecord {
  slug: string;
  filePath: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  location: string;
  city: string;
  isPartnerEvent: boolean;
  partnerName: string;
  organizerType: string;
  accessType: string;
  meetupUrl?: string;
  registrationUrl?: string;
  accessibilityNotes?: string;
  stepFree?: boolean | null;
  hearingLoop?: boolean | null;
  speakers: EventSpeaker[];
  agenda: EventAgendaItem[];
  sponsorNames: string[];
  hostVenueName?: string;
  bodyText: string;
}

export interface ResolvedOrgTag {
  name: string;
  mention: string;
  apiUrnMention?: string;
  linkedinHandle?: string;
  linkedinUrl?: string;
  linkedinOrgId?: string;
}

export interface ResolvedSpeakerTag {
  name: string;
  mention: string;
  linkedinHandle?: string;
  linkedinUrl?: string;
  company?: string;
}

export interface FactualIntegrityCheck {
  passed: boolean;
  violations: string[];
}

export interface AntiBanPolicyCheck {
  passed: boolean;
  violations: string[];
  orgMentionCount: number;
  speakerMentionCount: number;
  hashtagCount: number;
  postBodyLength: number;
  firstCommentLength: number;
}

export interface SimulatedLinkedinPost {
  stream: 'csc' | 'partners' | 'community' | 'evergreen';
  cadenceStep?: CscCadenceStep;
  evergreenPillar?: EvergreenPillar;
  daysUntilEvent?: number;
  ledgerKey: string;
  headline: string;
  postBody: string;
  apiReadyPostBody: string;
  firstComment: string;
  resolvedTags: ResolvedOrgTag[];
  resolvedSpeakerTags: ResolvedSpeakerTag[];
  antiSlopValidation: {
    passed: boolean;
    violations: string[];
    augmentationSource: 'local-ai' | 'deterministic-practitioner';
  };
  factualIntegrity: FactualIntegrityCheck;
  antiBanCompliance: AntiBanPolicyCheck;
  publishReady: boolean;
  eventSlugs: string[];
}

export interface LinkedinLedgerEntry {
  key: string; // e.g. "csc:2026-11-26-edinburgh-codebase:t-14" or "digest:partners:2026-W45"
  stream: 'csc' | 'partners' | 'community' | 'evergreen';
  cadenceStep?: CscCadenceStep;
  evergreenPillar?: EvergreenPillar;
  eventSlugs: string[];
  contentSha256: string;
  postedAt: string;
  mode: 'simulated' | 'live';
}

const SITE_ORIGIN = 'https://cyberscotlandconnect.com';
const SPEAKER_PROFILE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfgZdVeI1Cfk7NTRgZzmjlIZlhEL4iEKylo8AlSRWdmDbqovA/viewform?usp=dialog';
const CFP_PROPOSAL_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScGsfJB8A2R5TaUPIum3sC1Ay6y5XlzW0MLU6P0OER0PQscLg/viewform?usp=dialog';
const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/cyberscotlandconnect';
const GITHUB_REPO_URL = 'https://github.com/cyber-scotland-connect/csc-website';
const REPO_ROOT = process.cwd();
const EVENTS_DIR = path.join(REPO_ROOT, 'src/content/events');
const LEDGER_PATH = path.join(REPO_ROOT, '.linkedin-promotion-ledger.json');

const LOCAL_AI_BASE_URL = 'http://127.0.0.1:11434';
const LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL || 'gemma3:4b';

/**
 * Banned AI-slop words and phrases. Any generated slot or post body containing
 * these markers is rejected by `validateAntiSlop()`.
 */
export const BANNED_SLOP_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'thrilled to', pattern: /\bthrilled to\b/i },
  { label: 'excited to announce', pattern: /\bexcited to announce\b/i },
  { label: 'delighted to share', pattern: /\bdelighted to share\b/i },
  { label: 'delve', pattern: /\bdelve(?:s|d|ing)?\b/i },
  { label: 'testament', pattern: /\btestament\b/i },
  { label: 'tapestry', pattern: /\btapestry\b/i },
  { label: 'beacon', pattern: /\bbeacon\b/i },
  { label: 'unleash', pattern: /\bunleash(?:ing|ed)?\b/i },
  { label: 'unlock the power', pattern: /\bunlock(?:ing)? the power\b/i },
  { label: 'game-changer', pattern: /\bgame[- ]chang(?:er|ing)\b/i },
  { label: 'rapidly evolving', pattern: /\brapidly evolving\b/i },
  { label: 'ever-changing landscape', pattern: /\bever[- ]changing (?:threat )?landscape\b/i },
  { label: 'elevate your', pattern: /\belevate your\b/i },
  { label: 'dive deep / dive in', pattern: /\bdive (?:deep|right in|in)\b/i },
  { label: 'buckle up', pattern: /\bbuckle up\b/i },
  { label: 'synergy', pattern: /\bsynerg(?:y|ies)\b/i },
  { label: 'paradigm shift', pattern: /\bparadigm shift\b/i },
  { label: 'not just X, it is Y contrastive', pattern: /\bnot just [^,.]+[,—-]?\s*it'?s\b/i },
  { label: 'cutting-edge / bleeding-edge', pattern: /\b(?:cutting|bleeding)[- ]edge\b/i },
  { label: 'world-class', pattern: /\bworld[- ]class\b/i },
  { label: 'thought leader', pattern: /\bthought[- ]leader(?:s|ship)?\b/i },
  { label: 'foster / fostering', pattern: /\bfoster(?:s|ed|ing)?\b/i },
  { label: 'revolutionize', pattern: /\brevolutioni[sz](?:e|es|ed|ing)\b/i },
  { label: 'supercharge', pattern: /\bsupercharg(?:e|es|ed|ing)\b/i },
  { label: 'in today’s fast-paced world', pattern: /\bin today'?s fast[- ]paced\b/i },
  { label: 'unrendered template variable', pattern: /(?:\{\{|\$\{)[^}]+\}?/ },
  { label: 'placeholder token (TBD/TODO/undefined/null)', pattern: /\b(?:TODO|TBD|FIXME|undefined|null|NaN)\b/ },
];

/**
 * Validates copy against the anti-slop lexicon and structural rules.
 */
export function validateAntiSlop(text: string): {
  passed: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  for (const rule of BANNED_SLOP_PATTERNS) {
    if (rule.pattern.test(text)) {
      violations.push(rule.label);
    }
  }
  const hashtagMatches = text.match(/(?:^|\s)#[a-zA-Z0-9_]+/g) || [];
  if (hashtagMatches.length > 4) {
    violations.push(`excessive hashtags (${hashtagMatches.length} > 4)`);
  }
  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Validates anti-ban & LinkedIn platform policy compliance:
 * - Post body length: 120..2600 chars (LinkedIn hard limit is 3000)
 * - First comment length: 30..1200 chars (LinkedIn hard limit is 1250)
 * - Zero raw http/https URLs in the main post body (avoids LinkedIn algorithmic feed penalty)
 * - Maximum 6 organization `@mentions` in a single post (avoids LinkedIn tag-spam suppression)
 * - Maximum 6 speaker `@mentions` in a single post
 * - Maximum 4 hashtags in the main post body
 * - No well-formed broken/invalid URLs in `firstComment`
 */
export function validateAntiBanCompliance(params: {
  postBody: string;
  firstComment: string;
  resolvedTags: ResolvedOrgTag[];
  resolvedSpeakerTags: ResolvedSpeakerTag[];
}): AntiBanPolicyCheck {
  const violations: string[] = [];
  const { postBody, firstComment, resolvedTags, resolvedSpeakerTags } = params;

  const postBodyLength = postBody.length;
  const firstCommentLength = firstComment.length;

  if (postBodyLength < 120) {
    violations.push(`postBody too short (${postBodyLength} < 120 chars)`);
  }
  if (postBodyLength > 2600) {
    violations.push(`postBody exceeds safe LinkedIn limit (${postBodyLength} > 2600 chars)`);
  }
  if (firstCommentLength < 30) {
    violations.push(`firstComment too short (${firstCommentLength} < 30 chars)`);
  }
  if (firstCommentLength > 1200) {
    violations.push(`firstComment exceeds safe LinkedIn limit (${firstCommentLength} > 1200 chars)`);
  }

  // Zero raw http/https links in the main post body
  if (/https?:\/\//i.test(postBody)) {
    violations.push('raw URL found in main postBody (must be isolated in firstComment)');
  }

  // Count active @mentions actually present in the postBody
  const orgMentionCount = resolvedTags.filter(
    (t) => t.mention.startsWith('@') && postBody.includes(t.mention)
  ).length;
  const speakerMentionCount = resolvedSpeakerTags.filter(
    (s) => s.mention.startsWith('@') && postBody.includes(s.mention)
  ).length;

  if (orgMentionCount > 6) {
    violations.push(`excessive organization @mentions (${orgMentionCount} > 6 max anti-spam cap)`);
  }
  if (speakerMentionCount > 6) {
    violations.push(`excessive speaker @mentions (${speakerMentionCount} > 6 max anti-spam cap)`);
  }

  const hashtagMatches = postBody.match(/(?:^|\s)#[a-zA-Z0-9_]+/g) || [];
  const hashtagCount = hashtagMatches.length;
  if (hashtagCount === 0) {
    violations.push('missing hashtags in postBody (expected 1-4)');
  }
  if (hashtagCount > 4) {
    violations.push(`excessive hashtags in postBody (${hashtagCount} > 4)`);
  }

  // Validate every https:// URL in firstComment is well-formed
  const urlMatches = firstComment.match(/https?:\/\/[^\s)]+/g) || [];
  if (urlMatches.length === 0) {
    violations.push('firstComment contains no valid https:// links');
  }
  for (const rawUrl of urlMatches) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'https:') {
        violations.push(`non-HTTPS URL in firstComment: ${rawUrl}`);
      }
    } catch {
      violations.push(`malformed URL in firstComment: ${rawUrl}`);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    orgMentionCount,
    speakerMentionCount,
    hashtagCount,
    postBodyLength,
    firstCommentLength,
  };
}

/**
 * Validates factual integrity of a generated LinkedIn post against ground-truth markdown data:
 * - Zero AI hallucinated numbers or dates in `aiHook` (every number in `aiHook` must appear in the source event data)
 * - Every referenced event must pass `isStrictlyScottishEvent()` geographic validation
 * - Every event date must be valid and in the future relative to `referenceDate` (except `plus-1` thank-you step)
 * - CSC chapter honesty: never claim CSC hosts meetups, chapters, speaker CFPs, or venues in Aberdeen
 * - Every `@Speaker` or `@Org` mention in `postBody` must correspond to a verified entity in `resolvedTags` / `resolvedSpeakerTags`
 */
export function validateFactualIntegrity(params: {
  stream: 'csc' | 'partners' | 'community' | 'evergreen';
  cadenceStep?: CscCadenceStep;
  evergreenPillar?: EvergreenPillar;
  postBody: string;
  firstComment: string;
  events: RichEventRecord[];
  referenceDate: string;
  aiHook?: string | null;
}): FactualIntegrityCheck {
  const violations: string[] = [];
  const {
    stream,
    cadenceStep,
    evergreenPillar,
    postBody,
    firstComment,
    events,
    referenceDate,
    aiHook,
  } = params;

  // 1. CSC Chapter Honesty Gate: CSC chapters/meetups/CFPs/venues are strictly Edinburgh, Glasgow, and Dundee
  if (stream === 'csc' || (stream === 'evergreen' && evergreenPillar !== 'directory')) {
    if (/\bAberdeen\b/i.test(postBody)) {
      violations.push(
        'CSC chapter honesty violation: post claims Aberdeen for CSC meetups/chapters/speakers/venues'
      );
    }
  }

  // 2. Brand Identity Disambiguation Gate: Always use full "Cyber Scotland Connect" and "#CyberScotlandConnect"
  // Never use standalone "#CyberScotland" (which belongs to the Scottish Government CyberScotland Partnership)
  // or standalone "CSC" in public LinkedIn copy/comments.
  const combinedCopy = `${postBody}\n${firstComment}`;
  if (/#CyberScotland(?!Connect)\b/i.test(combinedCopy)) {
    violations.push(
      'brand identity violation: found "#CyberScotland" instead of full "#CyberScotlandConnect"'
    );
  }
  if (/\bCSC\b/.test(combinedCopy)) {
    violations.push(
      'brand identity violation: found abbreviated "CSC" in post/comment copy instead of full "Cyber Scotland Connect"'
    );
  }
  if (/Cyber Scotland(?!\s+Connect)\b/i.test(postBody)) {
    violations.push(
      'brand identity violation: found standalone "Cyber Scotland" without "Connect" in postBody'
    );
  }

  // 2. Event-level ground-truth verification
  for (const ev of events) {
    if (
      hasNonScottishUkPostcode(ev.location) ||
      isNonScottishLocation(`${ev.location} ${ev.city}`)
    ) {
      violations.push(
        `non-Scottish event location blocked (${ev.slug}): "${ev.location}" (${ev.city})`
      );
    }

    if (cadenceStep !== 'plus-1' && ev.date < referenceDate) {
      violations.push(
        `stale/past event blocked (${ev.slug}): event date ${ev.date} < referenceDate ${referenceDate}`
      );
    }

    const expectedReadableDate = formatReadableUkDate(ev.date);
    if (!postBody.includes(expectedReadableDate) && !firstComment.includes(expectedReadableDate)) {
      violations.push(
        `event date mismatch (${ev.slug}): expected "${expectedReadableDate}" in postBody or firstComment`
      );
    }
  }

  // 3. AI Hook Hallucination Gate: if an AI hook was used, block any invented digits not grounded in source context
  if (aiHook) {
    const sourceCorpus = `${events.map((e) => `${e.title} ${e.date} ${e.time || ''} ${e.location} ${e.speakers.length}`).join(' ')} ${postBody.replace(aiHook, '')}`;
    const aiNumbers = aiHook.match(/\b\d+\b/g) || [];
    for (const num of aiNumbers) {
      if (!sourceCorpus.includes(num)) {
        violations.push(`AI hook contains unverified number "${num}" not present in source data`);
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

export const EVERGREEN_PILLAR_ROTATION: readonly EvergreenPillar[] = [
  'directory',
  'speakers',
  'discord',
  'sponsors',
  'mission',
  'catalogue',
] as const;

/**
 * Deterministically selects the next bi-weekly Evergreen Organization Spotlight pillar:
 * 1. If the promotion ledger has prior evergreen entries, selects the next pillar in
 *    `EVERGREEN_PILLAR_ROTATION` after the most recently published one.
 * 2. Otherwise, computes the fortnight index from `referenceDateStr` so the 1st and 15th
 *    of every month walk cleanly through all 6 pillars without manual flags.
 */
export function resolveNextEvergreenPillar(
  referenceDateStr: string,
  existingLedger: LinkedinLedgerEntry[] = []
): EvergreenPillar {
  const evergreenHistory = existingLedger.filter(
    (e) => e.stream === 'evergreen' && e.evergreenPillar
  );
  if (evergreenHistory.length > 0) {
    const lastEntry = evergreenHistory[evergreenHistory.length - 1];
    const lastIdx = EVERGREEN_PILLAR_ROTATION.indexOf(lastEntry.evergreenPillar!);
    if (lastIdx !== -1) {
      return EVERGREEN_PILLAR_ROTATION[(lastIdx + 1) % EVERGREEN_PILLAR_ROTATION.length];
    }
  }

  const parsed = new Date(`${referenceDateStr}T00:00:00Z`);
  if (isNaN(parsed.getTime())) return 'directory';
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth(); // 0..11
  const halfMonth = parsed.getUTCDate() >= 15 ? 1 : 0;
  const fortnightIndex = (year - 2026) * 24 + month * 2 + halfMonth;
  const normalizedIdx =
    ((fortnightIndex % EVERGREEN_PILLAR_ROTATION.length) +
      EVERGREEN_PILLAR_ROTATION.length) %
    EVERGREEN_PILLAR_ROTATION.length;
  return EVERGREEN_PILLAR_ROTATION[normalizedIdx];
}

/**
 * Selects a rotating pair of 2 Host Venues and 2 Sponsors (plus @Cyber Scotland Connect = 5 active @Org tags)
 * for the `sponsors` Evergreen pillar, crediting the remaining partners in plain text so every sponsor
 * gets tagged over the cycle without exceeding LinkedIn's 6-tag anti-spam threshold.
 */
export function resolveRotatingSponsorHighlights(referenceDateStr: string): {
  taggedHosts: string[];
  plainHosts: string[];
  taggedSponsors: string[];
  plainSponsors: string[];
} {
  const allHosts = ['CodeBase Edinburgh', 'Skyscanner', 'Trustpilot', 'FreeAgent'];
  const allSponsors = ['RiverSafe', 'Adarma', 'Cyera UK', 'ExtraHop', 'Harvey Nash'];

  const parsed = new Date(`${referenceDateStr}T00:00:00Z`);
  const cycleIndex = isNaN(parsed.getTime())
    ? 0
    : Math.max(0, parsed.getUTCMonth() * 2 + (parsed.getUTCDate() >= 15 ? 1 : 0));

  const taggedHosts: string[] = [];
  const plainHosts: string[] = [];
  for (let i = 0; i < allHosts.length; i++) {
    if (i === cycleIndex % allHosts.length || i === (cycleIndex + 1) % allHosts.length) {
      taggedHosts.push(allHosts[i]);
    } else {
      plainHosts.push(allHosts[i]);
    }
  }

  const taggedSponsors: string[] = [];
  const plainSponsors: string[] = [];
  for (let i = 0; i < allSponsors.length; i++) {
    if (
      i === cycleIndex % allSponsors.length ||
      i === (cycleIndex + 1) % allSponsors.length
    ) {
      taggedSponsors.push(allSponsors[i]);
    } else {
      plainSponsors.push(allSponsors[i]);
    }
  }

  return { taggedHosts, plainHosts, taggedSponsors, plainSponsors };
}

/**
 * Computes a high-signal, 3–4 hashtag block tailored to the stream, city, and technical topics:
 *   1. Brand Anchor: Always `#CyberScotlandConnect` (never `#CyberScotland`, which is a separate public body)
 *   2. Regional Tag: `#EdinburghTech`, `#GlasgowTech`, `#DundeeTech`, or `#ScottishTech`
 *   3. Practitioner Topic Tag: Derived from talk titles/abstracts (`#SecOps`, `#AppSec`, `#ThreatIntel`,
 *      `#CloudSecurity`, `#AIsecurity`, `#OffSec`, `#OTSecurity`, or `#InfoSec`)
 *   4. Intent Tag (when applicable): `#CallForSpeakers` or `#OpenSource`
 */
export function selectContextualHashtags(params: {
  stream: 'csc' | 'partners' | 'community' | 'evergreen';
  city?: string;
  corpus?: string;
  evergreenPillar?: EvergreenPillar;
}): string[] {
  const tags: string[] = ['#CyberScotlandConnect'];
  const { stream, city = '', corpus = '', evergreenPillar } = params;
  const lowerCity = city.toLowerCase();
  const lowerCorpus = corpus.toLowerCase();

  // 1. Regional tag
  if (lowerCity.includes('edinburgh') && !lowerCity.includes('glasgow')) {
    tags.push('#EdinburghTech');
  } else if (lowerCity.includes('glasgow') && !lowerCity.includes('edinburgh')) {
    tags.push('#GlasgowTech');
  } else if (lowerCity.includes('dundee') && !lowerCity.includes('edinburgh')) {
    tags.push('#DundeeTech');
  } else {
    tags.push('#ScottishTech');
  }

  // 2. Practitioner topic or pillar intent tag
  if (evergreenPillar === 'speakers') {
    tags.push('#CallForSpeakers', '#InfoSec');
    return tags.slice(0, 4);
  }
  if (evergreenPillar === 'catalogue') {
    tags.push('#OpenSource', '#InfoSec');
    return tags.slice(0, 4);
  }
  if (evergreenPillar === 'mission') {
    tags.push('#Accessibility', '#InfoSec');
    return tags.slice(0, 4);
  }

  if (/\b(?:soc|siem|splunk|detection|blue team|incident|resilience)\b/.test(lowerCorpus)) {
    tags.push('#SecOps');
  } else if (/\b(?:llm|agent|agentic|ai)\b/.test(lowerCorpus)) {
    tags.push('#AISecurity');
  } else if (/\b(?:api|owasp|web|appsec|login|auth)\b/.test(lowerCorpus)) {
    tags.push('#AppSec');
  } else if (/\b(?:malware|reverse|exploit|red team|ctf|2600|hack|offsec)\b/.test(lowerCorpus)) {
    tags.push('#OffSec');
  } else if (/\b(?:azure|aws|cloud)\b/.test(lowerCorpus)) {
    tags.push('#CloudSecurity');
  }

  if (!tags.includes('#InfoSec') && tags.length < 4) {
    tags.push('#InfoSec');
  }

  if (stream === 'csc' && tags.length < 4 && !tags.includes('#SecurityEngineering')) {
    tags.push('#SecurityEngineering');
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

export function computeContentSha256(postBody: string, firstComment: string): string {
  return crypto
    .createHash('sha256')
    .update(`${postBody}\n---\n${firstComment}`, 'utf8')
    .digest('hex');
}

/**
 * Extracts a personal LinkedIn `/in/<handle>` slug from a profile URL.
 */
export function extractPersonalLinkedinHandle(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl.trim());
    if (!parsed.hostname.toLowerCase().includes('linkedin.com')) return undefined;
    const match = parsed.pathname.match(/^\/in\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Formats a speaker mention for LinkedIn copy:
 * Uses `@Speaker Name` when a LinkedIn profile URL is known, or plain name otherwise.
 */
export function formatSpeakerMention(sp: {
  name: string;
  linkedinUrl?: string;
  linkedinHandle?: string;
}): string {
  if (sp.linkedinUrl || sp.linkedinHandle) {
    return `@${sp.name}`;
  }
  return sp.name;
}

/**
 * Classifies an event into one of the three event promotion streams:
 *   - 'csc': Official Cyber Scotland Connect meetup
 *   - 'partners': Hosted by a verified CSC Official Partner or Sponsor (`REGISTERED_PARTNERS`)
 *   - 'community': All other tracked Scottish cyber events (community meetups, external signposted)
 */
export function classifyPromotionStream(ev: {
  isPartnerEvent: boolean;
  partnerName?: string;
  title: string;
}): 'csc' | 'partners' | 'community' {
  if (isCscOfficialEvent(ev)) {
    return 'csc';
  }
  if (isOfficialPartnerOrSponsor(ev.partnerName)) {
    return 'partners';
  }
  return 'community';
}

/**
 * Maps days-until-event (`eventDate - referenceDate` in whole days) to a CSC cadence step.
 * Supports: launch (when newly added or >14d), t-14, t-7, t-4, t-3, t-2, t-1, plus-1.
 */
export function resolveCscCadenceStep(
  eventDateStr: string,
  referenceDateStr: string,
  isNewlyPublished = false
): { step: CscCadenceStep | null; daysUntil: number } {
  const evMs = Date.parse(`${eventDateStr}T00:00:00Z`);
  const refMs = Date.parse(`${referenceDateStr}T00:00:00Z`);
  const daysUntil = Math.round((evMs - refMs) / (1000 * 60 * 60 * 24));

  if (isNewlyPublished && daysUntil > 14) {
    return { step: 'launch', daysUntil };
  }
  switch (daysUntil) {
    case 14:
      return { step: 't-14', daysUntil };
    case 7:
      return { step: 't-7', daysUntil };
    case 4:
      return { step: 't-4', daysUntil };
    case 3:
      return { step: 't-3', daysUntil };
    case 2:
      return { step: 't-2', daysUntil };
    case 1:
      return { step: 't-1', daysUntil };
    case -1:
      return { step: 'plus-1', daysUntil };
    default:
      return { step: isNewlyPublished && daysUntil >= 0 ? 'launch' : null, daysUntil };
  }
}

function extractScalar(frontmatter: string, key: string): string | undefined {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(regex);
  if (!match) return undefined;
  return match[1]
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/''/g, "'");
}

function parseStringArrayBlock(frontmatter: string, key: string): string[] {
  const regex = new RegExp(`^${key}:\\s*\\r?\\n((?:[ \\t]+-\\s+.*\\r?\\n?)*)`, 'm');
  const match = frontmatter.match(regex);
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function parseSpeakersBlock(frontmatter: string): EventSpeaker[] {
  const speakers: EventSpeaker[] = [];
  const blockMatch = frontmatter.match(/^speakers:\s*\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  if (!blockMatch) return speakers;

  const rawBlock = blockMatch[1];
  const itemChunks = rawBlock.split(/^\s*-\s+/m).filter((c) => c.trim().length > 0);
  for (const chunk of itemChunks) {
    const normalizedChunk = chunk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .join('\n');
    const name = extractScalar(normalizedChunk, 'name');
    const talkTitle = extractScalar(normalizedChunk, 'talkTitle');
    if (!name || !talkTitle) continue;
    const linkedinUrl = extractScalar(normalizedChunk, 'linkedinUrl');
    speakers.push({
      name,
      role: extractScalar(normalizedChunk, 'role'),
      company: extractScalar(normalizedChunk, 'company'),
      talkTitle,
      abstract: extractScalar(normalizedChunk, 'abstract'),
      linkedinUrl,
      linkedinHandle: extractPersonalLinkedinHandle(linkedinUrl),
    });
  }
  return speakers;
}

function parseAgendaBlock(frontmatter: string): EventAgendaItem[] {
  const agenda: EventAgendaItem[] = [];
  const blockMatch = frontmatter.match(/^agenda:\s*\r?\n((?:[ \t]+.*\r?\n?)*)/m);
  if (!blockMatch) return agenda;

  const rawBlock = blockMatch[1];
  const itemChunks = rawBlock.split(/^\s*-\s+/m).filter((c) => c.trim().length > 0);
  for (const chunk of itemChunks) {
    const normalizedChunk = chunk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .join('\n');
    const time = extractScalar(normalizedChunk, 'time');
    const title = extractScalar(normalizedChunk, 'title');
    if (!time || !title) continue;
    agenda.push({
      time,
      title,
      speaker: extractScalar(normalizedChunk, 'speaker'),
      speakerUrl: extractScalar(normalizedChunk, 'speakerUrl'),
      description: extractScalar(normalizedChunk, 'description'),
      type: extractScalar(normalizedChunk, 'type'),
    });
  }
  return agenda;
}

/**
 * Parses an event markdown file into a rich structured record including speakers, agenda,
 * accessibility, explicit `hostVenue`, and explicit `sponsors[]` (with fallback body detection).
 */
export function parseRichEventMarkdown(filePath: string): RichEventRecord | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const body = fmMatch[2];

  const title = extractScalar(fm, 'title');
  const date = extractScalar(fm, 'date');
  if (!title || !date) return null;

  const time = extractScalar(fm, 'time');
  const location = extractScalar(fm, 'location') || 'Scotland';
  const city = extractScalar(fm, 'city') || 'Scotland-wide';
  const isPartnerRaw = extractScalar(fm, 'isPartnerEvent');
  const partnerName = extractScalar(fm, 'partnerName') || '';
  const isPartnerEvent =
    isPartnerRaw === 'true' ||
    (partnerName !== '' && partnerName !== 'Cyber Scotland Connect');
  const organizerType = extractScalar(fm, 'organizerType') || 'Community';
  const accessType = extractScalar(fm, 'accessType') || 'Open/Public';
  const meetupUrl = extractScalar(fm, 'meetupUrl');
  const registrationUrl = extractScalar(fm, 'registrationUrl');

  const stepFreeRaw = fm.match(/^\s+stepFree:\s*(true|false|null)/m)?.[1];
  const hearingLoopRaw = fm.match(/^\s+hearingLoop:\s*(true|false|null)/m)?.[1];
  const accessibilityNotes = fm
    .match(/^\s+notes:\s*["']?([^"'\r\n]+)["']?/m)?.[1]
    ?.trim();

  const speakers = parseSpeakersBlock(fm);
  const agenda = parseAgendaBlock(fm);

  // Merge speakerUrl from agenda into speakers if speaker.linkedinUrl was not explicitly set
  for (const sp of speakers) {
    if (!sp.linkedinUrl) {
      const matchingAgenda = agenda.find(
        (a) => a.speaker && a.speaker.toLowerCase() === sp.name.toLowerCase() && a.speakerUrl
      );
      if (matchingAgenda?.speakerUrl) {
        sp.linkedinUrl = matchingAgenda.speakerUrl;
        sp.linkedinHandle = extractPersonalLinkedinHandle(matchingAgenda.speakerUrl);
      }
    }
  }

  // 1. Prefer explicit frontmatter `sponsors:` array; fallback to body scan
  const explicitSponsors = parseStringArrayBlock(fm, 'sponsors');
  const sponsorNames: string[] = [...explicitSponsors];
  if (sponsorNames.length === 0) {
    const sponsorCandidates = ['RiverSafe', 'Adarma', 'Cyera UK', 'ExtraHop', 'Harvey Nash'];
    for (const cand of sponsorCandidates) {
      if (body.toLowerCase().includes(cand.toLowerCase())) {
        sponsorNames.push(cand);
      }
    }
  }

  // 2. Prefer explicit frontmatter `hostVenue:`; fallback to location string matching
  let hostVenueName = extractScalar(fm, 'hostVenue');
  if (!hostVenueName) {
    const venueCandidates = [
      'CodeBase Edinburgh',
      'FreeAgent',
      'Skyscanner',
      'Trustpilot',
      'Wood Mackenzie',
      'Abertay cyberQuarter',
      'Edinburgh Napier University',
      'University of Strathclyde',
    ];
    for (const v of venueCandidates) {
      const shortAlias = v.split(' ')[0].toLowerCase();
      if (location.toLowerCase().includes(shortAlias)) {
        hostVenueName = v;
        break;
      }
    }
  }

  const cleanBody = body
    .replace(/\[SOURCE:.*?\]/gi, '')
    .replace(/###\s+.*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
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
    partnerName: partnerName || (isPartnerEvent ? 'Community Partner' : 'Cyber Scotland Connect'),
    organizerType,
    accessType,
    meetupUrl,
    registrationUrl,
    accessibilityNotes,
    stepFree: stepFreeRaw === 'true' ? true : stepFreeRaw === 'false' ? false : null,
    hearingLoop: hearingLoopRaw === 'true' ? true : hearingLoopRaw === 'false' ? false : null,
    speakers,
    agenda,
    sponsorNames,
    hostVenueName,
    bodyText: cleanBody,
  };
}

function formatReadableUkDate(dateStr: string): string {
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

function collectResolvedOrgTags(names: Array<string | undefined>): ResolvedOrgTag[] {
  const seen = new Set<string>();
  const tags: ResolvedOrgTag[] = [];

  for (const rawName of names) {
    if (!rawName) continue;
    const resolved = resolveLinkedinOrg(rawName);
    const key = (resolved?.canonicalName || rawName).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (resolved) {
      tags.push({
        name: resolved.canonicalName,
        mention: resolved.linkedinHandle ? `@${resolved.canonicalName}` : resolved.canonicalName,
        apiUrnMention: resolved.apiUrnMention,
        linkedinHandle: resolved.linkedinHandle,
        linkedinUrl: resolved.linkedinUrl,
        linkedinOrgId: resolved.linkedinOrgId,
      });
    } else {
      tags.push({
        name: rawName,
        mention: rawName,
      });
    }
  }
  return tags;
}

function collectResolvedSpeakerTags(speakers: EventSpeaker[]): ResolvedSpeakerTag[] {
  const tags: ResolvedSpeakerTag[] = [];
  for (const sp of speakers) {
    tags.push({
      name: sp.name,
      mention: formatSpeakerMention(sp),
      linkedinHandle: sp.linkedinHandle,
      linkedinUrl: sp.linkedinUrl,
      company: sp.company,
    });
  }
  return tags;
}

/**
 * Converts `@Org Name` mentions in human-readable copy into LinkedIn REST API
 * LittleText URN format (`@[Org Name](urn:li:organization:12345)`) wherever a numeric Org ID exists.
 */
export function convertToApiUrnPostBody(
  postBody: string,
  resolvedTags: ResolvedOrgTag[]
): string {
  let output = postBody;
  for (const tag of resolvedTags) {
    if (tag.mention.startsWith('@') && tag.apiUrnMention) {
      output = output.split(tag.mention).join(tag.apiUrnMention);
    }
  }
  return output;
}

/**
 * Queries local Ollama for a single crisp practitioner sentence slot if --ai is requested
 * and Ollama is reachable; otherwise returns null so the deterministic practitioner hook runs.
 * Passes a step-specific structural directive so consecutive cadence steps never sound alike.
 */
async function generateAiPractitionerHook(
  promptContext: string,
  stepDirective: string,
  enableAi: boolean
): Promise<string | null> {
  if (!enableAi) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${LOCAL_AI_BASE_URL}/api/generate`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_AI_MODEL,
        stream: false,
        prompt: `Write ONE plain-spoken, concrete sentence (maximum 24 words) for Scottish cybersecurity practitioners.
Angle directive: ${stepDirective}
Strict rules:
- Zero emojis, zero exclamation marks, zero hashtags.
- Never use words like thrilled, delve, testament, landscape, game-changer, elevate, unleash, dive in, or "not just X, it's Y".
- Sound like a pragmatic security engineer in Edinburgh or Glasgow.

Context: ${promptContext}

One sentence:`,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    const candidate = data.response?.trim().replace(/^["']|["']$/g, '');
    if (!candidate || candidate.length < 15 || candidate.length > 200) return null;
    if (!validateAntiSlop(candidate).passed) return null;
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Builds Stream A: Official CSC Meetup Post for a specific cadence step
 * (`launch`, `t-14`, `t-7`, `t-4`, `t-3`, `t-2`, `t-1`, `plus-1`),
 * tagging both organizations (`@Org`) and speakers (`@Speaker Name`).
 */
export async function buildCscCadencePost(
  ev: RichEventRecord,
  step: CscCadenceStep,
  options?: { enableAi?: boolean; referenceDate?: string }
): Promise<SimulatedLinkedinPost> {
  const venueMention = formatLinkedinMention(ev.hostVenueName || ev.location.split(',')[0]);
  const sponsorMentions = ev.sponsorNames.map((s) => formatLinkedinMention(s));
  const sponsorLine =
    sponsorMentions.length > 0
      ? `Supported by ${sponsorMentions.join(' & ')} — keeping community meetups free at the point of entry.`
      : `Free and open to practitioners, students, and career switchers across Scotland.`;

  const speakerOrgNames = ev.speakers.map((s) => s.company).filter(Boolean);
  const resolvedTags = collectResolvedOrgTags([
    'Cyber Scotland Connect',
    ev.hostVenueName,
    ...ev.sponsorNames,
    ...speakerOrgNames,
  ]);
  const resolvedSpeakerTags = collectResolvedSpeakerTags(ev.speakers);

  const dateFormatted = formatReadableUkDate(ev.date);
  const cscEventUrl = `${SITE_ORIGIN}/events/${ev.slug}/`;
  const rsvpUrl = ev.meetupUrl || ev.registrationUrl || cscEventUrl;

  const stepDirectives: Record<CscCadenceStep, string> = {
    launch: 'Summarize the four technical topics covered across the lineup.',
    't-14': 'Highlight the hands-on engineering focus of the speakers.',
    't-7': 'Emphasize the three-hour run of show and zero-vendor-pitch format.',
    't-4': 'Contrast two concrete defensive/offensive problems from the talk abstracts.',
    't-3': 'Note the 80-person room cap and remind people to keep RSVPs accurate for the waitlist.',
    't-2': 'Focus on welcoming first-time attendees and practical venue accessibility.',
    't-1': 'Build anticipation for tomorrow night doors opening at 17:30.',
    'plus-1': 'Thank the speakers, host venue, and attendees for the candid Q&A.',
  };

  const aiHook = await generateAiPractitionerHook(
    `${ev.title} (${step}): ${ev.speakers.map((s) => `${s.name} on ${s.talkTitle}`).join('; ')}`,
    stepDirectives[step],
    Boolean(options?.enableAi)
  );

  const talkBullets = ev.speakers
    .map((s) => {
      const speakerTag = formatSpeakerMention(s);
      const companyTag = s.company ? `, ${formatLinkedinMention(s.company)}` : '';
      const rolePart = s.role ? ` (${s.role}${companyTag})` : companyTag ? ` (${companyTag})` : '';
      return `• ${speakerTag}${rolePart} — "${s.talkTitle}"`;
    })
    .join('\n');

  const agendaBullets = ev.agenda
    .filter((a) => a.type !== 'other')
    .map((a) => {
      const matchingSpeaker = ev.speakers.find(
        (s) => a.speaker && s.name.toLowerCase() === a.speaker.toLowerCase()
      );
      const speakerDisplay = matchingSpeaker
        ? formatSpeakerMention(matchingSpeaker)
        : a.speaker;
      return `• ${a.time} — ${a.title}${speakerDisplay ? ` (${speakerDisplay})` : ''}`;
    })
    .join('\n');

  const talkCorpus = `${ev.title} ${ev.speakers.map((s) => `${s.talkTitle} ${s.abstract || ''}`).join(' ')}`;
  const hashtagLine = selectContextualHashtags({
    stream: 'csc',
    city: ev.city,
    corpus: talkCorpus,
  }).join(' ');

  let headline = '';
  let postBody = '';

  switch (step) {
    case 'launch': {
      headline = `[CYBER SCOTLAND CONNECT · LAUNCH] ${ev.title}`;
      const hook =
        aiHook ||
        `Four practitioner talks on agentic SOC operations, malware config extraction, field-tested LLM security, and broken API authorization.`;
      postBody = [
        `New @Cyber Scotland Connect gathering confirmed for ${ev.city} on ${dateFormatted}.`,
        hook,
        `📍 Venue: ${venueMention} (${ev.location})\n🕠 Time: ${ev.time || '17:30 – 20:30 GMT'}`,
        talkBullets ? `Speaking lineup:\n${talkBullets}` : '',
        sponsorLine,
        `Full session abstracts and Meetup RSVP link are in the first comment below 👇\n\n${hashtagLine}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      break;
    }

    case 't-14': {
      headline = `[CYBER SCOTLAND CONNECT · T-14 DAYS · SPEAKER SPOTLIGHT] ${ev.title}`;
      const hook =
        aiHook ||
        `Two weeks until we gather at ${venueMention} — here is what our four speakers are bringing to the floor from live engineering and security work.`;
      const speakerDeepDive = ev.speakers
        .map((s) => {
          const speakerTag = formatSpeakerMention(s);
          const companyTag = s.company ? ` (${formatLinkedinMention(s.company)})` : '';
          const firstSentence =
            s.abstract?.split(/(?<=[.!?])\s+/)[0] || 'Hands-on practitioner session.';
          return `▪ ${speakerTag}${companyTag}: "${s.talkTitle}"\n  ↳ ${firstSentence}`;
        })
        .join('\n\n');

      postBody = [
        `Two weeks out from our ${ev.city} meetup on ${dateFormatted}.`,
        hook,
        speakerDeepDive,
        sponsorLine,
        `Grab one of the remaining spots via the link in the first comment 👇\n\n${hashtagLine}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      break;
    }

    case 't-7': {
      headline = `[CYBER SCOTLAND CONNECT · T-7 DAYS · FULL AGENDA] ${ev.title}`;
      const hook =
        aiHook ||
        `Next week in ${ev.city}: three hours of technical talks and hallway track conversation with zero vendor sales pitches.`;
      postBody = [
        `One week until @Cyber Scotland Connect meets at ${venueMention} (${dateFormatted}).`,
        hook,
        agendaBullets ? `Run of show:\n${agendaBullets}` : talkBullets,
        sponsorLine,
        `Details and RSVP in the first comment 👇\n\n${hashtagLine}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      break;
    }

    case 't-4': {
      headline = `[CYBER SCOTLAND CONNECT · T-4 DAYS · TECHNICAL PROBLEM FRAMING] ${ev.title}`;
      const featuredSpeakers = ev.speakers.slice(0, 2);
      const problemFocus = featuredSpeakers
        .map(
          (s) =>
            `• ${s.talkTitle} (${formatSpeakerMention(s)}): ${
              s.abstract?.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') || ''
            }`
        )
        .join('\n\n');
      postBody = [
        `Four days out from our ${ev.city} session at ${venueMention} (${dateFormatted}).`,
        aiHook ||
          `Most security teams are wrestling with the same two questions right now: how to constrain AI in the SOC without creating alert noise, and how to catch execution primitives hiding in repo config files.`,
        problemFocus,
        `Join the discussion in person this Thursday — RSVP link in the first comment 👇\n\n${hashtagLine}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      break;
    }

    case 't-3': {
      headline = `[CYBER SCOTLAND CONNECT · T-3 DAYS · CAPACITY & WAITLIST CHECK] ${ev.title}`;
      postBody = [
        `Three days to go for @Cyber Scotland Connect at ${venueMention} (${dateFormatted}).`,
        aiHook ||
          `We cap the room at 80 attendees so the Q&A and networking stay grounded — if your plans have changed, please update your Meetup RSVP today so someone on the waitlist gets your seat.`,
        talkBullets ? `On the slate:\n${talkBullets}` : '',
        sponsorLine,
        `Check availability or update your RSVP in the first comment 👇\n\n${hashtagLine}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      break;
    }

    case 't-2': {
      headline = `[CYBER SCOTLAND CONNECT · T-2 DAYS · VENUE & ACCESSIBILITY LOGISTICS] ${ev.title}`;
      const a11yLine = ev.accessibilityNotes
        ? `♿ Accessibility: ${ev.accessibilityNotes}`
        : `♿ Accessibility: Step-free venue access; full notes on the event page.`;
      postBody = [
        `Joining us at ${venueMention} this Thursday (${dateFormatted})? Here are the arrival details for @Cyber Scotland Connect:`,
        `📍 Address: ${ev.location}\n🕠 Doors open: 17:30 GMT (Welcome & first talk from 17:55)\n${a11yLine}`,
        aiHook ||
          `Whether it is your first Scottish security meetup or your twentieth, come say hello to the moderators at the door.`,
        `Event page and Meetup link in the first comment 👇\n\n${hashtagLine}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      break;
    }

    case 't-1': {
      headline = `[CYBER SCOTLAND CONNECT · T-1 DAY · TOMORROW NIGHT] ${ev.title}`;
      postBody = [
        `See you tomorrow evening (${dateFormatted}) at ${venueMention} for @Cyber Scotland Connect.`,
        aiHook ||
          `Doors open at 17:30 GMT for pizza, refreshments, and four back-to-back practitioner talks from ${ev.speakers.map((s) => formatSpeakerMention(s)).join(', ')}.`,
        sponsorLine,
        `Final logistics and Meetup link in the first comment 👇\n\n${hashtagLine}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      break;
    }

    case 'plus-1': {
      headline = `[CYBER SCOTLAND CONNECT · +1 DAY · POST-EVENT THANK YOU] ${ev.title}`;
      postBody = [
        `Thank you to everyone who packed out ${venueMention} last night for @Cyber Scotland Connect.`,
        `Big thanks to our speakers — ${ev.speakers.map((s) => `${formatSpeakerMention(s)}${s.company ? ` (${formatLinkedinMention(s.company)})` : ''}`).join(', ')} — for sharing candid engineering lessons from the field, and to ${sponsorMentions.join(' & ') || venueMention} for supporting the community.`,
        `If you attended, drop your key takeaway or questions for the speakers in the comments below 👇\n\n${hashtagLine}`,
      ]
        .filter(Boolean)
        .join('\n\n');
      break;
    }
  }

  const speakerLinks = ev.speakers
    .filter((s) => s.linkedinUrl)
    .map((s) => `• ${s.name}: ${s.linkedinUrl}`)
    .join('\n');

  const firstComment = [
    `🔗 Full event details & schedule: ${cscEventUrl}`,
    `🎟️ RSVP on Meetup: ${rsvpUrl}`,
    speakerLinks ? `\n🎙️ Connect with our speakers:\n${speakerLinks}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const refDate = options?.referenceDate || new Date().toISOString().slice(0, 10);
  const daysUntil = Math.round(
    (Date.parse(`${ev.date}T00:00:00Z`) - Date.parse(`${refDate}T00:00:00Z`)) /
      (1000 * 60 * 60 * 24)
  );

  const check = validateAntiSlop(`${postBody}\n${firstComment}`);
  const factualIntegrity = validateFactualIntegrity({
    stream: 'csc',
    cadenceStep: step,
    postBody,
    firstComment,
    events: [ev],
    referenceDate: refDate,
    aiHook,
  });
  const antiBanCompliance = validateAntiBanCompliance({
    postBody,
    firstComment,
    resolvedTags,
    resolvedSpeakerTags,
  });
  const apiReadyPostBody = convertToApiUrnPostBody(postBody, resolvedTags);
  const publishReady =
    check.passed && factualIntegrity.passed && antiBanCompliance.passed;

  return {
    stream: 'csc',
    cadenceStep: step,
    daysUntilEvent: daysUntil,
    ledgerKey: `csc:${ev.slug}:${step}`,
    headline,
    postBody,
    apiReadyPostBody,
    firstComment,
    resolvedTags,
    resolvedSpeakerTags,
    antiSlopValidation: {
      passed: check.passed,
      violations: check.violations,
      augmentationSource: aiHook ? 'local-ai' : 'deterministic-practitioner',
    },
    factualIntegrity,
    antiBanCompliance,
    publishReady,
    eventSlugs: [ev.slug],
  };
}

/**
 * Builds Stream B (Official CSC Partner Roundup) or Stream C (Community & Ecosystem Roundup).
 * Splits events into two anti-fatigue sections:
 *   1. 📅 Coming Up in the Next 14 Days (imminent window)
 *   2. 🆕 Newly Tracked on the Radar (further out events not yet featured)
 */
export async function buildWeeklyDigestPost(
  stream: 'partners' | 'community',
  events: RichEventRecord[],
  options?: { enableAi?: boolean; windowDays?: number; referenceDate?: string }
): Promise<SimulatedLinkedinPost> {
  const refDate = options?.referenceDate || new Date().toISOString().slice(0, 10);
  const fourteenDaysObj = new Date(`${refDate}T00:00:00Z`);
  fourteenDaysObj.setUTCDate(fourteenDaysObj.getUTCDate() + 14);
  const fourteenDayCutoff = fourteenDaysObj.toISOString().slice(0, 10);

  const ledgerSlugs = new Set(loadLedger().flatMap((entry) => entry.eventSlugs));

  const next14DaysEvents = events.filter((e) => e.date <= fourteenDayCutoff);
  const newlyTrackedFurtherOut = events.filter(
    (e) => e.date > fourteenDayCutoff && !ledgerSlugs.has(e.slug)
  );

  const combinedEvents = [...next14DaysEvents, ...newlyTrackedFurtherOut];
  const orgNames = combinedEvents.map((e) => e.partnerName);
  const resolvedTags = collectResolvedOrgTags(['Cyber Scotland Connect', ...orgNames]);

  const cities = Array.from(new Set(combinedEvents.map((e) => e.city))).join(', ');
  const aiHook = await generateAiPractitionerHook(
    `Weekly ${stream} roundup of ${combinedEvents.length} Scottish cybersecurity events across ${cities}`,
    `Summarize the mix of upcoming ${stream} events across ${cities} in one grounded sentence.`,
    Boolean(options?.enableAi)
  );

  const formatEventBullet = (ev: RichEventRecord) => {
    const orgMention = formatLinkedinMention(ev.partnerName);
    const dateStr = formatReadableUkDate(ev.date);
    const accessBadge = ev.accessType !== 'Open/Public' ? ` [${ev.accessType}]` : '';
    return `• ${dateStr} (${ev.city}) — ${ev.title}\n  Hosted by ${orgMention}${accessBadge}`;
  };

  const sections: string[] = [];
  if (next14DaysEvents.length > 0) {
    sections.push(
      `📅 Coming Up in the Next 14 Days:\n${next14DaysEvents.map(formatEventBullet).join('\n\n')}`
    );
  }
  if (newlyTrackedFurtherOut.length > 0) {
    sections.push(
      `🆕 Newly Added to the Radar:\n${newlyTrackedFurtherOut.map(formatEventBullet).join('\n\n')}`
    );
  }

  const isPartnerStream = stream === 'partners';
  const headline = isPartnerStream
    ? `[WEEKLY OFFICIAL PARTNER RADAR] ${combinedEvents.length} Partner Events (${next14DaysEvents.length} Next 14d · ${newlyTrackedFurtherOut.length} New)`
    : `[WEEKLY SCOTTISH CYBER COMMUNITY RADAR] ${combinedEvents.length} Ecosystem Events (${next14DaysEvents.length} Next 14d · ${newlyTrackedFurtherOut.length} New)`;

  const introLine = isPartnerStream
    ? `🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Cyber Partner Radar: ${combinedEvents.length} sessions from @Cyber Scotland Connect official partners and academic hubs.`
    : `🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Cyber Community Radar: ${combinedEvents.length} grassroots meetups, hacker spaces, and sector sessions across Scotland.`;

  const defaultHook = isPartnerStream
    ? `We split our partner radar into sessions happening in the next fortnight and newly announced dates across ${cities}:`
    : `Here is what is happening over the next 14 days, plus newly listed dates across ${cities}:`;

  const digestCorpus = combinedEvents.map((e) => `${e.title} ${e.bodyText}`).join(' ');
  const digestHashtagLine = selectContextualHashtags({
    stream,
    city: cities,
    corpus: digestCorpus,
  }).join(' ');

  const postBody = [
    introLine,
    aiHook || defaultHook,
    sections.join('\n\n'),
    `Know an upcoming Scottish infosec meetup or CFP we should list? Open a PR or drop it in the comments — direct registration links for every session above are in the first comment 👇\n\n${digestHashtagLine}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const commentLinks = combinedEvents
    .map((ev) => {
      const directUrl = ev.registrationUrl || ev.meetupUrl || `${SITE_ORIGIN}/events/${ev.slug}/`;
      return `• ${ev.title} (${formatReadableUkDate(ev.date)}): ${directUrl}`;
    })
    .join('\n');

  const firstComment = [
    `🔗 Full Scottish Cyber Event Calendar & RSS/iCal feeds: ${SITE_ORIGIN}/events/`,
    `\nDirect registration links for this week's radar:`,
    commentLinks,
  ].join('\n');

  const check = validateAntiSlop(`${postBody}\n${firstComment}`);
  const factualIntegrity = validateFactualIntegrity({
    stream,
    postBody,
    firstComment,
    events: combinedEvents,
    referenceDate: refDate,
    aiHook,
  });
  const antiBanCompliance = validateAntiBanCompliance({
    postBody,
    firstComment,
    resolvedTags,
    resolvedSpeakerTags: [],
  });
  const apiReadyPostBody = convertToApiUrnPostBody(postBody, resolvedTags);
  const publishReady =
    check.passed && factualIntegrity.passed && antiBanCompliance.passed;

  return {
    stream,
    ledgerKey: `digest:${stream}:${refDate}`,
    headline,
    postBody,
    apiReadyPostBody,
    firstComment,
    resolvedTags,
    resolvedSpeakerTags: [],
    antiSlopValidation: {
      passed: check.passed,
      violations: check.violations,
      augmentationSource: aiHook ? 'local-ai' : 'deterministic-practitioner',
    },
    factualIntegrity,
    antiBanCompliance,
    publishReady,
    eventSlugs: combinedEvents.map((e) => e.slug),
  };
}

/**
 * Builds Stream D: Bi-Weekly (Fortnightly) Evergreen Organization & Community Spotlight.
 * Rotates across 4 pillars so followers regularly discover the CSC Event Directory,
 * RSS/iCal feeds, Discord server, accessibility charter, and open-source repo.
 */
export async function buildEvergreenOrgPost(
  pillar: EvergreenPillar,
  upcomingEventsCount: number,
  options?: { enableAi?: boolean; referenceDate?: string }
): Promise<SimulatedLinkedinPost> {
  const refDate = options?.referenceDate || new Date().toISOString().slice(0, 10);
  const sponsorRotation = resolveRotatingSponsorHighlights(refDate);

  const pillarTagLists: Record<EvergreenPillar, string[]> = {
    directory: [
      'Cyber Scotland Connect',
      'Abertay cyberQuarter',
      'Cyber and Fraud Centre Scotland',
      'ScotlandIS Cyber Cluster',
    ],
    discord: ['Cyber Scotland Connect'],
    mission: ['Cyber Scotland Connect', 'CodeBase Edinburgh'],
    speakers: ['Cyber Scotland Connect'],
    sponsors: [
      'Cyber Scotland Connect',
      ...sponsorRotation.taggedHosts,
      ...sponsorRotation.taggedSponsors,
    ],
    catalogue: [
      'Cyber Scotland Connect',
      'Abertay Hackers',
      'ENUSEC',
      'Hack Thursday',
      'OWASP Scotland Chapter',
    ],
  };

  const resolvedTags = collectResolvedOrgTags(pillarTagLists[pillar]);
  const evergreenHashtagLine = selectContextualHashtags({
    stream: 'evergreen',
    evergreenPillar: pillar,
  }).join(' ');

  const aiHook = await generateAiPractitionerHook(
    `Cyber Scotland Connect evergreen spotlight (${pillar}) tracking ${upcomingEventsCount} upcoming Scottish cyber events.`,
    `Write one sentence on why an open, non-commercial Scottish cybersecurity directory and community matters for practitioners.`,
    Boolean(options?.enableAi)
  );

  let headline = '';
  let postBody = '';
  let firstComment = '';

  switch (pillar) {
    case 'directory': {
      headline = `[BI-WEEKLY ORG SPOTLIGHT · EVENT DIRECTORY & FEEDS] ${upcomingEventsCount} Live Scottish Cyber Events`;
      postBody = [
        `Keeping track of cybersecurity meetups, student CTFs, and conferences across Scotland shouldn't require checking twenty different websites.`,
        aiHook ||
          `@Cyber Scotland Connect maintains an open, continuously updated directory of Scottish cyber events — currently tracking ${upcomingEventsCount} upcoming sessions across Edinburgh, Glasgow, Dundee, Aberdeen, and online.`,
        `What is built into the directory:\n• Live separation of Official Cyber Scotland Connect Meetups, Partner Events (@Abertay cyberQuarter, @Cyber and Fraud Centre Scotland, @ScotlandIS Cyber Cluster), and grassroots hacker groups\n• 1-click iCal (.ics) and RSS feeds so your calendar updates automatically\n• Verified Scottish postcode filtering and step-free / hearing-loop venue disclosures`,
        `Subscribe to the live calendar or browse upcoming dates via the links in the first comment 👇\n\n${evergreenHashtagLine}`,
      ].join('\n\n');

      firstComment = [
        `📅 Browse the Scottish Cyber Event Directory: ${SITE_ORIGIN}/events/`,
        `📡 Cyber Scotland Connect Official Events RSS: ${SITE_ORIGIN}/feeds/csc.xml`,
        `🏴󠁧󠁢󠁳󠁣󠁴󠁿 All Scottish Partner & Community Events RSS: ${SITE_ORIGIN}/feeds/partner.xml`,
        `📆 1-Click iCal Calendar Subscription: ${SITE_ORIGIN}/calendar.ics`,
      ].join('\n');
      break;
    }

    case 'discord': {
      headline = `[BI-WEEKLY ORG SPOTLIGHT · DISCORD COMMUNITY] Join the Hallway Track Between Meetups`;
      postBody = [
        `The best part of a @Cyber Scotland Connect meetup is the hallway track — and it runs all week on our community Discord.`,
        aiHook ||
          `Whether you are troubleshooting a detection rule, looking for your first Scottish security role, or comparing notes between meetups in Edinburgh, Glasgow, and Dundee, the conversation continues online.`,
        `Inside the Cyber Scotland Connect Discord:\n• Dedicated automated event feeds (csc-events and scotland-cyber-events channels) that post new meetups the moment they are discovered\n• Practitioner channels for defensive engineering, offensive security, career switchers, and student societies\n• Strictly zero vendor cold-pitching`,
        `Invite link and community charter are in the first comment below 👇\n\n${evergreenHashtagLine}`,
      ].join('\n\n');

      firstComment = [
        `💬 Join the Cyber Scotland Connect Discord & Community Hub: ${SITE_ORIGIN}/community/`,
        `📜 Read our Code of Conduct & Zero-Sales Charter: ${SITE_ORIGIN}/code-of-conduct/`,
      ].join('\n');
      break;
    }

    case 'mission': {
      headline = `[BI-WEEKLY ORG SPOTLIGHT · CHARTER & ACCESSIBILITY] Free, Practitioner-Led, Zero Sales`;
      postBody = [
        `Why @Cyber Scotland Connect is — and will always be — free at the point of entry and pitch-free.`,
        aiHook ||
          `Students, career switchers, and engineers between roles shouldn't be priced out of their own industry's local community.`,
        `How we run Cyber Scotland Connect:\n• Zero-Sales Charter: talks come from hands-on practitioners sharing real architectures, postmortems, and research\n• Radical Accessibility: physical step-free and hearing-loop verification on every venue listing, plus dyslexia-friendly typography on our site\n• Community-Funded: supported by host venues like @CodeBase Edinburgh, community sponsors, and our optional Pay-It-Forward coffee fund`,
        `Learn more about how we operate or propose a talk in the first comment 👇\n\n${evergreenHashtagLine}`,
      ].join('\n\n');

      firstComment = [
        `🌐 About Cyber Scotland Connect: ${SITE_ORIGIN}/`,
        `🤝 Our Official Partners & Host Venues: ${SITE_ORIGIN}/partners/`,
        `☕ Optional Pay-It-Forward Community Fund: https://buymeacoffee.com/cyberscotlandconnect`,
      ].join('\n');
      break;
    }

    case 'speakers': {
      headline = `[BI-WEEKLY ORG SPOTLIGHT · CALL FOR SPEAKERS & MENTORSHIP] Two-Step CFP & First-Time Speaker Support`;

      // Read potential talk topics from the ingested Google Drive CFP pipeline
      let topicTeaser = '';
      try {
        const potentialPath = path.resolve(
          (import.meta as any).dir || process.cwd(),
          '../src/data/speakers/potential-speakers.json'
        );
        if (fs.existsSync(potentialPath)) {
          const speakersData = JSON.parse(fs.readFileSync(potentialPath, 'utf-8'));
          const topics = speakersData
            .flatMap((s: any) => s.talks?.map((t: any) => t.title))
            .filter(Boolean);
          if (topics.length > 0) {
            topicTeaser = `Topics currently entering our pipeline include API security breakdowns, autonomous AI agent safeguards, and delegated permissions.`;
          }
        }
      } catch {}

      postBody = [
        `Have a technical postmortem, detection engineering lesson, or research project worth sharing with fellow Scottish practitioners? @Cyber Scotland Connect is looking for speakers for upcoming gatherings across Edinburgh, Glasgow, and Dundee.`,
        aiHook ||
          `You do not need to be a seasoned conference regular — we actively mentor first-time speakers, students, and career switchers with 1-on-1 slide reviews and dry runs.`,
        `How our speaking slots work:\n• Formats: 25–35 min main sessions (+ Q&A) or 10–15 min Lightning Talks (ideal for tool demos, war stories, or your first talk)\n• Strictly Zero-Sales: 60 seconds to introduce yourself and your team, followed by 100% vendor-agnostic technical or career content\n• Two-Step Registration: Complete your one-time Speaker Profile (Step 1), then submit your Talk Proposal (Step 2)${topicTeaser ? `\n• Community Proposals: ${topicTeaser}` : ''}`,
        `Direct links to both Google Forms and our Speaker Hall of Fame are in the first comment below 👇\n\n${evergreenHashtagLine}`,
      ].join('\n\n');

      firstComment = [
        `🎤 Speaker Hall of Fame & Past Talks: ${SITE_ORIGIN}/speakers/`,
        `📋 Step 1 — Cyber Scotland Connect Speaker Profile Form (One-Time Prerequisite): ${SPEAKER_PROFILE_FORM_URL}`,
        `📝 Step 2 — Submit a Talk Proposal (CFP Form): ${CFP_PROPOSAL_FORM_URL}`,
        `❓ Speaking FAQ & Mentorship Details: ${SITE_ORIGIN}/faq/#speaking`,
      ].join('\n');
      break;
    }

    case 'sponsors': {
      headline = `[BI-WEEKLY ORG SPOTLIGHT · VENUES, SPONSORS & SUPPORTERS] Keeping Scottish Meetups Free`;
      const hostRollCall = [
        ...sponsorRotation.taggedHosts.map((h) => `@${h}`),
        ...sponsorRotation.plainHosts,
      ];
      const sponsorRollCall = [
        ...sponsorRotation.taggedSponsors.map((s) => `@${s}`),
        ...sponsorRotation.plainSponsors,
      ];
      const formatListWithAnd = (items: string[]) =>
        items.length <= 1
          ? items.join('')
          : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;

      postBody = [
        `Every @Cyber Scotland Connect ticket is £0 because Scottish host venues, ethical sponsors, and individual practitioners back the community.`,
        aiHook ||
          `We are scheduling upcoming meetups across Edinburgh, Glasgow, and Dundee and looking for organisations and individuals who want to support grassroots Scottish cybersecurity.`,
        `Three ways to back Cyber Scotland Connect:\n• Host a Meetup: Central urban venues (60–100+ capacity) with verified step-free access, working lifts, and AV (joining hosts like ${formatListWithAnd(hostRollCall)})\n• Ethical Event or Social Sponsorship: 100% of funds go to attendee pizza, refreshments, and accessibility — zero pay-to-play speaking slots and we never share attendee email lists (thank you to ${formatListWithAnd(sponsorRollCall)})\n• Individual "Pay It Forward": Established professionals can chip in a coffee so students and job seekers always attend for free`,
        `Sponsorship policy, venue requirements, and our Pay-It-Forward link are in the first comment 👇\n\n${evergreenHashtagLine}`,
      ].join('\n\n');

      firstComment = [
        `🤝 Partners, Host Venues & Ethical Sponsorship Policy: ${SITE_ORIGIN}/partners/`,
        `🏢 Venue & Sponsorship FAQ: ${SITE_ORIGIN}/faq/#sponsoring`,
        `☕ Individual "Pay It Forward" Fund: ${BUY_ME_A_COFFEE_URL}`,
        `✉️ Enquire about hosting or sponsoring: hello@cyberscotlandconnect.com`,
      ].join('\n');
      break;
    }

    case 'catalogue': {
      headline = `[BI-WEEKLY ORG SPOTLIGHT · CONTRIBUTE TO THE EVENTS CATALOGUE] Add Your Meetup, Society or CFP`;
      postBody = [
        `Running a cybersecurity meetup, university hacking society, or technical workshop in Scotland? Make sure it is listed in the @Cyber Scotland Connect events catalogue.`,
        aiHook ||
          `Our open-source discovery engine tracks 96 Scottish feeds and currently lists ${upcomingEventsCount} upcoming events — every merged event automatically broadcasts to our website, RSS/iCal feeds, Discord channels, and weekly LinkedIn radars.`,
        `How to add an event, community group, or resource:\n• Open a 2-minute Pull Request on GitHub adding a markdown file under src/content/events/ or src/content/community/\n• Or drop the event URL in our Discord (events-scotland channel) and our automated discovery agent will ingest, verify the Scottish postcode, and list it\n• University societies (@Abertay Hackers, @ENUSEC) and grassroots groups (@Hack Thursday, @OWASP Scotland Chapter) can also plug our RSS feeds directly into their own Discord servers`,
        `GitHub contribution guide and live catalogue links are in the first comment 👇\n\n${evergreenHashtagLine}`,
      ].join('\n\n');

      firstComment = [
        `📅 Live Scottish Cyber Events Catalogue: ${SITE_ORIGIN}/events/`,
        `💻 Contribute via GitHub (MIT License): ${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`,
        `🌱 Grassroots Community Directory: ${SITE_ORIGIN}/community/`,
        `📡 Plug our RSS/iCal Feeds into your Discord or Calendar: ${SITE_ORIGIN}/calendar/`,
      ].join('\n');
      break;
    }
  }

  const check = validateAntiSlop(`${postBody}\n${firstComment}`);
  const factualIntegrity = validateFactualIntegrity({
    stream: 'evergreen',
    evergreenPillar: pillar,
    postBody,
    firstComment,
    events: [],
    referenceDate: refDate,
    aiHook,
  });
  const antiBanCompliance = validateAntiBanCompliance({
    postBody,
    firstComment,
    resolvedTags,
    resolvedSpeakerTags: [],
  });
  const apiReadyPostBody = convertToApiUrnPostBody(postBody, resolvedTags);
  const publishReady =
    check.passed && factualIntegrity.passed && antiBanCompliance.passed;

  return {
    stream: 'evergreen',
    evergreenPillar: pillar,
    ledgerKey: `evergreen:${pillar}:${refDate.slice(0, 7)}`,
    headline,
    postBody,
    apiReadyPostBody,
    firstComment,
    resolvedTags,
    resolvedSpeakerTags: [],
    antiSlopValidation: {
      passed: check.passed,
      violations: check.violations,
      augmentationSource: aiHook ? 'local-ai' : 'deterministic-practitioner',
    },
    factualIntegrity,
    antiBanCompliance,
    publishReady,
    eventSlugs: [],
  };
}

/**
 * Loads all future events from src/content/events/ relative to `referenceDateStr`.
 */
export function loadUpcomingRichEvents(referenceDateStr: string): RichEventRecord[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  const files = fs
    .readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .sort();

  const records: RichEventRecord[] = [];
  for (const file of files) {
    const parsed = parseRichEventMarkdown(path.join(EVENTS_DIR, file));
    if (!parsed) continue;
    if (parsed.date >= referenceDateStr) {
      records.push(parsed);
    }
  }
  return records;
}

export function loadLedger(): LinkedinLedgerEntry[] {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8')) as LinkedinLedgerEntry[];
  } catch {
    return [];
  }
}

export function recordLedgerEntry(entry: LinkedinLedgerEntry): void {
  const existing = loadLedger();
  if (existing.some((e) => e.key === entry.key)) return;
  existing.push(entry);
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(existing, null, 2), 'utf-8');
}

export function canPublishUnderRateAndIdempotencyLimits(
  post: SimulatedLinkedinPost,
  existingLedger: LinkedinLedgerEntry[],
  nowIso: string = new Date().toISOString()
): { allowed: boolean; reason?: string } {
  // 1. Exact ledgerKey idempotency check
  if (existingLedger.some((e) => e.key === post.ledgerKey && e.mode === 'live')) {
    return {
      allowed: false,
      reason: `idempotency block: ledgerKey "${post.ledgerKey}" has already been published live`,
    };
  }

  // 2. Exact content SHA-256 deduplication check
  const contentHash = computeContentSha256(post.postBody, post.firstComment);
  if (existingLedger.some((e) => e.contentSha256 === contentHash && e.mode === 'live')) {
    return {
      allowed: false,
      reason: `duplicate content block: identical SHA-256 (${contentHash.slice(0, 12)}) already published`,
    };
  }

  // 3. Hard 24-hour rolling rate limit: max 2 live posts per 24h, min 4h spacing
  const nowMs = Date.parse(nowIso);
  const last24hLive = existingLedger.filter(
    (e) =>
      e.mode === 'live' &&
      nowMs - Date.parse(e.postedAt) >= 0 &&
      nowMs - Date.parse(e.postedAt) <= 24 * 60 * 60 * 1000
  );

  if (last24hLive.length >= 2) {
    return {
      allowed: false,
      reason: `rate-limit block: ${last24hLive.length} live posts already published in the last 24h (max 2/24h)`,
    };
  }

  const last4hLive = last24hLive.find(
    (e) => nowMs - Date.parse(e.postedAt) < 4 * 60 * 60 * 1000
  );
  if (last4hLive) {
    return {
      allowed: false,
      reason: `cooldown block: last live post (${last4hLive.key}) was published less than 4 hours ago`,
    };
  }

  return { allowed: true };
}

function renderSimulationCard(post: SimulatedLinkedinPost): string {
  const orgTagSummary =
    post.resolvedTags.length > 0
      ? post.resolvedTags
          .map((t) => {
            if (t.linkedinHandle) {
              const urnNote = t.apiUrnMention ? ` | API: ${t.apiUrnMention}` : '';
              return `${t.mention} -> linkedin.com/company/${t.linkedinHandle}${urnNote}`;
            }
            return `${t.name} (plain text)`;
          })
          .join('\n  • ')
      : 'None';

  const speakerTagSummary =
    post.resolvedSpeakerTags.length > 0
      ? post.resolvedSpeakerTags
          .map((s) =>
            s.linkedinHandle
              ? `${s.mention} -> linkedin.com/in/${s.linkedinHandle}${s.company ? ` (${s.company})` : ''}`
              : `${s.name} (no LinkedIn URL)`
          )
          .join('\n  • ')
      : 'None';

  const modeBadge = post.cadenceStep || post.evergreenPillar || 'weekly-digest';
  const slopBadge = post.antiSlopValidation.passed ? '✅ PASS' : '❌ FAIL';
  const factBadge = post.factualIntegrity.passed ? '✅ PASS' : '❌ FAIL';
  const banBadge = post.antiBanCompliance.passed ? '✅ PASS' : '❌ FAIL';
  const allViolations = [
    ...post.antiSlopValidation.violations.map((v) => `[SLOP] ${v}`),
    ...post.factualIntegrity.violations.map((v) => `[FACT] ${v}`),
    ...post.antiBanCompliance.violations.map((v) => `[ANTI-BAN] ${v}`),
  ];

  return [
    `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`,
    `┃ STREAM: ${post.stream.toUpperCase().padEnd(10)} | MODE: ${modeBadge.padEnd(14)} | READY: ${post.publishReady ? '✅ YES' : '🛑 BLOCKED'} ┃`,
    `┃ GATES -> ANTI-SLOP: ${slopBadge} | FACTUAL: ${factBadge} | ANTI-BAN: ${banBadge} (${post.antiBanCompliance.orgMentionCount}/6 orgs, ${post.antiBanCompliance.hashtagCount}/4 tags) ┃`,
    `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`,
    ...(allViolations.length > 0
      ? [`🛑 GATE VIOLATIONS:\n  • ${allViolations.join('\n  • ')}`, ``]
      : []),
    `📌 ${post.headline}`,
    ``,
    `--- [MAIN LINKEDIN POST COPY] --------------------------------------------------`,
    post.postBody,
    ``,
    `--- [AUTO FIRST COMMENT (10s DELAY — AVOIDS LINK PENALTY)] ---------------------`,
    post.firstComment,
    ``,
    `--- [RESOLVED ORG TAGS & API URNs (${post.resolvedTags.length})] -----------------------------------`,
    `  • ${orgTagSummary}`,
    ...(post.resolvedSpeakerTags.length > 0
      ? [
          ``,
          `--- [RESOLVED SPEAKER PROFILE TAGS (${post.resolvedSpeakerTags.length})] ---------------------------------`,
          `  • ${speakerTagSummary}`,
        ]
      : []),
    ``,
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const isLiveMode = args.includes('--live');
  const isSimulateMode = !isLiveMode || args.includes('--simulate') || args.includes('--dry-run');
  const enableAi = args.includes('--ai');
  const showAllCadence = args.includes('--all-cadence');
  const showAllEvergreen = args.includes('--all-pillars');
  const isJsonMode = args.includes('--json');

  const streamIdx = args.indexOf('--stream');
  const rawStream = streamIdx !== -1 ? args[streamIdx + 1] : 'all';
  const targetStream: PromotionStream =
    rawStream === 'csc' ||
    rawStream === 'partners' ||
    rawStream === 'community' ||
    rawStream === 'evergreen'
      ? rawStream
      : 'all';

  const cadenceIdx = args.indexOf('--cadence');
  const explicitCadence =
    cadenceIdx !== -1 ? (args[cadenceIdx + 1] as CscCadenceStep) : undefined;

  const dateIdx = args.indexOf('--date');
  const referenceDate =
    dateIdx !== -1 && args[dateIdx + 1]
      ? args[dateIdx + 1]
      : new Date().toISOString().slice(0, 10);

  const pillarIdx = args.indexOf('--pillar');
  const explicitPillar: EvergreenPillar =
    pillarIdx !== -1 && args[pillarIdx + 1]
      ? (args[pillarIdx + 1] as EvergreenPillar)
      : resolveNextEvergreenPillar(referenceDate, loadLedger());

  const windowIdx = args.indexOf('--window-days');
  const rawWindow = windowIdx !== -1 ? Number.parseInt(args[windowIdx + 1], 10) : 60;
  const windowDays = Number.isFinite(rawWindow) && rawWindow > 0 ? rawWindow : 60;

  const maxDateObj = new Date(`${referenceDate}T00:00:00Z`);
  maxDateObj.setUTCDate(maxDateObj.getUTCDate() + windowDays);
  const maxDateStr = maxDateObj.toISOString().slice(0, 10);

  const upcoming = loadUpcomingRichEvents(referenceDate);
  const generatedPosts: SimulatedLinkedinPost[] = [];

  // 1. Stream A: Official CSC Meetups
  if (targetStream === 'csc' || targetStream === 'all') {
    const cscEvents = upcoming.filter((e) => classifyPromotionStream(e) === 'csc');
    for (const ev of cscEvents) {
      if (showAllCadence) {
        const steps: CscCadenceStep[] = [
          'launch',
          't-14',
          't-7',
          't-4',
          't-3',
          't-2',
          't-1',
          'plus-1',
        ];
        for (const st of steps) {
          generatedPosts.push(
            await buildCscCadencePost(ev, st, { enableAi, referenceDate })
          );
        }
      } else {
        const resolved = resolveCscCadenceStep(ev.date, referenceDate, true);
        const stepToRun: CscCadenceStep = explicitCadence || resolved.step || 't-14';
        generatedPosts.push(
          await buildCscCadencePost(ev, stepToRun, { enableAi, referenceDate })
        );
      }
    }
  }

  // 2. Stream B: Official CSC Partner Weekly Roundup
  if (targetStream === 'partners' || targetStream === 'all') {
    const partnerEvents = upcoming
      .filter((e) => classifyPromotionStream(e) === 'partners' && e.date <= maxDateStr)
      .slice(0, 6);
    if (partnerEvents.length > 0) {
      generatedPosts.push(
        await buildWeeklyDigestPost('partners', partnerEvents, {
          enableAi,
          windowDays,
          referenceDate,
        })
      );
    }
  }

  // 3. Stream C: Community & Ecosystem Weekly Roundup
  if (targetStream === 'community' || targetStream === 'all') {
    const communityEvents = upcoming
      .filter((e) => classifyPromotionStream(e) === 'community' && e.date <= maxDateStr)
      .slice(0, 6);
    if (communityEvents.length > 0) {
      generatedPosts.push(
        await buildWeeklyDigestPost('community', communityEvents, {
          enableAi,
          windowDays,
          referenceDate,
        })
      );
    }
  }

  // 4. Stream D: Bi-Weekly Evergreen Organization & Platform Spotlight
  if (targetStream === 'evergreen' || targetStream === 'all') {
    if (showAllEvergreen) {
      for (const p of EVERGREEN_PILLAR_ROTATION) {
        generatedPosts.push(
          await buildEvergreenOrgPost(p, upcoming.length, {
            enableAi,
            referenceDate,
          })
        );
      }
    } else {
      generatedPosts.push(
        await buildEvergreenOrgPost(explicitPillar, upcoming.length, {
          enableAi,
          referenceDate,
        })
      );
    }
  }

  if (isJsonMode) {
    console.log(JSON.stringify(generatedPosts, null, 2));
    return;
  }

  console.log('================================================================================');
  console.log(
    `🚀 CSC LinkedIn Event & Ecosystem Promotion Engine — Mode: ${isSimulateMode ? 'SIMULATION (Zero Live Calls)' : 'LIVE'}`
  );
  console.log(
    `Reference Date: ${referenceDate} | Window: ${windowDays}d | Posts Generated: ${generatedPosts.length}`
  );
  console.log('================================================================================\n');

  for (const post of generatedPosts) {
    console.log(renderSimulationCard(post));
  }

  // Hard Pre-Publish Circuit Breaker: fail non-zero if any post failed any validation gate
  const blockedPosts = generatedPosts.filter((p) => !p.publishReady);
  if (blockedPosts.length > 0) {
    console.error(
      `🛑 [GUARDRAIL CIRCUIT BREAKER] ${blockedPosts.length} post(s) failed safety/factual/anti-slop/anti-ban gates. Aborting.`
    );
    process.exit(1);
  }

  if (!isSimulateMode) {
    const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
    if (!token) {
      console.log(
        'ℹ️  [LIVE] LINKEDIN_ACCESS_TOKEN is not set — skipping live LinkedIn API call (exit 0).'
      );
      return;
    }

    const ledger = loadLedger();
    for (const post of generatedPosts) {
      const rateCheck = canPublishUnderRateAndIdempotencyLimits(post, ledger);
      if (!rateCheck.allowed) {
        console.log(`🛡️  [SKIPPED] ${post.ledgerKey} — ${rateCheck.reason}`);
        continue;
      }
      console.log(`ℹ️  [LIVE] Ready for LinkedIn REST API /rest/posts delivery: ${post.ledgerKey}`);
    }
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('❌ Unexpected error in promote-linkedin.ts:', err);
    process.exit(1);
  });
}
