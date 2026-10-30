import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { generateEventRss } from '../../utils/rss';

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
  const feedUrl = `${siteUrl}/feeds/csc.xml`;

  const rssBody = generateEventRss(cscEvents, {
    title: 'Cyber Scotland Connect Gatherings',
    description: 'Official community meetups and gatherings organized by Cyber Scotland Connect.',
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
