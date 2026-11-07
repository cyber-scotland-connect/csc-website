#!/usr/bin/env bun
/**
 * CSC Native Google Slides Automation Engine
 *
 * Automates creation and population of event slide decks directly in Google Slides:
 * - Clones Master Google Slide Template (16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ)
 * - Parses event metadata, speakers, agenda, venue, and sponsors from src/content/events/<slug>.md
 * - Pulls verified partner metadata (descriptions, logos) from src/content/partners/
 * - Compiles all updates into a single batch JSON payload executed in ONE API call via `gslides mutate batch`
 * - Binds strictly to visual boundaries to prevent text box wrapping or card collisions
 * - Replaces placeholder brackets across speaker takeaways, partners, and community slides
 * - Exports production PDF to dist/slides/<slug>.pdf
 *
 * Usage:
 *   bun run scripts/slide-ops.ts [event-slug]
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export const MASTER_TEMPLATE_ID = '16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ';
export const AGY_ACCOUNT = 'harry.mclaren.uk@gmail.com';

export interface Speaker {
  name: string;
  role?: string;
  company?: string;
  talkTitle: string;
  abstract?: string;
  linkedinUrl?: string;
}

export interface AgendaItem {
  time: string;
  title: string;
  speaker?: string;
  description?: string;
  type?: string;
}

export interface PartnerDetails {
  name: string;
  tier?: string;
  websiteUrl?: string;
  description?: string;
  logoUrl?: string;
}

export interface EventMetadata {
  title: string;
  date: string;
  formattedDate: string;
  nextMonthFormatted: string;
  time: string;
  hostVenue: string;
  location: string;
  sponsorName: string;
  leadOrganizer: string;
  wifiNetwork: string;
  speakers: Speaker[];
  agenda: AgendaItem[];
  hostPartner?: PartnerDetails;
  sponsorPartner?: PartnerDetails;
}

export interface BatchOp {
  op: string;
  element?: string;
  slide?: string;
  text?: string;
  url?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  font_family?: string;
  font_size?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: string;
}

function updateAndStyle(
  ops: BatchOp[],
  element: string,
  text: string,
  fontSize?: number,
  color?: string,
  bold?: boolean,
  alignment?: 'START' | 'CENTER' | 'END'
) {
  ops.push({ op: 'update-text', element, text });
  const styleOp: BatchOp = {
    op: 'style-text',
    element,
    font_family: 'Plus Jakarta Sans',
  };
  if (fontSize) styleOp.font_size = fontSize;
  if (color) styleOp.color = color;
  if (bold !== undefined) styleOp.bold = bold;
  ops.push(styleOp);

  if (alignment) {
    ops.push({
      op: 'style-paragraph',
      element,
      alignment,
    });
  }
}

/**
 * Extracts a quoted or unquoted frontmatter scalar safely preserving inner apostrophes.
 */
function extractScalar(text: string, field: string): string | undefined {
  const regex = new RegExp(`^\\s*(?:-\\s*)?${field}:\\s*(?:"([^"\\n]+)"|'([^'\\n]+)'|([^\\n]+))`, 'm');
  const match = text.match(regex);
  if (!match) return undefined;
  return (match[1] || match[2] || match[3] || '').trim();
}

/**
 * Searches src/content/partners/*.md for matching partner/sponsor details.
 */
export function getPartnerDetails(partnerName: string): PartnerDetails | undefined {
  if (!partnerName) return undefined;
  const partnersDir = path.resolve(import.meta.dir || process.cwd(), '../src/content/partners');
  if (!fs.existsSync(partnersDir)) return undefined;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(partnerName);

  const files = fs.readdirSync(partnersDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(partnersDir, file), 'utf-8');
    const name = extractScalar(content, 'name') || file.replace('.md', '');
    const tier = extractScalar(content, 'tier');
    const websiteUrl = extractScalar(content, 'websiteUrl');
    const description = extractScalar(content, 'description');
    const logoUrl = extractScalar(content, 'logoUrl') || extractScalar(content, 'logo');

    if (norm(name).includes(target) || target.includes(norm(name)) || norm(file.replace('.md', '')) === target) {
      return { name, tier, websiteUrl, description, logoUrl };
    }
  }
  return undefined;
}

