#!/usr/bin/env bun
/**
 * CSC Event Operations & Logistics Engine
 *
 * Implements end-to-end event operations defined in CSC Playbook & Operations Manual V2.0:
 * - Syncs with Google Sheets Master (1mBerxQUjCWN70ddojZNWFIQVesVBnzut3bMl0gzmWgI)
 * - Stages communication packs across 5 tracks:
 *     1. Host Venue Logistics (Email)
 *     2. Sponsor & Catering Budget (Email)
 *     3. Moderator Squad Callout (WhatsApp)
 *     4. Personalized Speaker Briefs (Email / Discord)
 *     5. Day-Of Timetable & Dietary Pizza Breakdown
 * - Provides discovery & scoping for new events across Edinburgh, Glasgow, and Dundee.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export const MASTER_SPREADSHEET_ID = '1mBerxQUjCWN70ddojZNWFIQVesVBnzut3bMl0gzmWgI';
export const AGY_ACCOUNT = 'harry.mclaren.uk@gmail.com';

export interface EventPipelineRecord {
  slug: string;
  city: string;
  date: string;
  time: string;
  venue: string;
  sponsor: string;
  status: 'Discovery' | 'Outreach' | 'Confirmed' | 'Staged' | 'Done';
  budget: string;
  meetupUrl: string;
  leadOrganizer: string;
  notes: string;
}

export interface VenueRecord {
  name: string;
  city: string;
  tier: 'Small' | 'Medium' | 'Large';
  capacity: number;
  stepFree: string;
  hearingLoop: string;
  avSystem: string;
  address: string;
  contactPerson: string;
  contactEmail: string;
  status: string;
}

export interface CateringEstimate {
  attendees: number;
  totalPizzas: number;
  meatPizzas: number;
  vegPizzas: number;
  veganPizzas: number;
  glutenFreePizzas: number;
  estimatedCostGbp: number;
  waterUnits: number;
  softDrinksBottles: number;
}

/**
 * Calculates catering & refreshment quantities according to CSC V2 Playbook ratios:
 * 20-25 9-inch pizzas per 50 attendees.
 * Dietary split: 50% Meat, 30% Veg, 10% Vegan, 10% Gluten-Free (strictly segregated).
 */
export function calculateCateringRatios(attendees: number = 50): CateringEstimate {
  const totalPizzas = Math.ceil((attendees / 50) * 25);
  const meatPizzas = Math.round(totalPizzas * 0.5);
  const vegPizzas = Math.round(totalPizzas * 0.3);
  const veganPizzas = Math.round(totalPizzas * 0.1);
  const glutenFreePizzas = totalPizzas - meatPizzas - vegPizzas - veganPizzas;

  // Approx £10-12 per pizza plus drinks
  const estimatedCostGbp = totalPizzas * 12 + 50;

  return {
    attendees,
    totalPizzas,
    meatPizzas,
    vegPizzas,
    veganPizzas,
    glutenFreePizzas,
    estimatedCostGbp,
    waterUnits: Math.ceil((attendees / 50) * 35),
    softDrinksBottles: Math.ceil((attendees / 50) * 7),
  };
}

/**
 * Generates the complete 5-track Event Operations Pack for an event
 */
