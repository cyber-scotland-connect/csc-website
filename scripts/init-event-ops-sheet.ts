#!/usr/bin/env bun
/**
 * Initialize and Populate CSC Event Operations Master Sheet
 * Spreadsheet ID: 1mBerxQUjCWN70ddojZNWFIQVesVBnzut3bMl0gzmWgI
 */

import { execFileSync } from 'child_process';

const SPREADSHEET_ID = '1mBerxQUjCWN70ddojZNWFIQVesVBnzut3bMl0gzmWgI';
const AGY_ACCOUNT = 'harry.mclaren.uk@gmail.com';

function writeRange(sheetName: string, rangeA1: string, rows: string[][]) {
  const serialized = rows
    .map((row) =>
      row
        .map((cell) =>
          cell
            .replace(/\\/g, '\\\\')
            .replace(/,/g, '\\,')
            .replace(/\|/g, ' ')
        )
        .join(',')
    )
    .join('|');

  const fullRange = `'${sheetName}'!${rangeA1}`;
  console.log(`Writing to ${fullRange}...`);

  execFileSync('gsheets', [
    'mutate',
    'write',
    SPREADSHEET_ID,
    fullRange,
    serialized,
  ], {
    env: { ...process.env, AGY_ACCOUNT },
    stdio: 'inherit',
  });
}

