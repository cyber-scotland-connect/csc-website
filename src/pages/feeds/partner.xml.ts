import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateEventRss } from '../../utils/rss';

export const GET: APIRoute = async ({ site }) => {
  const allEvents = await getCollection('events');
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const partnerEvents = allEvents
    .filter(
      (e) =>
        (e.data.isPartnerEvent === true || !!e.data.partnerName) &&
        new Date(e.data.date).getTime() >= startOfToday
    )
    .sort(
      (a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime()
    );

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteOrigin = site ? site.origin : 'https://cyberscotlandconnect.com';
  const siteUrl = `${siteOrigin}${base}`;
  const feedUrl = `${siteUrl}/feeds/partner.xml`;

  const rssBody = generateEventRss(partnerEvents, {
    title: 'Scottish Cyber Partner Events (Excludes CSC)',
    description:
      'Scottish cybersecurity community, conference, academic, and partner events across Scotland (excluding official Cyber Scotland Connect gatherings).',
    siteUrl,
    feedUrl,
  });

  return new Response(rssBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
