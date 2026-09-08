import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateIcs } from '../../utils/calendar';

export const GET: APIRoute = async ({ site }) => {
  const allEvents = await getCollection('events');
  const cscEvents = allEvents
    .filter((e) => !e.data.isPartnerEvent)
    .sort(
      (a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime()
    );

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteOrigin = site ? site.origin : 'https://cyber-scotland-connect.github.io';
  const siteUrl = `${siteOrigin}${base}`;

  const icsBody = generateIcs(cscEvents, {
    calendarName: 'Cyber Scotland Connect Gatherings',
    calendarDesc: 'Official community meetups and gatherings organized by Cyber Scotland Connect.',
    siteUrl,
  });

  return new Response(icsBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="cyber-scotland-connect.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
