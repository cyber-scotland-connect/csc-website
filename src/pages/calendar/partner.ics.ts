import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateIcs } from '../../utils/calendar';

export const GET: APIRoute = async ({ site }) => {
  const allEvents = await getCollection('events');
  const partnerEvents = allEvents
    .filter((e) => e.data.isPartnerEvent === true)
    .sort(
      (a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime()
    );

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteOrigin = site ? site.origin : 'https://cyberscotlandconnect.com';
  const siteUrl = `${siteOrigin}${base}`;

  const icsBody = generateIcs(partnerEvents, {
    calendarName: 'Scottish Cyber Partner Events (Excludes CSC)',
    calendarDesc:
      'Scottish cybersecurity community, conference, academic, and partner events across Scotland (excluding official Cyber Scotland Connect gatherings).',
    siteUrl,
  });

  return new Response(icsBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="scottish-cyber-partners.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
