#!/usr/bin/env bun
/**
 * Sync Potential Speakers & Talk Proposals
 *
 * Ingests and joins the Google Sheets responses for:
 * 1. CSC Speaker Profile & Logistics (1KM6OMl4ShAziFsJp2bxdh8ZyDHVeAJ3wLfVXqPaiLA4)
 * 2. CSC Call for Papers (Talk Proposal) (1MMu9LNaSLx9SrMdV08-BjzDEO0ykk2t7AFIrdN6V4_4)
 *
 * Saves a deterministic, typed snapshot to src/data/speakers/potential-speakers.json.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export const SPEAKER_SHEET_ID = '1KM6OMl4ShAziFsJp2bxdh8ZyDHVeAJ3wLfVXqPaiLA4';
export const CFP_SHEET_ID = '1MMu9LNaSLx9SrMdV08-BjzDEO0ykk2t7AFIrdN6V4_4';

export const SPEAKERS_DIR = path.resolve(
  (import.meta as any).dir || process.cwd(),
  '../src/data/speakers'
);
export const SPEAKERS_CSV_PATH = path.join(SPEAKERS_DIR, 'speakers.csv');
export const CFP_CSV_PATH = path.join(SPEAKERS_DIR, 'cfp.csv');
export const POTENTIAL_SPEAKERS_JSON_PATH = path.join(SPEAKERS_DIR, 'potential-speakers.json');

export interface PotentialTalkProposal {
  title: string;
  abstract: string;
  format: string;
  status: 'potential' | 'under_review' | 'scheduled';
  submittedAt: string;
}

export interface PotentialSpeakerRecord {
  id: string;
  fullName: string;
  organisation: string;
  representationStatus: string;
  bio: string;
  linkedinUrl?: string;
  linkedinHandle?: string;
  discordUsername?: string;
  talks: PotentialTalkProposal[];
  updatedAt: string;
}

/**
 * Robust CSV parser that handles RFC 4180 quoted multi-line fields and escaped quotes.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Extracts a clean LinkedIn handle from a URL or raw text.
 */
export function extractLinkedinHandle(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  const match = rawUrl.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : undefined;
}

/**
 * Slugifies a speaker's name for stable identification.
 */
export function slugifySpeakerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Downloads latest CSVs from Google Drive if requested or if missing.
 */
export function fetchFromGoogleDrive(): void {
  if (!fs.existsSync(SPEAKERS_DIR)) {
    fs.mkdirSync(SPEAKERS_DIR, { recursive: true });
  }

  console.log('🔄 Fetching latest Speaker Directory from Google Drive...');
  execFileSync('gdrive', [
    'readonly',
    'export',
    SPEAKER_SHEET_ID,
    SPEAKERS_CSV_PATH,
    '--format',
    'csv',
  ], { stdio: 'inherit' });

  console.log('🔄 Fetching latest CFP Proposals from Google Drive...');
  execFileSync('gdrive', [
    'readonly',
    'export',
    CFP_SHEET_ID,
    CFP_CSV_PATH,
    '--format',
    'csv',
  ], { stdio: 'inherit' });
}

/**
 * Parses and joins speaker profiles and talk proposals.
 */