export function parseEventMarkdown(eventSlug: string): EventMetadata {
  const filePath = path.resolve(
    import.meta.dir || process.cwd(),
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
  const agenda: AgendaItem[] = [];

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');

    const titleVal = extractScalar(content, 'title');
    const dateVal = extractScalar(content, 'date');
    const timeVal = extractScalar(content, 'time');
    const locVal = extractScalar(content, 'location');
    const hostVal = extractScalar(content, 'hostVenue');
    const sponsorM = content.match(/sponsors:\s*\n\s*-\s*["']?([^"'\n]+)/);

    if (titleVal) title = titleVal;
    if (dateVal) date = dateVal;
    if (timeVal) time = timeVal;
    if (locVal) location = locVal;
    if (hostVal) hostVenue = hostVal;
    if (sponsorM) sponsorName = sponsorM[1].trim();

    // Parse speakers block
    const speakersMatch = content.match(/speakers:\s*([\s\S]*?)(?=\n[a-zA-Z0-9_-]+:|$)/);
    if (speakersMatch) {
      const block = speakersMatch[1];
      const entries = block.split(/\n\s*-\s+/).filter(Boolean);
      for (const entry of entries) {
        const name = extractScalar(entry, 'name');
        const role = extractScalar(entry, 'role');
        const company = extractScalar(entry, 'company');
        const talkTitle = extractScalar(entry, 'talkTitle') || 'Technical Talk';
        const abstract = extractScalar(entry, 'abstract');
        const linkedinUrl = extractScalar(entry, 'linkedinUrl');

        if (name) {
          speakers.push({
            name,
            role,
            company,
            talkTitle,
            abstract,
            linkedinUrl,
          });
        }
      }
    }

    // Parse agenda block
    const agendaMatch = content.match(/agenda:\s*([\s\S]*?)(?=\n---\n|$)/);
    if (agendaMatch) {
      const block = agendaMatch[1];
      const items = block.split(/\n\s*-\s+/).filter(Boolean);
      for (const item of items) {
        const itemTime = extractScalar(item, 'time');
        const itemTitle = extractScalar(item, 'title');
        const itemSpeaker = extractScalar(item, 'speaker');
        const itemDesc = extractScalar(item, 'description');
        const itemType = extractScalar(item, 'type');

        if (itemTime && itemTitle) {
          agenda.push({
            time: itemTime,
            title: itemTitle,
            speaker: itemSpeaker,
            description: itemDesc,
            type: itemType,
          });
        }
      }
    }
  }

  // Format date nicely (e.g. NOVEMBER 2026)
  const d = new Date(date);
  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  const formattedDate = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

  // Next month calculation
  const nextMonthIdx = (d.getMonth() + 1) % 12;
  const nextYear = nextMonthIdx === 0 ? d.getFullYear() + 1 : d.getFullYear();
  const nextMonthFormatted = `${monthNames[nextMonthIdx]} ${nextYear}`;

  const hostPartner = getPartnerDetails(hostVenue);
  const sponsorPartner = getPartnerDetails(sponsorName);

  return {
    title,
    date,
    formattedDate,
    nextMonthFormatted,
    time,
    hostVenue,
    location,
    sponsorName,
    leadOrganizer,
    wifiNetwork,
    speakers,
    agenda,
    hostPartner,
    sponsorPartner,
  };
}

function runGslides(args: string[]): string {
  return execFileSync('gslides', args, {
    env: { ...process.env, AGY_ACCOUNT },
    encoding: 'utf-8',
  });
}

export function provisionEventSlideDeck(eventSlug: string): { url: string; pdfPath: string } {
  const meta = parseEventMarkdown(eventSlug);
  const deckTitle = `${meta.date.slice(0, 7)} - CSC in ${meta.hostVenue.split(' ')[0]} (${meta.hostVenue})`;

  console.log(`\n════════════════════════════════════════════════════════════════════════════════`);
  console.log(`🎯 PROVISIONING GOOGLE SLIDE DECK: ${deckTitle}`);
  console.log(`════════════════════════════════════════════════════════════════════════════════\n`);

  console.log(`[1/3] Cloning Upgraded Master Slide Template (${MASTER_TEMPLATE_ID})...`);
  const copyRes = runGslides(['mutate', 'copy', MASTER_TEMPLATE_ID, deckTitle, '--json']);

  const idMatch = copyRes.match(/\(ID:\s*([a-zA-Z0-9_-]+)\)/);
  if (!idMatch) {
    throw new Error(`Failed to copy slide presentation: ${copyRes}`);
  }
  const presId = idMatch[1];
  console.log(`✔ Cloned presentation ID: ${presId}`);

  console.log(`[2/3] Compiling Single-Batch Atomic Operations...`);
  const ops: BatchOp[] = [];

  // Slide 1: Title & Venue
  updateAndStyle(ops, 'p1_i10', meta.formattedDate, 10.5, '#6FB7E6', true, 'START');
  updateAndStyle(ops, 'p1_i15', meta.hostVenue, 11, '#FFFFFF', true, 'START');
  updateAndStyle(ops, 'p1_i17', meta.leadOrganizer, 11, '#FFFFFF', true, 'START');
  updateAndStyle(ops, 'p1_i19', meta.wifiNetwork, 11, '#FFFFFF', true, 'START');

  // Slide 3: Partners & Sponsors
  updateAndStyle(ops, 'p3_i21', meta.hostVenue, 15, '#21203A', true, 'CENTER');
  if (meta.hostPartner?.description) {
    updateAndStyle(ops, 'p3_i18', meta.hostPartner.description, 10.5, '#382B5C', false, 'CENTER');
  }

  updateAndStyle(ops, 'p3_i22', meta.sponsorName, 15, '#21203A', true, 'CENTER');
  if (meta.sponsorPartner?.description) {
    updateAndStyle(ops, 'p3_i19', meta.sponsorPartner.description, 10.5, '#382B5C', false, 'CENTER');
  }

  // Slide 5: Run of Show / Agenda Timeline
  const agendaSlots = [
    { x: 60.75, time: 'p5_i22', title: 'p5_i28', desc: 'p5_i29' },
    { x: 199.5, time: 'p5_i23', title: 'p5_i30', desc: 'p5_i31' },
    { x: 339.0, time: 'p5_i24', title: 'p5_i32', desc: 'p5_i33' },
    { x: 498.75, time: 'p5_i25', title: 'p5_i34', desc: 'p5_i35' },
    { x: 638.25, time: 'p5_i26', title: 'p5_i36', desc: 'p5_i37' },
    { x: 798.0, time: 'p5_i27', title: 'p5_i38', desc: 'p5_i39' },
  ];

  const basePt = 3000000 / 12700; // 236.22047 pt
  for (let i = 0; i < Math.min(agendaSlots.length, meta.agenda.length); i++) {
    const slot = agendaSlots[i];
    const ag = meta.agenda[i];

    // Format title cleanly so it never wraps awkwardly
    let displayTitle = ag.title;
    if (displayTitle.includes('NullReceiver')) {
      displayTitle = 'Reading Malware Config Off Blockchain';
    } else if (displayTitle.includes('Field Guide')) {
      displayTitle = 'Field Guide: LLMs & Agents in 2026';
    } else if (displayTitle.includes('Other Side of the Login Screen')) {
      displayTitle = 'Break the Bank: Beyond the Login Screen';
    } else if (displayTitle.length > 36) {
      displayTitle = displayTitle.slice(0, 34).trim() + '…';
    }

    const speakerOrDesc = ag.speaker || ag.description || '';
    const displayDesc = speakerOrDesc.length > 36 ? speakerOrDesc.slice(0, 34).trim() + '…' : speakerOrDesc;

    // Time: 12pt bold purple
    updateAndStyle(ops, slot.time, ag.time, 12, '#895294', true, 'START');

    // Title: Resize box to y=282, h=36, 9.5pt bold #21203A
    ops.push({
      op: 'resize-element',
      element: slot.title,
      x: slot.x,
      y: 282,
      width: Math.round((112 / basePt) * 100000) / 100000,
      height: Math.round((36 / basePt) * 100000) / 100000,
    });
    updateAndStyle(ops, slot.title, displayTitle, 9.5, '#21203A', true, 'START');

    // Speaker / Desc: Shift down to y=326, h=45, 8.5pt #56548C
    ops.push({
      op: 'resize-element',
      element: slot.desc,
      x: slot.x,
      y: 326,
      width: Math.round((112 / basePt) * 100000) / 100000,
      height: Math.round((45 / basePt) * 100000) / 100000,
    });
    updateAndStyle(ops, slot.desc, displayDesc, 8.5, '#56548C', false, 'START');
  }

  // Slides 6–9: Speaker Slides
  const speakerSlideSlots = [
    {
      slide: 'p6',
      name: 'p6_i15',
      role: 'p6_i16',
      bio: 'p6_i17',
      abstract: 'p6_i19',
      linkedin: 'p6_i20',
      title: 'p6_i22',
      takeaways: ['p6_i25', 'p6_i27', 'p6_i29'],
    },
    {
      slide: 'SLIDES_API1026256293_0',
      name: 'SLIDES_API1026256293_11',
      role: 'SLIDES_API1026256293_12',
      bio: 'SLIDES_API1026256293_13',
      abstract: 'SLIDES_API1026256293_15',
      linkedin: 'SLIDES_API1026256293_16',
      title: 'SLIDES_API1026256293_17',
      takeaways: ['SLIDES_API1026256293_20', 'SLIDES_API1026256293_22', 'SLIDES_API1026256293_24'],
    },
    {
      slide: 'SLIDES_API892654743_0',
      name: 'SLIDES_API892654743_11',
      role: 'SLIDES_API892654743_12',
      bio: 'SLIDES_API892654743_13',
      abstract: 'SLIDES_API892654743_15',
      linkedin: 'SLIDES_API892654743_16',
      title: 'SLIDES_API892654743_17',
      takeaways: ['SLIDES_API892654743_20', 'SLIDES_API892654743_22', 'SLIDES_API892654743_24'],
    },
    {
      slide: 'SLIDES_API436520312_0',
      name: 'SLIDES_API436520312_11',
      role: 'SLIDES_API436520312_12',
      bio: 'SLIDES_API436520312_13',
      abstract: 'SLIDES_API436520312_15',
      linkedin: 'SLIDES_API436520312_16',
      title: 'SLIDES_API436520312_17',
      takeaways: ['SLIDES_API436520312_20', 'SLIDES_API436520312_22', 'SLIDES_API436520312_24'],
    },
  ];

  for (let i = 0; i < 4; i++) {
    const slot = speakerSlideSlots[i];
    if (i < meta.speakers.length) {
      const s = meta.speakers[i];
      const roleText = [s.role, s.company].filter(Boolean).join(', ') || 'Cyber Scotland Connect';
      updateAndStyle(ops, slot.name, s.name, 15, '#21203A', true, 'CENTER');
      updateAndStyle(ops, slot.role, roleText, 10, '#895294', true, 'CENTER');
      updateAndStyle(ops, slot.title, s.talkTitle, 18, '#21203A', true, 'START');

      if (s.abstract) {
        const compactAbstract = s.abstract.length > 130 ? s.abstract.slice(0, 127).trim() + '...' : s.abstract;
        updateAndStyle(ops, slot.abstract, compactAbstract, 10.5, '#382B5C', false, 'START');
      }
      if (s.linkedinUrl) {
        const handle = s.linkedinUrl.replace(/.*linkedin\.com\/in\/([^/]+).*/, '$1') || s.name.toLowerCase().replace(/\s+/g, '-');
        updateAndStyle(ops, slot.linkedin, `in/${handle}`, 8.5, '#21203A', true, 'START');
      }

      // Replace generic brackets in takeaways with professional domain points
      const defaultTakeaways = [
        'Practical implementation insights & methodologies',
        'Lessons learned from production security environments',
        'Recommended tools, open frameworks & guidance',
      ];
      for (let t = 0; t < slot.takeaways.length; t++) {
        updateAndStyle(ops, slot.takeaways[t], defaultTakeaways[t], 10, '#21203A', false, 'START');
      }
    } else {
      ops.push({ op: 'delete-slide', slide: slot.slide });
    }
  }

  // Slide 12: Thanks Slide
  updateAndStyle(ops, 'p9_i22', meta.hostVenue, 12.75, '#21203A', true, 'CENTER');
  if (meta.hostPartner?.description) {
    updateAndStyle(ops, 'p9_i23', meta.hostPartner.description, 9.5, '#56548C', false, 'CENTER');
  }
  updateAndStyle(ops, 'p9_i24', meta.sponsorName, 12.75, '#21203A', true, 'CENTER');
  if (meta.sponsorPartner?.description) {
    updateAndStyle(ops, 'p9_i25', meta.sponsorPartner.description, 9.5, '#56548C', false, 'CENTER');
  }

  // Slide 13: Closing & Pub
  updateAndStyle(ops, 'p10_i17', `Next gathering: ${meta.nextMonthFormatted} • RSVPs open on Meetup.`, 12, '#BDACCF', false, 'CENTER');
  updateAndStyle(ops, 'p10_i19', `Social: Local Pub (Central ${meta.location.includes('Edinburgh') ? 'Edinburgh' : 'Glasgow'}) (All Welcome)`, 9.5, '#FFFFFF', true, 'CENTER');

  // Write batch payload to dist/slides/batch-ops.json
  const batchDir = path.resolve(import.meta.dir || process.cwd(), '../dist/slides');
  fs.mkdirSync(batchDir, { recursive: true });
  const batchFilePath = path.join(batchDir, `batch-${eventSlug}.json`);
  fs.writeFileSync(batchFilePath, JSON.stringify(ops, null, 2), 'utf-8');

  console.log(`Executing ${ops.length} atomic operations via single gslides mutate batch call...`);
  runGslides(['mutate', 'batch', presId, '--file', batchFilePath]);
  console.log(`✔ Batch operations completed successfully.`);

  console.log(`[3/3] Exporting Production PDF...`);
  const pdfPath = path.join(batchDir, `${eventSlug}.pdf`);
  runGslides(['readonly', 'export', presId, pdfPath, '--format', 'pdf']);
  console.log(`✔ Production PDF exported to: ${pdfPath}`);

  const slidesUrl = `https://docs.google.com/presentation/d/${presId}/edit`;
  console.log(`\n✔ Slide Deck Provisioning Complete!`);
  console.log(`👉 Editable Google Slides Link: ${slidesUrl}\n`);

  return { url: slidesUrl, pdfPath };
}

if (import.meta.main) {
  const targetSlug = process.argv[2] || '2026-11-26-edinburgh-codebase';
  provisionEventSlideDeck(targetSlug);
}
