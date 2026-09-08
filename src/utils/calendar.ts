import type { CollectionEntry } from 'astro:content';

interface CalendarOptions {
  calendarName: string;
  calendarDesc: string;
  siteUrl: string;
}

/**
 * Parses time string like "18:00 – 20:00 BST" or "08:30 – 16:30 GMT"
 * into start and end UTC Dates combined with the event date.
 */
function parseEventTimes(
  eventDate: Date,
  timeStr?: string
): { start: Date; end: Date; allDay: boolean } {
  const baseDate = new Date(eventDate);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  if (!timeStr) {
    // Default all-day event
    const start = new Date(Date.UTC(year, month, day, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day, 23, 59, 59));
    return { start, end, allDay: true };
  }

  // Regex matches "HH:MM – HH:MM [BST|GMT]" or "HH:MM - HH:MM"
  const match = timeStr.match(
    /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})(?:\s*(BST|GMT))?/i
  );

  if (!match) {
    // Default evening meetup: 18:00 - 20:30 UK time
    const start = new Date(Date.UTC(year, month, day, 18, 0, 0));
    const end = new Date(Date.UTC(year, month, day, 20, 30, 0));
    return { start, end, allDay: false };
  }

  const [, startH, startM, endH, endM, tz] = match;
  const isBST = tz ? tz.toUpperCase() === 'BST' : isBritishSummerTime(baseDate);

  // BST is UTC+1 (subtract 1h to get UTC), GMT is UTC+0
  const offsetHours = isBST ? 1 : 0;

  const start = new Date(
    Date.UTC(year, month, day, parseInt(startH, 10) - offsetHours, parseInt(startM, 10), 0)
  );
  const end = new Date(
    Date.UTC(year, month, day, parseInt(endH, 10) - offsetHours, parseInt(endM, 10), 0)
  );

  return { start, end, allDay: false };
}

/**
 * Checks if a given date falls within British Summer Time (last Sun in March to last Sun in October)
 */
function isBritishSummerTime(date: Date): boolean {
  const year = date.getFullYear();
  // Last Sunday in March
  const marchEnd = new Date(year, 2, 31);
  const bstStart = new Date(year, 2, 31 - marchEnd.getDay(), 1, 0, 0);

  // Last Sunday in October
  const octEnd = new Date(year, 9, 31);
  const bstEnd = new Date(year, 9, 31 - octEnd.getDay(), 1, 0, 0);

  return date >= bstStart && date < bstEnd;
}

/**
 * Formats a Date to iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ
 */
function formatUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Formats date as YYYYMMDD for all-day events
 */
function formatDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate())
  );
}

/**
 * Escapes special characters for RFC 5545
 */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Folds lines longer than 75 octets per RFC 5545 §3.1
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;

  const chunks: string[] = [];
  let remaining = line;

  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);

  while (remaining.length > 0) {
    chunks.push(' ' + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }

  return chunks.join('\r\n');
}

/**
 * Generates an RFC 5545 compliant .ics string from an array of events
 */
export function generateIcs(
  events: CollectionEntry<'events'>[],
  options: CalendarOptions
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cyber Scotland Connect//Events Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${options.calendarName}`,
    `X-WR-CALDESC:${options.calendarDesc}`,
    'X-WR-TIMEZONE:Europe/London',
  ];

  const nowStamp = formatUtc(new Date());

  for (const event of events) {
    const { data, id: slug } = event;
    const { start, end, allDay } = parseEventTimes(data.date, data.time);

    const eventUrl = `${options.siteUrl}/events/${slug}`;
    const rsvpUrl = data.meetupUrl || data.registrationUrl || eventUrl;

    let description = `${data.title}\\n\\n`;
    description += `📍 Venue: ${data.location}\\n`;
    if (data.time) description += `⏰ Time: ${data.time}\\n`;
    if (data.isPartnerEvent) {
      description += `🤝 Host: ${data.partnerName || 'Community Partner'}\\n`;
    } else {
      description += `🛡️ Host: Cyber Scotland Connect\\n`;
    }
    description += `\\nEvent Details: ${eventUrl}\\n`;
    if (rsvpUrl) description += `RSVP / Register: ${rsvpUrl}\\n`;

    if (data.speakers && data.speakers.length > 0) {
      description += `\\nSpeakers:\\n`;
      data.speakers.forEach((s) => {
        description += `• ${s.name} - "${s.talkTitle}"\\n`;
      });
    }

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${slug}@cyberscotlandconnect.com`);
    lines.push(`DTSTAMP:${nowStamp}`);

    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(end)}`);
    } else {
      lines.push(`DTSTART:${formatUtc(start)}`);
      lines.push(`DTEND:${formatUtc(end)}`);
    }

    lines.push(`SUMMARY:${escapeIcs(data.title)}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`LOCATION:${escapeIcs(data.location)}`);
    lines.push(`URL:${rsvpUrl}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n');
}
