#!/usr/bin/env bun
/**
 * CSC Native Google Slides Automation Engine
 *
 * Automates creation and population of event slide decks directly in Google Slides:
 * - Clones Master Google Slide Template (16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ)
 * - Parses event metadata, speakers, agenda, venue, and sponsors from src/content/events/<slug>.md
 * - Pulls verified partner metadata (descriptions, logos) from src/content/partners/
 * - Dynamically scans upcoming partner/sister events (next 30 days) and next meetup month/city
 * - Dynamically resizes and spaces agenda timeline cards (3–6 items)
 * - Repurposes Open Mic jobs card to direct Discord #careers signpost
 * - Drops Slido Poll slide (p7) by default unless active poll frontmatter exists
 * - Ingests custom practitioner speaker takeaways
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
  takeaways?: string[];
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

export interface UpcomingSisterEvent {
  title: string;
  date: string;
  formattedDate: string;
  city: string;
  organizerType?: string;
}

export interface PollConfig {
  code: string;
  question: string;
  options: string[];
}

export interface EventMetadata {
  title: string;
  date: string;
  formattedDate: string;
  nextMonthFormatted: string;
  nextGatheringText: string;
  time: string;
  hostVenue: string;
  location: string;
  pub?: string;
  sponsorName: string;
  leadOrganizer: string;
  wifiNetwork: string;
  speakers: Speaker[];
  agenda: AgendaItem[];
  hostPartner?: PartnerDetails;
  sponsorPartner?: PartnerDetails;
  sisterEvents: UpcomingSisterEvent[];
  poll?: PollConfig;
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
  const partnersDir = path.resolve(process.cwd(), 'src/content/partners');
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

/**
 * Scans src/content/events/*.md for upcoming partner and community events within 30 days.
 */
export function getUpcomingSisterEvents(currentEventDate: string, currentEventSlug: string): UpcomingSisterEvent[] {
  const eventsDir = path.resolve(process.cwd(), 'src/content/events');
  if (!fs.existsSync(eventsDir)) return [];

  const baseDate = new Date(currentEventDate);
  const maxDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const results: UpcomingSisterEvent[] = [];
  const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.md') && !f.includes(currentEventSlug));

  for (const file of files) {
    const content = fs.readFileSync(path.join(eventsDir, file), 'utf-8');
    const dateStr = extractScalar(content, 'date');
    const title = extractScalar(content, 'title') || file.replace('.md', '');
    const city = extractScalar(content, 'city') || 'Scotland';
    const organizerType = extractScalar(content, 'organizerType') || 'Community';

    if (!dateStr) continue;
    const evDate = new Date(dateStr);
    if (evDate >= baseDate && evDate <= maxDate) {
      const formattedDate = `${String(evDate.getDate()).padStart(2, '0')} ${monthAbbr[evDate.getMonth()]}`;
      results.push({
        title,
        date: dateStr,
        formattedDate,
        city,
        organizerType,
      });
    }
  }

  // Sort chronologically ascending
  results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return results.slice(0, 3);
}

/**
 * Scans src/content/events/*.md for the next scheduled CSC gathering after the current event.
 */
export function getNextGatheringInfo(currentEventDate: string, currentEventSlug: string): { city: string; monthFormatted: string } | undefined {
  const eventsDir = path.resolve(process.cwd(), 'src/content/events');
  if (!fs.existsSync(eventsDir)) return undefined;

  const baseDate = new Date(currentEventDate);
  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.md') && !f.includes(currentEventSlug));
  const upcomingMeetups: { date: Date; city: string }[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(eventsDir, file), 'utf-8');
    const isPartner = extractScalar(content, 'isPartnerEvent') === 'true';
    if (isPartner) continue;

    const title = extractScalar(content, 'title') || '';
    if (!title.toLowerCase().includes('cyber scotland connect')) continue;

    const dateStr = extractScalar(content, 'date');
    const city = extractScalar(content, 'city') || (title.includes('Glasgow') ? 'Glasgow' : 'Edinburgh');
    if (!dateStr) continue;

    const evDate = new Date(dateStr);
    if (evDate > baseDate) {
      upcomingMeetups.push({ date: evDate, city });
    }
  }

  if (upcomingMeetups.length === 0) return undefined;

  upcomingMeetups.sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = upcomingMeetups[0];
  const monthFormatted = `${monthNames[next.date.getMonth()]} ${next.date.getFullYear()}`;

  return {
    city: next.city,
    monthFormatted,
  };
}

