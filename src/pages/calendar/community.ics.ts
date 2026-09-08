import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateIcs } from '../../utils/calendar';

export const GET: APIRoute = async ({ site }) => {
  const allEvents = await getCollection('events');
  const sortedEvents = allEvents.sort(
    (a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime()
  );

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteOrigin = site ? site.origin : 'https://cyber-scotland-connect.github.io';
  const siteUrl = `${siteOrigin}${base}`;

  const icsBody = generateIcs(sortedEvents, {
    calendarName: 'Scottish Cyber Community Events',
    calendarDesc: 'Upcoming cybersecurity meetups, workshops, and ecosystem summits across Scotland.',
    siteUrl,
  });

  return new Response(icsBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="scottish-cyber-community.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
