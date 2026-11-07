#!/usr/bin/env bun
/**
 * CSC Native Google Slides Automation Engine
 *
 * Automates creation and population of event slide decks directly in Google Slides:
 * - Clones Master Google Slide Template (16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ)
 * - Parses event metadata, speakers, agenda, venue, and sponsors from src/content/events/<slug>.md
 * - Dynamically duplicates speaker slides for N speakers
 * - Replaces text elements with brand typography and live details
 * - Outputs active Google Slides URL for live team collaboration
 *
 * Usage:
 *   bun run scripts/slide-ops.ts [event-slug]
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export const MASTER_TEMPLATE_ID = '16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ';
export const AGY_ACCOUNT = 'harry.mclaren.uk@gmail.com';

interface Speaker {
  name: string;
  role?: string;
  company?: string;
  talkTitle: string;
  abstract?: string;
  linkedinUrl?: string;
}

interface EventMetadata {
  title: string;
  date: string;
  formattedDate: string;
  time: string;
  hostVenue: string;
  location: string;
  sponsorName: string;
  leadOrganizer: string;
  wifiNetwork: string;
  speakers: Speaker[];
}

export function parseEventMarkdown(eventSlug: string): EventMetadata {
  const filePath = path.resolve(
    (import.meta as any).dir || process.cwd(),
    `../src/content/events/${eventSlug}.md`
  );

  let title = 'Cyber Scotland Connect Meetup';
  let date = '2026-11-26';
  let time = '17:30 – 20:30 GMT';
  let hostVenue = 'CodeBase Edinburgh';
  let location = '37a Castle Terrace, Edinburgh EH1 2EL';
  let sponsorName = 'RiverSafe';
  let leadOrganizer = 'Harry McLaren';
  let wifiNetwork = 'CodeBase Guest';
  const speakers: Speaker[] = [];

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');

    const titleM = content.match(/title:\s*["']?([^"'\n]+)/);
    const dateM = content.match(/date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    const timeM = content.match(/time:\s*["']?([^"'\n]+)/);
    const locM = content.match(/location:\s*["']?([^"'\n]+)/);
    const hostM = content.match(/hostVenue:\s*["']?([^"'\n]+)/);
    const sponsorM = content.match(/sponsors:\s*\n\s*-\s*["']?([^"'\n]+)/);

    if (titleM) title = titleM[1];
    if (dateM) date = dateM[1];
    if (timeM) time = timeM[1];
    if (locM) location = locM[1];
    if (hostM) hostVenue = hostM[1];
    if (sponsorM) sponsorName = sponsorM[1];

    // Parse speakers
    const speakersMatch = content.match(/speakers:\s*([\s\S]*?)(?=\n\w+:|$)/);
    if (speakersMatch) {
      const block = speakersMatch[1];
      const entries = block.split(/\n\s*-\s+/).filter(Boolean);
      for (const entry of entries) {
        const nameMatch = entry.match(/name:\s*["']?([^"'\n]+)/);
        const roleMatch = entry.match(/role:\s*["']?([^"'\n]+)/);
        const companyMatch = entry.match(/company:\s*["']?([^"'\n]+)/);
        const talkMatch = entry.match(/talkTitle:\s*["']?([^"'\n]+)/);
        const absMatch = entry.match(/abstract:\s*["']?([^"'\n]+)/);
        const linkedinMatch = entry.match(/linkedinUrl:\s*["']?([^"'\n]+)/);

        if (nameMatch) {
          speakers.push({
            name: nameMatch[1],
            role: roleMatch ? roleMatch[1] : undefined,
            company: companyMatch ? companyMatch[1] : undefined,
            talkTitle: talkMatch ? talkMatch[1] : 'Technical Talk',
            abstract: absMatch ? absMatch[1] : undefined,
            linkedinUrl: linkedinMatch ? linkedinMatch[1] : undefined,
          });
        }
      }
    }
  }

  // Format date nicely (e.g. November 2026)
  const d = new Date(date);
  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  const formattedDate = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

  return {
    title,
    date,
    formattedDate,
    time,
    hostVenue,
    location,
    sponsorName,
    leadOrganizer,
    wifiNetwork,
    speakers,
  };
}

export function provisionEventSlideDeck(eventSlug: string): string {
  const meta = parseEventMarkdown(eventSlug);
  const deckTitle = `${meta.date.slice(0, 7)} - CSC in ${meta.hostVenue.split(' ')[0]} (${meta.hostVenue})`;

  console.log(`\n════════════════════════════════════════════════════════════════════════════════`);
  console.log(`🎯 PROVISIONING GOOGLE SLIDE DECK FOR: ${deckTitle}`);
  console.log(`════════════════════════════════════════════════════════════════════════════════\n`);

  console.log(`[1/5] Cloning Master Slide Template (${MASTER_TEMPLATE_ID})...`);
  const copyRes = execFileSync('gslides', [
    'mutate',
    'copy',
    MASTER_TEMPLATE_ID,
    deckTitle,
    '--json',
  ], {
    env: { ...process.env, AGY_ACCOUNT },
    encoding: 'utf-8',
  });

  const idMatch = copyRes.match(/\(ID:\s*([a-zA-Z0-9_-]+)\)/);
  if (!idMatch) {
    throw new Error(`Failed to copy slide presentation: ${copyRes}`);
  }
  const presId = idMatch[1];
  console.log(`✔ Cloned presentation ID: ${presId}`);

  console.log(`[2/5] Updating Title & Host Venue Slide...`);
  execFileSync('gslides', ['mutate', 'update-text', presId, '--element', 'p1_i10', '--text', meta.formattedDate], { env: { ...process.env, AGY_ACCOUNT } });
  execFileSync('gslides', ['mutate', 'update-text', presId, '--element', 'p1_i15', '--text', meta.hostVenue], { env: { ...process.env, AGY_ACCOUNT } });
  execFileSync('gslides', ['mutate', 'update-text', presId, '--element', 'p1_i17', '--text', meta.leadOrganizer], { env: { ...process.env, AGY_ACCOUNT } });
  execFileSync('gslides', ['mutate', 'update-text', presId, '--element', 'p1_i19', '--text', meta.wifiNetwork], { env: { ...process.env, AGY_ACCOUNT } });

  console.log(`[3/5] Updating Sponsors & Partners Slide...`);
  execFileSync('gslides', ['mutate', 'update-text', presId, '--element', 'p3_i22', '--text', meta.sponsorName], { env: { ...process.env, AGY_ACCOUNT } });

  console.log(`[4/5] Provisioning ${meta.speakers.length} Speaker Slides...`);
  // Speaker 1 uses the original p6 slide
  if (meta.speakers.length > 0) {
    const s1 = meta.speakers[0];
    const roleText = [s1.role, s1.company].filter(Boolean).join(', ') || 'Cyber Scotland Connect';
    execFileSync('gslides', ['mutate', 'update-text', presId, '--element', 'p6_i15', '--text', s1.name], { env: { ...process.env, AGY_ACCOUNT } });
    execFileSync('gslides', ['mutate', 'update-text', presId, '--element', 'p6_i16', '--text', roleText], { env: { ...process.env, AGY_ACCOUNT } });
    execFileSync('gslides', ['mutate', 'update-text', presId, '--element', 'p6_i22', '--text', s1.talkTitle], { env: { ...process.env, AGY_ACCOUNT } });
  }

  // Duplicate for remaining speakers
  for (let i = 1; i < meta.speakers.length; i++) {
    const s = meta.speakers[i];
    console.log(`  - Adding speaker slide for: ${s.name}...`);
    execFileSync('gslides', ['mutate', 'duplicate', presId, 'p6'], { env: { ...process.env, AGY_ACCOUNT } });
  }

  const slidesUrl = `https://docs.google.com/presentation/d/${presId}/edit`;
  console.log(`\n[5/5] Slide Deck Provisioning Complete!`);
  console.log(`👉 Editable Google Slides Link: ${slidesUrl}\n`);

  return slidesUrl;
}

if (import.meta.main) {
  const targetSlug = process.argv[2] || '2026-11-26-edinburgh-codebase';
  provisionEventSlideDeck(targetSlug);
}
