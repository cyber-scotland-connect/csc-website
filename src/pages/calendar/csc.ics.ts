import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateIcs } from '../../utils/calendar';

export const GET: APIRoute = async ({ site }) => {
  const allEvents = await getCollection('events');
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const cscEvents = allEvents
    .filter(
      (e) =>
        !e.data.isPartnerEvent &&
        new Date(e.data.date).getTime() >= startOfToday
    )
    .sort(
      (a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime()
    );

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteOrigin = site ? site.origin : 'https://cyberscotlandconnect.com';
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
