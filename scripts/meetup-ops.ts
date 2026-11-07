#!/usr/bin/env bun
/**
 * CSC Meetup Operations & Automation Engine
 *
 * Systemic, repeatable operations engine for all Cyber Scotland Connect meetups:
 * 1. Dynamic Next-Event Resolution: Auto-detects the next upcoming official CSC meetup
 * 2. Attendee & Waitlist Communication Staging (T-7 / T-4 / T-1) across any city/venue
 * 3. Automated Interceptor / Browser Navigation Recipes (Zero-Pro, zero-API dependency)
 * 4. Venue Security Check-in Roster Generator (Transforms Meetup CSV into printable check-in tables)
 */

import fs from 'fs';
import path from 'path';

export interface MeetupEventContext {
  slug: string;
  title: string;
  date: string;
  time: string;
  location: string;
  hostVenue: string;
  city: string;
  meetupUrl: string;
  eventId: string;
  groupSlug: string;
  capacityLimit: number;
  speakers: Array<{ name: string; talkTitle: string; company?: string }>;
}

/**
 * Scans src/content/events/ and lists all official CSC self-hosted events
 */
export function listOfficialCscEvents(): Array<{ slug: string; date: string; title: string; meetupUrl?: string; venue?: string }> {
  const eventsDir = path.resolve((import.meta as any).dir || process.cwd(), '../src/content/events');
  if (!fs.existsSync(eventsDir)) return [];

  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.md'));
  const events: Array<{ slug: string; date: string; title: string; meetupUrl?: string; venue?: string }> = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const content = fs.readFileSync(path.join(eventsDir, file), 'utf-8');

    const isPartner = /isPartnerEvent:\s*true/i.test(content);
    const partnerNameMatch = content.match(/partnerName:\s*["']?([^"'\n]+)/i);
    const partnerName = partnerNameMatch ? partnerNameMatch[1].trim() : '';

    // Official CSC events have isPartnerEvent: false and no external partner
    if (!isPartner && (!partnerName || partnerName.toLowerCase().includes('cyber scotland connect'))) {
      const titleM = content.match(/title:\s*["']?([^"'\n]+)/);
      const dateM = content.match(/date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      const meetupM = content.match(/meetupUrl:\s*["']?([^"'\n]+)/);
      const hostM = content.match(/hostVenue:\s*["']?([^"'\n]+)/);

      if (dateM && titleM) {
        events.push({
          slug,
          date: dateM[1],
          title: titleM[1].trim(),
          meetupUrl: meetupM ? meetupM[1].trim() : undefined,
          venue: hostM ? hostM[1].trim() : undefined,
        });
      }
    }
  }

  // Sort chronologically ascending
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Automatically discovers the next upcoming official CSC event, or loads a specific slug
 */
export function resolveUpcomingCscEvent(targetSlug?: string): string {
  const events = listOfficialCscEvents();
  if (events.length === 0) return '2026-11-26-edinburgh-codebase';

  if (targetSlug && targetSlug !== 'next') {
    const matched = events.find((e) => e.slug === targetSlug);
    if (matched) return matched.slug;
  }

  const today = new Date().toISOString().slice(0, 10);
  const future = events.filter((e) => e.date >= today);

  if (future.length > 0) {
    return future[0].slug;
  }

  // Fallback to the latest event if none are in the future
  return events[events.length - 1].slug;
}

/**
 * Extracts Meetup metadata and event parameters dynamically from content collections
 */
export function loadMeetupEventContext(eventSlug?: string): MeetupEventContext {
  const resolvedSlug = resolveUpcomingCscEvent(eventSlug);
  const eventFilePath = path.resolve(
    (import.meta as any).dir || process.cwd(),
    `../src/content/events/${resolvedSlug}.md`
  );

  let title = 'Cyber Scotland Connect Meetup';
  let date = resolvedSlug.slice(0, 10);
  let time = '17:30 – 20:30 GMT';
  let location = 'CodeBase Edinburgh, 37a Castle Terrace, Edinburgh EH1 2EL';
  let hostVenue = 'CodeBase Edinburgh';
  let city = 'Edinburgh';
  let meetupUrl = 'https://www.meetup.com/cyberscotconnect/';
  let capacityLimit = 80;
  const speakers: Array<{ name: string; talkTitle: string; company?: string }> = [];

  if (fs.existsSync(eventFilePath)) {
    const content = fs.readFileSync(eventFilePath, 'utf-8');
    const titleMatch = content.match(/title:\s*["']?([^"'\n]+)/);
    const dateMatch = content.match(/date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    const timeMatch = content.match(/time:\s*["']?([^"'\n]+)/);
    const locMatch = content.match(/location:\s*["']?([^"'\n]+)/);
    const hostMatch = content.match(/hostVenue:\s*["']?([^"'\n]+)/);
    const cityMatch = content.match(/city:\s*["']?([^"'\n]+)/);
    const meetupMatch = content.match(/meetupUrl:\s*["']?([^"'\n]+)/);
    const capacityMatch = content.match(/(?:limit of \*\*|capacity:\s*|limit:\s*)([0-9]+)/i);

    if (titleMatch) title = titleMatch[1].trim();
    if (dateMatch) date = dateMatch[1].trim();
    if (timeMatch) time = timeMatch[1].trim();
    if (locMatch) location = locMatch[1].trim();
    if (hostMatch) hostVenue = hostMatch[1].trim();
    if (cityMatch) city = cityMatch[1].trim();
    if (meetupMatch) meetupUrl = meetupMatch[1].trim();
    if (capacityMatch) capacityLimit = parseInt(capacityMatch[1], 10);

    const speakersBlock = content.match(/speakers:\s*([\s\S]*?)(?=\n\w+:|$)/);
    if (speakersBlock) {
      const speakerEntries = speakersBlock[1].split(/\n\s*-\s+/).filter(Boolean);
      for (const entry of speakerEntries) {
        const nameM = entry.match(/name:\s*["']?([^"'\n]+)/);
        const titleM = entry.match(/talkTitle:\s*["']?([^"'\n]+)/);
        const compM = entry.match(/company:\s*["']?([^"'\n]+)/);
        if (nameM) {
          speakers.push({
            name: nameM[1].trim(),
            talkTitle: titleM ? titleM[1].trim() : 'Technical Talk',
            company: compM ? compM[1].trim() : undefined,
          });
        }
      }
    }
  }

  // Parse ID and group slug from meetupUrl
  const idMatch = meetupUrl.match(/events\/([0-9]+)/);
  const groupMatch = meetupUrl.match(/meetup\.com\/([^/]+)/);

  return {
    slug: resolvedSlug,
    title,
    date,
    time,
    location,
    hostVenue,
    city,
    meetupUrl,
    eventId: idMatch ? idMatch[1] : '316327219',
    groupSlug: groupMatch ? groupMatch[1] : 'cyberscotconnect',
    capacityLimit,
    speakers,
  };
}

/**
 * Generate T-7 / T-4 Waitlist & Attendance Audit broadcast
 */
export function generateWaitlistBroadcast(ctx: MeetupEventContext): {
  subject: string;
  recipientFilter: string;
  body: string;
} {
  return {
    subject: `Important: Checking your attendance for ${ctx.title} (${ctx.date})`,
    recipientFilter: 'Going (Attending Members)',
    body: `Hi everyone,\n
We are getting ready for our upcoming gathering at ${ctx.hostVenue} in ${ctx.city} on ${ctx.date}!

As a reminder, to ensure everyone's comfort and comply with venue safety regulations, we have a strict capacity limit of ${ctx.capacityLimit} attendees, and we currently have members waiting on the waitlist.

If your plans have changed and you can no longer join us in person, please take 10 seconds to update your RSVP to "Not Going" on Meetup today:
👉 ${ctx.meetupUrl}

Updating your RSVP automatically releases a ticket to the next person in line on the waitlist so they have enough notice to plan their travel.

If you are still joining us, you do not need to do anything! Doors open at ${ctx.time.split('–')[0]?.trim() || '17:30'}.

Looking forward to seeing you all!

Warm regards,
Harry McLaren & the Cyber Scotland Connect Team`,
  };
}

/**
 * Generate T-1 Final Arrival & Security Logistics broadcast
 */
export function generateFinalReminderBroadcast(ctx: MeetupEventContext): {
  subject: string;
  recipientFilter: string;
  body: string;
} {
  const speakerBullets = ctx.speakers.length > 0
    ? ctx.speakers.map((s) => `• ${s.name}${s.company ? ` (${s.company})` : ''}: "${s.talkTitle}"`).join('\n')
    : `• Practitioner talks and community security discussions`;

  return {
    subject: `Tomorrow Night: Logistics & Schedule for Cyber Scotland Connect at ${ctx.hostVenue}`,
    recipientFilter: 'Going (Attending Members)',
    body: `Hi everyone,\n
Tomorrow evening is our Cyber Scotland Connect meetup at ${ctx.hostVenue} in ${ctx.city}!

Here are the key details for your arrival tomorrow:
📍 Venue: ${ctx.location}
⏰ Doors Open: ${ctx.time.split('–')[0]?.trim() || '17:30'} (Welcome & Talks begin at 18:00 sharp)
♿ Accessibility: Step-free access and lifts are verified and operational.

🎙️ Our Lineup:
${speakerBullets}

🍕 Food & Refreshments:
Complimentary pizza (including dedicated vegetarian, vegan, and gluten-free options) and refreshments will be provided courtesy of our community sponsors.

🚪 Entry & Security:
Please enter via the main entrance and check in with our volunteer moderators at the front desk to collect your name badge.

See you tomorrow night!

Best regards,
Harry McLaren
Cyber Scotland Connect`,
  };
}

/**
 * Formats a downloaded Meetup attendee CSV into an operational venue check-in roster
 */
export function processAttendeeCsv(inputCsvContent: string): string {
  const lines = inputCsvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return 'No attendees found in input CSV.';

  const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
  const nameIdx = headers.findIndex((h) => /name/i.test(h));
  const statusIdx = headers.findIndex((h) => /status|response|rsvp/i.test(h));

  const attendees: Array<{ name: string; status: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
    const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : `Attendee #${i}`;
    const status = statusIdx !== -1 && cols[statusIdx] ? cols[statusIdx] : 'Yes';
    if (status.toLowerCase().includes('yes') || status.toLowerCase().includes('going') || statusIdx === -1) {
      attendees.push({ name, status: 'Going' });
    }
  }

  // Sort alphabetically by last word (surname)
  attendees.sort((a, b) => {
    const lastA = a.name.split(' ').pop() || a.name;
    const lastB = b.name.split(' ').pop() || b.name;
    return lastA.localeCompare(lastB);
  });

  const output: string[] = [
    `# Cyber Scotland Connect — Venue Security & Check-In Roster`,
    `Generated on: ${new Date().toISOString()}`,
    `Total Confirmed Attendees: ${attendees.length}`,
    ``,
    `| # | Attendee Name | Check-in Status | Notes |`,
    `|---|---|---|---|`,
  ];

  attendees.forEach((att, idx) => {
    output.push(`| ${idx + 1} | ${att.name} | [ ] Checked In | |`);
  });

  return output.join('\n');
}

/**
 * Generates browser automation navigation guide for Interceptor
 */
export function generateInterceptorRecipe(ctx: MeetupEventContext): string {
  const waitlistMsg = generateWaitlistBroadcast(ctx);

  return `
════════════════════════════════════════════════════════════════════════════════
🤖 INTERCEPTOR BROWSER AUTOMATION RECIPE: MEETUP.COM
════════════════════════════════════════════════════════════════════════════════
Target Event: ${ctx.title} (ID: ${ctx.eventId})
Group: ${ctx.groupSlug}
URL: ${ctx.meetupUrl}

1. ATTENDEE & WAITLIST BROADCAST RECIPE:
--------------------------------------------------------------------------------
Step 1: Open Chrome to the Attendees Management Page:
  https://www.meetup.com/${ctx.groupSlug}/events/${ctx.eventId}/attendees/

Step 2: Click the "Contact attendees" or "Email attendees" action button.
Step 3: In the recipient dropdown, choose: "${waitlistMsg.recipientFilter}"
Step 4: Set Subject:
  ${waitlistMsg.subject}

Step 5: Fill Body:
${waitlistMsg.body}

Step 6: Click "Send" or review preview.

--------------------------------------------------------------------------------
2. VENUE SECURITY CSV EXPORT RECIPE:
--------------------------------------------------------------------------------
Step 1: On the attendees management page (https://www.meetup.com/${ctx.groupSlug}/events/${ctx.eventId}/attendees/):
Step 2: Click the "Tools" or "Export" icon / button (Export attendee list).
Step 3: Save file as: temp/meetup-attendees-${ctx.date}.csv
Step 4: Run CLI roster formatter:
  bun run scripts/meetup-ops.ts roster temp/meetup-attendees-${ctx.date}.csv > docs/checkin-roster-${ctx.date}.md
════════════════════════════════════════════════════════════════════════════════
`;
}

// CLI Execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'broadcast';
  const targetSlug = args[1] && !args[1].endsWith('.csv') ? args[1] : undefined;

  if (cmd === 'list') {
    const list = listOfficialCscEvents();
    console.log(`\n📋 OFFICIAL CYBER SCOTLAND CONNECT EVENTS (${list.length} tracked):`);
    console.log(`--------------------------------------------------------------------------------`);
    for (const ev of list) {
      console.log(`• [${ev.date}] ${ev.title} (${ev.venue || 'TBD'}) -> ${ev.slug}`);
      if (ev.meetupUrl) console.log(`  Meetup: ${ev.meetupUrl}`);
    }
    process.exit(0);
  }

  const ctx = loadMeetupEventContext(targetSlug);

  switch (cmd) {
    case 'broadcast': {
      const waitlist = generateWaitlistBroadcast(ctx);
      const finalMsg = generateFinalReminderBroadcast(ctx);
      console.log(`\n================================================================================`);
      console.log(`📨 MEETUP BROADCAST 1: T-7 / T-4 WAITLIST & ATTENDANCE AUDIT (${ctx.city})`);
      console.log(`================================================================================`);
      console.log(`To: ${waitlist.recipientFilter}`);
      console.log(`Subject: ${waitlist.subject}\n`);
      console.log(waitlist.body);
      console.log(`\n================================================================================`);
      console.log(`📨 MEETUP BROADCAST 2: T-1 FINAL LOGISTICS & ARRIVAL REMINDER (${ctx.city})`);
      console.log(`================================================================================`);
      console.log(`To: ${finalMsg.recipientFilter}`);
      console.log(`Subject: ${finalMsg.subject}\n`);
      console.log(finalMsg.body);
      break;
    }

    case 'recipe': {
      console.log(generateInterceptorRecipe(ctx));
      break;
    }

    case 'roster': {
      const csvPath = args[1] || `temp/meetup-attendees-${ctx.date}.csv`;
      if (fs.existsSync(csvPath)) {
        const content = fs.readFileSync(csvPath, 'utf-8');
        console.log(processAttendeeCsv(content));
      } else {
        console.error(`Error: CSV file not found at ${csvPath}`);
        console.log(`Export from Meetup at: https://www.meetup.com/${ctx.groupSlug}/events/${ctx.eventId}/attendees/`);
      }
      break;
    }

    default: {
      console.log(`Usage: bun run scripts/meetup-ops.ts [list|broadcast|recipe|roster <file.csv>] [event-slug]`);
    }
  }
}
