import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const siteOrigin = site ? site.origin : 'https://cyberscotlandconnect.com';
  const siteUrl = `${siteOrigin}${base}`;

  const allEvents = await getCollection('events');
  const allCommunity = await getCollection('community');
  const allResources = await getCollection('resources');
  const allPartners = await getCollection('partners');
  const allLeaders = await getCollection('leaders');

  const nowTime = new Date().setHours(0, 0, 0, 0);
  const upcomingEvents = allEvents
    .filter((e) => new Date(e.data.date).getTime() >= nowTime)
    .sort(
      (a, b) =>
        new Date(a.data.date).getTime() - new Date(b.data.date).getTime()
    );

  const pastEvents = allEvents
    .filter((e) => new Date(e.data.date).getTime() < nowTime)
    .sort(
      (a, b) =>
        new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
    );

  const formatEventDetail = (e: (typeof allEvents)[number]) => {
    const d = new Date(e.data.date).toISOString().slice(0, 10);
    const lines = [
      `### ${e.data.title} (${d})`,
      `- **URL:** ${siteUrl}/events/${e.id}/`,
      `- **City:** ${e.data.city} | **Venue:** ${e.data.location}`,
      `- **Type:** ${e.data.isPartnerEvent ? `Partner Event (${e.data.partnerName || 'Scottish Ecosystem'})` : 'Official CSC Gathering'} | **Access:** ${e.data.accessType || 'Open/Public'}`,
    ];
    if (e.data.time) lines.push(`- **Time:** ${e.data.time}`);
    if (e.data.meetupUrl || e.data.registrationUrl) {
      lines.push(
        `- **Registration:** ${e.data.meetupUrl || e.data.registrationUrl}`
      );
    }
    if (e.data.speakers && e.data.speakers.length > 0) {
      lines.push(
        `- **Speakers:** ${e.data.speakers
          .map(
            (s) =>
              `${s.name}${s.company ? ` (${s.company})` : ''} — "${s.talkTitle}"`
          )
          .join('; ')}`
      );
    }
    return lines.join('\n');
  };

  const body = `# Cyber Scotland Connect (CSC) — Full Knowledge Corpus (llms-full.txt)

> Complete machine-readable corpus of Cyber Scotland Connect's upcoming schedule, historical talk archive, leadership, Scottish cyber community groups, partners, and open resources.

- **Canonical Site:** ${siteUrl}/
- **Summary Index:** ${siteUrl}/llms.txt
- **Feeds:** ${siteUrl}/feeds/community.xml | ${siteUrl}/feeds/csc.xml | ${siteUrl}/calendar/community.ics

---

## 1. Upcoming Events (${upcomingEvents.length})

${upcomingEvents.map(formatEventDetail).join('\n\n')}

---

## 2. Scottish Cyber Community Directory (${allCommunity.filter((c) => c.data.active).length})

${allCommunity
  .filter((c) => c.data.active)
  .map(
    (c) =>
      `- **${c.data.name}** (${c.data.city} · ${c.data.category}): ${c.data.description} [Website](${c.data.websiteUrl})`
  )
  .join('\n')}

---

## 3. Leadership & Stewards (${allLeaders.length})

${allLeaders
  .map(
    (l) =>
      `- **${l.data.name}** — ${l.data.role} (${l.data.chapter}, ${l.data.status}): ${l.data.bio}`
  )
  .join('\n')}

---

## 4. Partners & Supporters (${allPartners.filter((p) => p.data.active).length})

${allPartners
  .filter((p) => p.data.active)
  .map(
    (p) =>
      `- **${p.data.name}** [${p.data.tier}]: ${p.data.description} (${p.data.websiteUrl})`
  )
  .join('\n')}

---

## 5. Curated Community Resources (${allResources.length})

${allResources
  .map(
    (r) =>
      `- **[${r.data.title}](${r.data.url})** (${r.data.category} · ${r.data.type}): ${r.data.description}`
  )
  .join('\n')}

---

## 6. Historical Event & Session Archive (${pastEvents.length})

${pastEvents.map(formatEventDetail).join('\n\n')}
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