export function buildPotentialSpeakersRegistry(): PotentialSpeakerRecord[] {
  if (!fs.existsSync(SPEAKERS_CSV_PATH) || !fs.existsSync(CFP_CSV_PATH)) {
    throw new Error(
      `Required CSV files not found. Ensure ${SPEAKERS_CSV_PATH} and ${CFP_CSV_PATH} exist.`
    );
  }

  const speakersRaw = fs.readFileSync(SPEAKERS_CSV_PATH, 'utf-8');
  const cfpRaw = fs.readFileSync(CFP_CSV_PATH, 'utf-8');

  const speakerRows = parseCsv(speakersRaw);
  const cfpRows = parseCsv(cfpRaw);

  const speakersHeader = speakerRows[0] || [];
  const cfpHeader = cfpRows[0] || [];

  const speakerMap = new Map<string, PotentialSpeakerRecord>();

  // Map column names to indexes for resilience against column reordering
  const sNameIdx = speakersHeader.findIndex((h) => /Full Name/i.test(h));
  const sEmailIdx = speakersHeader.findIndex((h) => /Email Address/i.test(h));
  const sDiscordIdx = speakersHeader.findIndex((h) => /Discord/i.test(h));
  const sOrgIdx = speakersHeader.findIndex((h) => /Employer|Organisation/i.test(h));
  const sRepIdx = speakersHeader.findIndex((h) => /Representation/i.test(h));
  const sBioIdx = speakersHeader.findIndex((h) => /Bio/i.test(h));
  const sSocialIdx = speakersHeader.findIndex((h) => /Social Media|Links/i.test(h));
  const sTimestampIdx = speakersHeader.findIndex((h) => /Timestamp/i.test(h));

  for (let i = 1; i < speakerRows.length; i++) {
    const row = speakerRows[i];
    const fullName = row[sNameIdx >= 0 ? sNameIdx : 1]?.trim();
    if (!fullName) continue;

    const email = (row[sEmailIdx >= 0 ? sEmailIdx : 2] || '').trim().toLowerCase();
    const discord = sDiscordIdx >= 0 ? row[sDiscordIdx]?.trim() : undefined;
    const org = (sOrgIdx >= 0 ? row[sOrgIdx] : row[4])?.trim() || 'Independent';
    const rep = (sRepIdx >= 0 ? row[sRepIdx] : row[5])?.trim() || 'Independent';
    const bio = (sBioIdx >= 0 ? row[sBioIdx] : row[6])?.trim() || '';
    const social = (sSocialIdx >= 0 ? row[sSocialIdx] : row[7])?.trim() || '';
    const timestamp = (sTimestampIdx >= 0 ? row[sTimestampIdx] : row[0])?.trim() || '';

    // Extract first valid linkedin url
    const linkedinMatch = social.match(/https?:\/\/[^\s|]+\b(linkedin\.com\/in\/[^\s|]+)/i);
    const linkedinUrl = linkedinMatch ? `https://${linkedinMatch[1]}` : undefined;
    const linkedinHandle = extractLinkedinHandle(linkedinUrl);

    const record: PotentialSpeakerRecord = {
      id: slugifySpeakerName(fullName),
      fullName,
      organisation: org,
      representationStatus: rep,
      bio,
      linkedinUrl,
      linkedinHandle,
      discordUsername: discord || undefined,
      talks: [],
      updatedAt: timestamp,
    };

    speakerMap.set(email || fullName.toLowerCase(), record);
  }

  // Map CFP submissions
  const cNameIdx = cfpHeader.findIndex((h) => /Full Name/i.test(h));
  const cEmailIdx = cfpHeader.findIndex((h) => /Email Address/i.test(h));
  const cTitleIdx = cfpHeader.findIndex((h) => /Talk Title/i.test(h));
  const cAbstractIdx = cfpHeader.findIndex((h) => /Abstract|Takeaways/i.test(h));
  const cFormatIdx = cfpHeader.findIndex((h) => /Format/i.test(h));
  const cTimestampIdx = cfpHeader.findIndex((h) => /Timestamp/i.test(h));

  for (let i = 1; i < cfpRows.length; i++) {
    const row = cfpRows[i];
    const fullName = row[cNameIdx >= 0 ? cNameIdx : 1]?.trim();
    const email = (row[cEmailIdx >= 0 ? cEmailIdx : 2] || '').trim().toLowerCase();
    const title = (cTitleIdx >= 0 ? row[cTitleIdx] : row[3])?.trim();
    const abstract = (cAbstractIdx >= 0 ? row[cAbstractIdx] : row[4])?.trim() || '';
    const format = (cFormatIdx >= 0 ? row[cFormatIdx] : row[5])?.trim() || 'Talk';
    const timestamp = (cTimestampIdx >= 0 ? row[cTimestampIdx] : row[0])?.trim() || '';

    if (!title) continue;

    const key = email || fullName.toLowerCase();
    let speaker = speakerMap.get(key);

    if (!speaker && fullName) {
      // Find by name match if email wasn't identical
      for (const s of speakerMap.values()) {
        if (s.fullName.toLowerCase() === fullName.toLowerCase()) {
          speaker = s;
          break;
        }
      }
    }

    if (!speaker && fullName) {
      // Create stub speaker if they submitted CFP without separate profile
      speaker = {
        id: slugifySpeakerName(fullName),
        fullName,
        organisation: 'Independent',
        representationStatus: 'Independent',
        bio: '',
        talks: [],
        updatedAt: timestamp,
      };
      speakerMap.set(key, speaker);
    }

    if (speaker) {
      speaker.talks.push({
        title,
        abstract,
        format,
        status: 'potential',
        submittedAt: timestamp,
      });
    }
  }

  return Array.from(speakerMap.values());
}

/**
 * Main execution: syncs and writes potential-speakers.json
 */
export async function syncSpeakers(options: { fetch?: boolean } = {}) {
  if (options.fetch) {
    fetchFromGoogleDrive();
  }

  const speakers = buildPotentialSpeakersRegistry();
  fs.writeFileSync(
    POTENTIAL_SPEAKERS_JSON_PATH,
    JSON.stringify(speakers, null, 2),
    'utf-8'
  );

  console.log(
    `✅ Successfully processed ${speakers.length} potential speakers with ${speakers.reduce(
      (acc, s) => acc + s.talks.length,
      0
    )} submitted talks to ${POTENTIAL_SPEAKERS_JSON_PATH}`
  );

  return speakers;
}

// Direct CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const shouldFetch = args.includes('--fetch');
  syncSpeakers({ fetch: shouldFetch }).catch((err) => {
    console.error('❌ Failed to sync speakers:', err);
    process.exit(1);
  });
}