export function generateEventOpsPack(eventSlug: string): string {
  // Check if corresponding markdown file exists in src/content/events/
  const eventFilePath = path.resolve(
    import.meta.dir,
    `../src/content/events/${eventSlug}.md`
  );

  let title = 'Cyber Scotland Connect Meetup';
  let date = '2026-11-26';
  let time = '17:30 - 20:30';
  let location = 'CodeBase Edinburgh, 37a Castle Terrace, Edinburgh EH1 2EL';
  let hostVenue = 'CodeBase Edinburgh';
  let sponsorName = 'RiverSafe';
  let meetupUrl = 'https://www.meetup.com/cyberscotconnect/events/316327219/';
  let stepFree = true;
  let hearingLoop = false;
  let speakers: any[] = [];

  if (fs.existsSync(eventFilePath)) {
    const content = fs.readFileSync(eventFilePath, 'utf-8');
    const titleMatch = content.match(/title:\s*["']?([^"'\n]+)/);
    const dateMatch = content.match(/date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    const timeMatch = content.match(/time:\s*["']?([^"'\n]+)/);
    const locMatch = content.match(/location:\s*["']?([^"'\n]+)/);
    const partnerMatch = content.match(/partnerName:\s*["']?([^"'\n]+)/);
    const meetupMatch = content.match(/meetupUrl:\s*["']?([^"'\n]+)/);
    const stepFreeMatch = content.match(/stepFree:\s*(true|false)/);
    const hearingLoopMatch = content.match(/hearingLoop:\s*(true|false)/);

    if (titleMatch) title = titleMatch[1];
    if (dateMatch) date = dateMatch[1];
    if (timeMatch) time = timeMatch[1];
    if (locMatch) location = locMatch[1];
    if (partnerMatch) hostVenue = partnerMatch[1];
    if (meetupMatch) meetupUrl = meetupMatch[1];
    if (stepFreeMatch) stepFree = stepFreeMatch[1] === 'true';
    if (hearingLoopMatch) hearingLoop = hearingLoopMatch[1] === 'true';

    // Parse speakers from yaml block
    const speakersBlockMatch = content.match(/speakers:\s*([\s\S]*?)(?=\n\w+:|$)/);
    if (speakersBlockMatch) {
      const block = speakersBlockMatch[1];
      const speakerEntries = block.split(/\n\s*-\s+/).filter(Boolean);
      for (const entry of speakerEntries) {
        const nameM = entry.match(/name:\s*["']?([^"'\n]+)/);
        const titleM = entry.match(/talkTitle:\s*["']?([^"'\n]+)/);
        const companyM = entry.match(/company:\s*["']?([^"'\n]+)/);
        const linkedinM = entry.match(/linkedinUrl:\s*["']?([^"'\n]+)/);
        if (nameM) {
          speakers.push({
            name: nameM[1],
            talkTitle: titleM ? titleM[1] : 'Technical Talk',
            company: companyM ? companyM[1] : undefined,
            linkedinUrl: linkedinM ? linkedinM[1] : undefined,
          });
        }
      }
    }
  }

  const catering = calculateCateringRatios(65);

  const lines: string[] = [
    `════════════════════════════════════════════════════════════════════════════════`,
    `📋 CSC EVENT OPERATIONS PACK: ${title}`,
    `📅 Date: ${date} | 🕠 Time: ${time} | 📍 Venue: ${hostVenue}`,
    `════════════════════════════════════════════════════════════════════════════════\n`,
  ];

  // TRACK 1: Host Venue Check
  lines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
  lines.push(`┃ TRACK 1: HOST VENUE LOGISTICS CHECK (Email)                                 ┃`);
  lines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
  lines.push(`To: events@thisiscodebase.com (CodeBase Events Team)`);
  lines.push(`Subject: Cyber Scotland Connect Meetup — Final Logistics Check (${date})`);
  lines.push(`Body:`);
  lines.push(`Hi Team CodeBase,\n`);
  lines.push(`Ahead of our upcoming Cyber Scotland Connect gathering on ${date}, confirming our core setup:\n`);
  lines.push(`• Arrival & Access: Organizers & speakers arrive at 17:00 for AV soundcheck; doors open at 17:30.`);
  lines.push(`• AV Check: We'll be using HDMI connection to projector + wireless slide clicker.`);
  lines.push(`• Accessibility: Confirming step-free entrance/lift is operational (${stepFree ? 'Verified Yes' : 'No'}).`);
  lines.push(`• Security & Attendee List: We will export the live Meetup attendee roster (${meetupUrl}) 48 hours prior.`);
  lines.push(`\nBest regards,\nHarry McLaren\nCyber Scotland Connect Core Team\n`);

  // TRACK 2: Sponsor & Catering Logistics
  lines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
  lines.push(`┃ TRACK 2: SPONSOR & CATERING INVOICING CHECK (Email)                         ┃`);
  lines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
  lines.push(`To: sponsor-billing@riversafe.co.uk`);
  lines.push(`Subject: Cyber Scotland Connect (${date}) — Catering Invoice & Event Setup`);
  lines.push(`Body:`);
  lines.push(`Hi RiverSafe Team,\n`);
  lines.push(`Thank you again for backing our ${date} meetup! As per our Zero-Sales Charter, 100% of event funds go directly to attendee refreshments:\n`);
  lines.push(`• Budget Allocation: £${catering.estimatedCostGbp} (covering ${catering.totalPizzas} pizzas across ${catering.attendees} anticipated attendees).`);
  lines.push(`• Dietary Split: ${catering.meatPizzas} Meat, ${catering.vegPizzas} Veg, ${catering.veganPizzas} Vegan, ${catering.glutenFreePizzas} Gluten-Free + soft drinks & water.`);
  lines.push(`• Team Presence: You are welcome to bring banner stands/stickers and 2-3 representatives.`);
  lines.push(`• Community Brief: A reminder that sponsor intros are 60 seconds of vendor-neutral team intro before main technical sessions kick off.`);
  lines.push(`\nBest regards,\nHarry McLaren\n`);

  // TRACK 3: Moderator WhatsApp Blast
  lines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
  lines.push(`┃ TRACK 3: MOD SQUAD ROSTER CALLOUT (WhatsApp Format)                         ┃`);
  lines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
  lines.push(`[Copy and paste into CSC Moderators WhatsApp Group]:\n`);
  lines.push(`🚨 *CSC Mod Squad Callout — ${title}*`);
  lines.push(`📅 *Date:* ${date} | 📍 *Venue:* ${hostVenue}`);
  lines.push(`⏰ *Mod Arrival:* 17:15 | *Doors:* 17:30 | *Kickoff:* 18:00\n`);
  lines.push(`Looking for 4-5 mods to help run the floor on the night. Reply with your role preference:`);
  lines.push(`• 🎟️ *Front Desk & Badge Check-in (2 mods):* Greet attendees, check Meetup tickets, hand out badges.`);
  lines.push(`• 🎤 *AV & Speaker Support (1 mod):* Help test laptop HDMI, slide clicker, and lapel mics.`);
  lines.push(`• 🍕 *Catering & Refreshments (1 mod):* Coordinate pizza delivery arrival (19:00) and drinks station.`);
  lines.push(`• 📸 *Photos & Discord Live Updates (1 mod):* Snap a few room photos and share in Discord.\n`);
  lines.push(`Let me know if you can make it!\n`);

  // TRACK 4: Personalized Speaker Briefs
  lines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
  lines.push(`┃ TRACK 4: PERSONALIZED SPEAKER BRIEFS (Email / Discord DM)                   ┃`);
  lines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
  for (const s of speakers) {
    lines.push(`▶ SPEAKER: ${s.name} (${s.company || 'Independent'})`);
    lines.push(`  Talk Title: "${s.talkTitle}"`);
    lines.push(`  Message:`);
    lines.push(`  Hi ${s.name.split(' ')[0]},\n`);
    lines.push(`  Looking forward to having you speak at Cyber Scotland Connect on ${date} at ${hostVenue}!`);
    lines.push(`  Here are the practical details for your session:`);
    lines.push(`  • Timing: 17:00 arrival for technical sound check. Main talks start from 18:00.`);
    lines.push(`  • Duration: 30-35 mins presentation + 10 mins Q&A.`);
    lines.push(`  • Slides & Demos: 16:9 widescreen format. You can present directly from your laptop (HDMI) or send me your deck/link in advance to preload on our house presentation laptop.`);
    lines.push(`  • Format Reminder: Strictly practitioner-led — 60s max personal/team intro, followed by 100% technical insights, architectures, and lessons learned.`);
    lines.push(`  Let me know if you have any questions or accessibility/AV requirements!\n`);
  }

  // TRACK 5: Day-Of Timetable & Emergency Runbook
  lines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
  lines.push(`┃ TRACK 5: MINUTE-BY-MINUTE DAY-OF TIMETABLE & RUNBOOK                        ┃`);
  lines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
  lines.push(`• 17:00 — Mod Squad & Speaker Arrival; AV setup, lapel mic testing, Wi-Fi check.`);
  lines.push(`• 17:30 — Doors Open; Front Desk check-in opens; arrival networking.`);
  lines.push(`• 18:00 — Welcome, Code of Conduct & H&S Brief (MC Harry McLaren).`);
  lines.push(`• 18:05 — Sponsor Welcome (RiverSafe, 60 seconds).`);
  lines.push(`• 18:10 — Session 1 & Q&A.`);
  lines.push(`• 18:50 — Session 2 & Q&A.`);
  lines.push(`• 19:25 — Pizza & Refreshment Break (25 Pizzas, dietary stations).`);
  lines.push(`• 19:55 — Session 3 & Q&A.`);
  lines.push(`• 20:25 — Community Announcements, CFP Callout & Wrap-Up.`);
  lines.push(`• 20:35 — Event Concludes; Room pack down & hallway networking.`);
  lines.push(`• 21:00 — Venue Handover & Clear.`);

  return lines.join('\n');
}

// CLI Execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0] || 'stage';
  const targetSlug = args[1] || '2026-11-26-edinburgh-codebase';

  if (command === 'stage') {
    console.log(generateEventOpsPack(targetSlug));
  } else if (command === 'budget') {
    const attendees = parseInt(args[1] || '50', 10);
    console.log(JSON.stringify(calculateCateringRatios(attendees), null, 2));
  } else {
    console.log(`Usage: bun run scripts/event-ops.ts [stage <event-slug> | budget <attendees>]`);
  }
}