function formatHeader(sheetId: number, colCount: number) {
  try {
    execFileSync('gsheets', [
      'mutate',
      'format',
      SPREADSHEET_ID,
      '--sheet-id',
      String(sheetId),
      '--start-row',
      '0',
      '--end-row',
      '1',
      '--start-col',
      '0',
      '--end-col',
      String(colCount),
      '--bold',
      '--bg-color',
      '#1E293B',
      '--fg-color',
      '#FFFFFF',
    ], {
      env: { ...process.env, AGY_ACCOUNT },
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn(`Format header warning:`, err);
  }
}

async function main() {
  console.log(`🚀 Initializing CSC Event Operations Master: ${SPREADSHEET_ID}`);

  // 1. Events Pipeline
  writeRange('Events Pipeline', 'A1:K3', [
    [
      'Event Slug',
      'City',
      'Target Date',
      'Time',
      'Venue',
      'Sponsor',
      'Status',
      'Budget (£)',
      'Meetup URL',
      'Lead Organizer',
      'Notes',
    ],
    [
      '2026-11-26-edinburgh-codebase',
      'Edinburgh',
      '2026-11-26',
      '17:30 - 20:30',
      'CodeBase Edinburgh',
      'RiverSafe',
      'Confirmed',
      '£300',
      'https://www.meetup.com/cyberscotconnect/events/316327219/',
      'Harry McLaren',
      'Volume 15 - 4 talks confirmed',
    ],
    [
      '2027-02-25-glasgow-spring',
      'Glasgow',
      '2027-02-25',
      '17:30 - 20:30',
      'Barclays Eagle Labs (Target)',
      'TBD',
      'Discovery',
      '£300',
      'TBD',
      'Harry McLaren',
      'CFP Pipeline sweep underway',
    ],
  ]);

  // 2. Venue Registry
  writeRange('Venue Registry', 'A1:K7', [
    [
      'Venue Name',
      'City',
      'Tier',
      'Capacity',
      'Step-Free Access',
      'Hearing Loop',
      'AV System',
      'Address',
      'Contact Person',
      'Contact Email/Link',
      'Status',
    ],
    [
      'CodeBase Edinburgh',
      'Edinburgh',
      'Medium',
      '80',
      'Yes (Verified)',
      'No',
      'Projector + HDMI + Clicker',
      '37a Castle Terrace Edinburgh EH1 2EL',
      'Events Team',
      'events@thisiscodebase.com',
      'Active Host',
    ],
    [
      'Skyscanner',
      'Edinburgh',
      'Large',
      '100',
      'Yes (Verified)',
      'Yes',
      'Auditorium AV + Mics',
      '1 Quartermile Edinburgh EH3 9AU',
      'Community Team',
      'community@skyscanner.net',
      'Active Host',
    ],
    [
      'FreeAgent',
      'Edinburgh',
      'Medium',
      '70',
      'Yes (Verified)',
      'Yes',
      'Screen + Wireless Mic',
      'One Edinburgh Quay Edinburgh EH3 9QG',
      'Events Liaison',
      'community@freeagent.com',
      'Active Host',
    ],
    [
      'Abertay CyberQuarter',
      'Dundee',
      'Medium',
      '60',
      'Yes (Verified)',
      'Yes',
      'Dual Displays + PA',
      'Bell St Dundee DD1 1HG',
      'CyberQuarter Team',
      'cyberquarter@abertay.ac.uk',
      'Active Host',
    ],
    [
      'Barclays Eagle Labs',
      'Glasgow',
      'Medium',
      '60',
      'Yes (Verified)',
      'Yes',
      'Screen + Sound',
      'B80 Tradeston Glasgow G5 8AG',
      'Labs Lead',
      'eaglelabs@barclays.com',
      'Prospective Host',
    ],
    [
      'Strathclyde TIC',
      'Glasgow',
      'Large',
      '120',
      'Yes (Verified)',
      'Yes',
      'Auditorium AV Suite',
      '99 George St Glasgow G1 1RD',
      'Events Office',
      'tic-events@strath.ac.uk',
      'Prospective Host',
    ],
  ]);

  // 3. Sponsors & Budget
  writeRange('Sponsors & Budget', 'A1:I3', [
    [
      'Sponsor Name',
      'Tier',
      'Budget (£)',
      'Pizzas (Est)',
      'Dietary Split (Meat/Veg/Vegan/GF)',
      'Drinks Unit Est',
      'Invoicing Status',
      'Key Contact',
      'Zero-Sales Charter',
    ],
    [
      'RiverSafe',
      'Ethical Event Sponsor',
      '£300',
      '25',
      '12 / 8 / 3 / 2',
      '40 units (Water/Diet/Beer)',
      'Invoiced',
      'Catering Coordinator',
      'Acknowledged (Zero Sales)',
    ],
    [
      'Adarma',
      'Ecosystem Sponsor',
      '£300',
      '25',
      '12 / 8 / 3 / 2',
      '40 units (Water/Diet/Beer)',
      'Prospective',
      'Community Relations',
      'Acknowledged (Zero Sales)',
    ],
  ]);

  // 4. Speaker & CFP Pipeline
  writeRange('Speaker & CFP Pipeline', 'A1:I7', [
    [
      'Speaker Name',
      'Organisation',
      'Talk Title',
      'Format',
      'Status',
      'City Availability',
      'LinkedIn Profile',
      'Slides Received',
      'AV / Hardware Needs',
    ],
    [
      'Gary Hunter',
      'Cyber Scotland Connect',
      'The Path to an Agentic SoC',
      'Standard (30m)',
      'Confirmed (Nov 2026)',
      'Edinburgh',
      'https://linkedin.com/in/gary-security/',
      'Ready',
      'House laptop',
    ],
    [
      'Joshua Adegoke',
      'Cyber Scotland Connect',
      'Reading Malware Config Off the Blockchain',
      'Lightning (15m)',
      'Confirmed (Nov 2026)',
      'Edinburgh',
      'https://linkedin.com/in/adegokejoshuao/',
      'Ready',
      'House laptop',
    ],
    [
      'Rory McCune',
      'Datadog',
      "Surviving 2026: A Security Practitioner's Field Guide to LLMs and Agents",
      'Standard (35m)',
      'Confirmed (Nov 2026)',
      'Edinburgh',
      'https://linkedin.com/in/rorym',
      'Pending',
      'HDMI (Mac)',
    ],
    [
      'Caleb Eghan',
      'RiverSafe',
      'Break the Bank: Welcome to the Other Side of the Login Screen',
      'Standard (35m)',
      'Confirmed (Nov 2026)',
      'Edinburgh',
      'https://linkedin.com/in/caleb-eghan-b60a2bba',
      'Pending',
      'Screen / Mic',
    ],
    [
      'Feride Omerova',
      'Edinburgh Napier University',
      'When AI Agents Go Rogue: Who’s Really in Control?',
      'Lightning (15m)',
      'Proposed (CFP Available)',
      'Edinburgh / Napier',
      'https://linkedin.com/in/feride-omerova-46439533b',
      'Pending',
      'HDMI + Mic',
    ],
    [
      'Hammed Ajibade',
      'Thankyu Ltd (Pulse)',
      'Revoke It Like a Direct Debit: Mandates for AI Agents in Ten Minutes',
      'Lightning (15m)',
      'Proposed (CFP Available)',
      'Edinburgh / Glasgow / Virtual',
      'https://linkedin.com/in/hammed-ajibade-010bb2116',
      'Pending',
      'HDMI (Mac)',
    ],
  ]);

  // 5. Mod Squad Roster
  writeRange('Mod Squad Roster', 'A1:H4', [
    [
      'Mod Name',
      'Discord Handle',
      'Roles Preferred',
      'Nov 2026 Shift',
      'Badge / Check-In',
      'Host Liaison',
      'AV / Soundcheck',
      'Photos & Live Updates',
    ],
    [
      'Harry McLaren',
      '@harrymclaren',
      'MC & Lead Coordinator',
      'Confirmed',
      'Backup',
      'Lead',
      'Backup',
      'Backup',
    ],
    [
      'Gary Hunter',
      '@garyhunter',
      'AV Tech & Co-Host',
      'Confirmed',
      'No',
      'Backup',
      'Lead',
      'Backup',
    ],
    [
      'Joshua Adegoke',
      '@joshuaadegoke',
      'Speaker Liaison & Check-in',
      'Confirmed',
      'Lead',
      'No',
      'Backup',
      'Lead',
    ],
  ]);

  // 6. Playbook Checklist
  writeRange('Playbook Checklist', 'A1:F15', [
    [
      'Milestone',
      'Task / Operational Requirement',
      'Owner',
      'Status',
      'Target Date',
      'Verified Evidence / Link',
    ],
    [
      'T-4 Weeks',
      'Lock in Venue & verify step-free + hearing loop',
      'Harry',
      'Complete',
      '2026-10-28',
      'CodeBase confirmed (step-free lift)',
    ],
    [
      'T-4 Weeks',
      'Confirm Event Sponsor & £300 catering budget',
      'Harry',
      'Complete',
      '2026-10-28',
      'RiverSafe confirmed',
    ],
    [
      'T-4 Weeks',
      'Publish Meetup listing & automated waitlist cap',
      'Harry',
      'Complete',
      '2026-10-28',
      'Meetup ID: 316327219',
    ],
    [
      'T-4 Weeks',
      'Genesis promotional post on LinkedIn & Discord',
      'Agent',
      'Complete',
      '2026-10-28',
      'Stream A (Launch)',
    ],
    [
      'T-2 Weeks',
      'Finalize 4 practitioner talks & AV specifications',
      'Harry',
      'Complete',
      '2026-11-12',
      'Gary, Joshua, Rory, Caleb locked',
    ],
    [
      'T-2 Weeks',
      'LinkedIn T-14 Speaker & Talk Lineup Spotlight',
      'Agent',
      'Ready to Dispatch',
      '2026-11-12',
      'Stream A (T-14)',
    ],
    [
      'T-1 Week',
      'Issue WhatsApp Mod Squad callout for check-in & AV',
      'Harry / Agent',
      'Pending',
      '2026-11-19',
      'WhatsApp Blast staged',
    ],
    [
      'T-1 Week',
      'Review Meetup RSVPs & send reminder to attendees',
      'Harry',
      'Pending',
      '2026-11-19',
      'Meetup message',
    ],
    [
      'T-3 Days',
      'Order 25 pizzas (50% meat / 30% veg / 10% vegan / 10% GF)',
      'Harry',
      'Pending',
      '2026-11-23',
      'Catering invoice (£300 budget)',
    ],
    [
      'T-2 Days',
      'Export Meetup attendee name list for CodeBase security',
      'Harry',
      'Pending',
      '2026-11-24',
      'CSV export to CodeBase team',
    ],
    [
      'T-1 Day',
      'LinkedIn T-1 Final Callout & Tomorrow Night reminder',
      'Agent',
      'Ready to Dispatch',
      '2026-11-25',
      'Stream A (T-1)',
    ],
    [
      'T-0 Day',
      '17:00 arrival for mod setup & AV lapel mic testing',
      'Mod Squad',
      'Pending',
      '2026-11-26',
      'On-site check at CodeBase',
    ],
    [
      'T-0 Day',
      '17:30 doors open & badge check-in desk',
      'Front Desk Mods',
      'Pending',
      '2026-11-26',
      'Main lobby desk',
    ],
    [
      '+1 Day',
      'Post-event LinkedIn & Email thank-you to host/sponsor/speakers',
      'Agent',
      'Ready to Dispatch',
      '2026-11-27',
      'Stream A (+1)',
    ],
  ]);

  console.log('✅ CSC Event Operations Master spreadsheet successfully populated!');
}

main().catch(console.error);
