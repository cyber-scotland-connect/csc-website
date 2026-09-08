import type { CollectionEntry } from 'astro:content';

interface RssOptions {
  title: string;
  description: string;
  feedUrl: string;
  siteUrl: string;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an RSS 2.0 XML feed string from an array of events
 */
export function generateEventRss(
  events: CollectionEntry<'events'>[],
  options: RssOptions
): string {
  const currentYear = new Date().getFullYear();

  const itemsXml = events
    .map((event) => {
      const { data, id: slug } = event;
      const eventUrl = `${options.siteUrl}/events/${slug}`;
      const pubDate = new Date(data.date).toUTCString();

      let description = `${data.title} - ${data.city} Gathering. `;
      description += `Date: ${new Date(data.date).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}. `;
      if (data.time) description += `Time: ${data.time}. `;
      description += `Location: ${data.location}. `;
      if (data.isPartnerEvent) {
        description += `Host: ${data.partnerName || 'Partner Organisation'}. `;
      } else {
        description += `Host: Cyber Scotland Connect. `;
      }

      if (data.speakers && data.speakers.length > 0) {
        description += `Speakers: ${data.speakers.map((s) => `${s.name} ("${s.talkTitle}")`).join(', ')}. `;
      }

      const rsvpUrl = data.meetupUrl || data.registrationUrl || eventUrl;

      return `    <item>
      <title>${escapeXml(data.title)}</title>
      <link>${escapeXml(eventUrl)}</link>
      <guid isPermaLink="true">${escapeXml(eventUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
      <category>${escapeXml(data.city)}</category>
      <category>${data.isPartnerEvent ? 'Partner Event' : 'CSC Gathering'}</category>
      <source url="${escapeXml(rsvpUrl)}">${escapeXml(data.isPartnerEvent ? data.partnerName || 'Partner' : 'Cyber Scotland Connect')}</source>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${escapeXml(options.siteUrl)}</link>
    <description>${escapeXml(options.description)}</description>
    <language>en-gb</language>
    <copyright>© ${currentYear} Cyber Scotland Connect</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(options.feedUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;
}