export function parseEventMarkdown(eventSlug: string): EventMetadata {
  const filePath = path.resolve(
    process.cwd(),
    `src/content/events/${eventSlug}.md`
  );

  let title = 'Cyber Scotland Connect Meetup';
  let date = '2026-11-26';
  let time = '17:30 – 20:30 GMT';
  let hostVenue = 'CodeBase Edinburgh';
  let location = '37a Castle Terrace, Edinburgh EH1 2EL';
  let pub: string | undefined = undefined;
  let sponsorName = 'RiverSafe';
  let leadOrganizer = 'Harry McLaren';
  let wifiNetwork = 'CodeBase Guest';
  let poll: PollConfig | undefined = undefined;
  const speakers: Speaker[] = [];
  const agenda: AgendaItem[] = [];

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');

    const titleVal = extractScalar(content, 'title');
    const dateVal = extractScalar(content, 'date');
    const timeVal = extractScalar(content, 'time');
    const locVal = extractScalar(content, 'location');
    const pubVal = extractScalar(content, 'pub');
    const hostVal = extractScalar(content, 'hostVenue');
    const sponsorM = content.match(/sponsors:\s*\n\s*-\s*["']?([^"'\n]+)/);

    if (titleVal) title = titleVal;
    if (dateVal) date = dateVal;
    if (timeVal) time = timeVal;
    if (locVal) location = locVal;
    if (pubVal) pub = pubVal;
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

        // Optional custom takeaways
        const takeaways: string[] = [];
        const takeawaysMatch = entry.match(/takeaways:\s*([\s\S]*?)(?=\n\s*[a-zA-Z0-9_-]+:|$)/);
        if (takeawaysMatch) {
          const tLines = takeawaysMatch[1].split(/\n\s*-\s+/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
          takeaways.push(...tLines);
        }

        if (name) {
          speakers.push({
            name,
            role,
            company,
            talkTitle,
            abstract,
            linkedinUrl,
            takeaways: takeaways.length > 0 ? takeaways : undefined,
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

    // Parse poll block if present
    const pollMatch = content.match(/poll:\s*([\s\S]*?)(?=\n[a-zA-Z0-9_-]+:|$)/);
    if (pollMatch) {
      const pollBlock = pollMatch[1];
      const code = extractScalar(pollBlock, 'code') || 'CSC';
      const question = extractScalar(pollBlock, 'question') || 'Discussion Question';
      const optionsMatch = pollBlock.match(/options:\s*([\s\S]*?)(?=\n\s*[a-zA-Z0-9_-]+:|$)/);
      const options = optionsMatch
        ? optionsMatch[1].split(/\n\s*-\s+/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        : [];
      if (options.length > 0) {
        poll = { code, question, options };
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

  // Next month calculation fallback
  const nextMonthIdx = (d.getMonth() + 1) % 12;
  const nextYear = nextMonthIdx === 0 ? d.getFullYear() + 1 : d.getFullYear();
  const nextMonthFormatted = `${monthNames[nextMonthIdx]} ${nextYear}`;

  // Next gathering text
  const nextGathering = getNextGatheringInfo(date, eventSlug);
  const nextGatheringText = nextGathering
    ? `Next gathering: ${nextGathering.city} • ${nextGathering.monthFormatted} • RSVPs open on Meetup.`
    : `Next gathering: ${location.includes('Edinburgh') ? 'Glasgow' : 'Edinburgh'} • ${nextMonthFormatted} • RSVPs open on Meetup.`;

  const hostPartner = getPartnerDetails(hostVenue);
  const sponsorPartner = getPartnerDetails(sponsorName);
  const sisterEvents = getUpcomingSisterEvents(date, eventSlug);

  return {
    title,
    date,
    formattedDate,
    nextMonthFormatted,
    nextGatheringText,
    time,
    hostVenue,
    location,
    pub,
    sponsorName,
    leadOrganizer,
    wifiNetwork,
    speakers,
    agenda,
    hostPartner,
    sponsorPartner,
    sisterEvents,
    poll,
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
  const slidesToDelete: string[] = [];

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

  // Slide 5: Run of Show / Dynamic Agenda Timeline Grid
  const agendaSlots = [
    { time: 'p5_i22', title: 'p5_i28', desc: 'p5_i29' },
    { time: 'p5_i23', title: 'p5_i30', desc: 'p5_i31' },
    { time: 'p5_i24', title: 'p5_i32', desc: 'p5_i33' },
    { time: 'p5_i25', title: 'p5_i34', desc: 'p5_i35' },
    { time: 'p5_i26', title: 'p5_i36', desc: 'p5_i37' },
    { time: 'p5_i27', title: 'p5_i38', desc: 'p5_i39' },
  ];

  const basePt = 3000000 / 12700; // 236.22047 pt
  const activeCount = Math.min(agendaSlots.length, meta.agenda.length);

  // Standard 6-card template slots
  const standardX = [60.75, 199.5, 339.0, 498.75, 638.25, 798.0];
  const standardCardWidth = 112; // pt

  // Dynamic layout calculations: distribute cards cleanly across slide width
  const slideUsableWidth = 840; // pt
  const leftMargin = 60; // pt
  const gap = 16; // pt
  const cardWidth = activeCount === 6
    ? standardCardWidth
    : Math.round(((slideUsableWidth - (activeCount - 1) * gap) / activeCount) * 10) / 10;
  const widthScale = Math.round((cardWidth / basePt) * 100000) / 100000;

  for (let i = 0; i < agendaSlots.length; i++) {
    const slot = agendaSlots[i];

    if (i < activeCount) {
      const ag = meta.agenda[i];
      const posX = activeCount === 6
        ? standardX[i]
        : Math.round((leftMargin + i * (cardWidth + gap)) * 10) / 10;

      // Clean, uncollided titles
      let displayTitle = ag.title;
      if (displayTitle.includes('NullReceiver')) {
        displayTitle = 'Reading Malware Config Off Blockchain';
      } else if (displayTitle.includes('Field Guide')) {
        displayTitle = 'Field Guide: LLMs & Agents in 2026';
      } else if (displayTitle.includes('Other Side of the Login Screen')) {
        displayTitle = 'Break the Bank: Beyond Login Screen';
      } else if (displayTitle.length > 36) {
        displayTitle = displayTitle.slice(0, 34).trim() + '…';
      }

      let displayDesc = '';
      if (ag.speaker) {
        displayDesc = ag.speaker;
      } else if (ag.type === 'networking' || ag.title.toLowerCase().includes('networking') || ag.title.toLowerCase().includes('doors open')) {
        displayDesc = 'Arrivals & Refreshments';
      } else if (ag.description) {
        displayDesc = ag.description.length > 36 ? ag.description.slice(0, 34).trim() + '…' : ag.description;
      } else {
        displayDesc = 'Community Session';
      }

      // Dynamic resize of time box only when layout differs from standard 6-card master (y: 261.75)
      if (activeCount !== 6) {
        ops.push({
          op: 'resize-element',
          element: slot.time,
          x: posX,
          y: 261.75,
          width: widthScale,
          height: Math.round((28 / basePt) * 100000) / 100000,
        });
      }
      updateAndStyle(ops, slot.time, ag.time, 12, '#895294', true, 'START');

      // Title: y=282, h=36, adaptive font size
      ops.push({
        op: 'resize-element',
        element: slot.title,
        x: posX,
        y: 282,
        width: widthScale,
        height: Math.round((36 / basePt) * 100000) / 100000,
      });
      const titleFontSize = activeCount <= 4 ? 10.5 : 9.5;
      updateAndStyle(ops, slot.title, displayTitle, titleFontSize, '#21203A', true, 'START');

      // Speaker / Desc: y=326, h=45, 8.5pt #56548C
      ops.push({
        op: 'resize-element',
        element: slot.desc,
        x: posX,
        y: 326,
        width: widthScale,
        height: Math.round((45 / basePt) * 100000) / 100000,
      });
      updateAndStyle(ops, slot.desc, displayDesc, 8.5, '#56548C', false, 'START');
    } else {
      // Clear unused slots so empty placeholders never render
      updateAndStyle(ops, slot.time, '');
      updateAndStyle(ops, slot.title, '');
      updateAndStyle(ops, slot.desc, '');
    }
  }

  // Slide 5: Footer close & pub info
  updateAndStyle(ops, 'p5_i20', 'Talks conclude at 20:15 with Q&A • Event closes at 20:30 for community social at the pub.', 9.5, '#56548C', false, 'CENTER');

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
        let compactAbstract = s.abstract;
        if (compactAbstract.length > 210) {
          const cut = compactAbstract.slice(0, 205);
          const lastSpace = cut.lastIndexOf(' ');
          compactAbstract = (lastSpace > 140 ? cut.slice(0, lastSpace) : cut).trim() + '…';
        }
        updateAndStyle(ops, slot.abstract, compactAbstract, 10, '#382B5C', false, 'START');
      }
      if (s.linkedinUrl) {
        const handle = s.linkedinUrl.replace(/.*linkedin\.com\/in\/([^/]+).*/, '$1') || s.name.toLowerCase().replace(/\s+/g, '-');
        updateAndStyle(ops, slot.linkedin, `in/${handle}`, 8.5, '#21203A', true, 'START');
      }

      // Populate custom speaker takeaways if supplied, otherwise fallback to standard professional points
      const defaultTakeaways = [
        'Practical implementation insights & methodologies',
        'Lessons learned from production security environments',
        'Recommended tools, open frameworks & guidance',
      ];
      const takeawaysList = s.takeaways && s.takeaways.length > 0 ? s.takeaways : defaultTakeaways;
      for (let t = 0; t < slot.takeaways.length; t++) {
        const itemText = takeawaysList[t] || defaultTakeaways[t] || 'Community Q&A and open discussion';
        updateAndStyle(ops, slot.takeaways[t], itemText, 10, '#21203A', false, 'START');
      }
    } else {
      slidesToDelete.push(slot.slide);
    }
  }

  // Slide 10: Slido Poll has been permanently removed from the master template.
  // If an event defines an active poll in the future, it can be created dynamically.

  // Slide 11: Open Mic — Repurpose Jobs to Discord & dynamically inject Sister Events
  updateAndStyle(ops, 'p8_i19', 'Post open roles or browse active listings in our community Discord:', 9.5, '#382B5C', false, 'START');
  updateAndStyle(ops, 'p8_i23', '• Post roles in Discord #careers', 9.5, '#21203A', false, 'START');
  updateAndStyle(ops, 'p8_i24', '• Take 30s at the mic to shout out your role', 9.5, '#21203A', false, 'START');

  // Dynamic Sister Events injection (max 36 chars per line to prevent p8_i29/p8_i30 collision)
  if (meta.sisterEvents.length > 0) {
    const formatEvBullet = (ev: UpcomingSisterEvent) => {
      const cityShort = ev.city.replace('Scotland-wide', 'Scot');
      const maxTitleLen = Math.max(12, 35 - ev.formattedDate.length - cityShort.length - 6);
      let cleanTitle = ev.title;
      if (cleanTitle.length > maxTitleLen) {
        const cut = cleanTitle.slice(0, maxTitleLen - 1);
        const lastSpace = cut.lastIndexOf(' ');
        cleanTitle = (lastSpace > 10 ? cut.slice(0, lastSpace) : cut).trim() + '…';
      }
      return `• ${ev.formattedDate}: ${cleanTitle} (${cityShort})`;
    };

    const ev1 = meta.sisterEvents[0];
    updateAndStyle(ops, 'p8_i29', formatEvBullet(ev1), 9.5, '#21203A', true, 'START');

    if (meta.sisterEvents.length > 1) {
      const ev2 = meta.sisterEvents[1];
      updateAndStyle(ops, 'p8_i30', formatEvBullet(ev2), 9.5, '#21203A', true, 'START');
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
  updateAndStyle(ops, 'p10_i17', meta.nextGatheringText, 12, '#BDACCF', false, 'CENTER');
  const pubText = meta.pub
    ? `Social: ${meta.pub} (All Welcome)`
    : `Social: Local Pub (Central ${meta.location.includes('Edinburgh') ? 'Edinburgh' : 'Glasgow'}) (All Welcome)`;
  updateAndStyle(ops, 'p10_i19', pubText, 9.5, '#FFFFFF', true, 'CENTER');

  // Write batch payload to dist/slides/batch-ops.json
  const batchDir = path.resolve(process.cwd(), 'dist/slides');
  fs.mkdirSync(batchDir, { recursive: true });
  const batchFilePath = path.join(batchDir, `batch-${eventSlug}.json`);
  fs.writeFileSync(batchFilePath, JSON.stringify(ops, null, 2), 'utf-8');

  console.log(`Executing ${ops.length} atomic operations via single gslides mutate batch call...`);
  runGslides(['mutate', 'batch', presId, '--file', batchFilePath]);
  console.log(`✔ Batch operations completed successfully.`);

  // Remove slides targeted for deletion (e.g. Slido poll or unused speaker slots)
  for (const slideId of slidesToDelete) {
    try {
      console.log(`Deleting slide: ${slideId}`);
      runGslides(['mutate', 'delete-slide', presId, slideId]);
    } catch (e) {
      console.warn(`Note: Could not delete slide ${slideId}: ${(e as Error).message}`);
    }
  }

  // Optional: Post-batch image additions for host and sponsor logos if URLs exist
  if (meta.hostPartner?.logoUrl) {
    console.log(`Injecting Host Partner logo from: ${meta.hostPartner.logoUrl}`);
    try {
      runGslides([
        'mutate',
        'add-image',
        presId,
        '--slide',
        'p3',
        '--url',
        meta.hostPartner.logoUrl,
        '--x',
        '210',
        '--y',
        '250',
        '--width',
        '110',
        '--height',
        '60',
      ]);
    } catch (e) {
      console.warn(`Note: Could not inject host logo image: ${(e as Error).message}`);
    }
  }

  if (meta.sponsorPartner?.logoUrl) {
    console.log(`Injecting Sponsor Partner logo from: ${meta.sponsorPartner.logoUrl}`);
    try {
      runGslides([
        'mutate',
        'add-image',
        presId,
        '--slide',
        'p3',
        '--url',
        meta.sponsorPartner.logoUrl,
        '--x',
        '580',
        '--y',
        '250',
        '--width',
        '110',
        '--height',
        '60',
      ]);
    } catch (e) {
      console.warn(`Note: Could not inject sponsor logo image: ${(e as Error).message}`);
    }
  }

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
