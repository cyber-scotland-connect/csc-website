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

  const upcomingLines =
    upcomingEvents.length > 0
      ? upcomingEvents
          .map((e) => {
            const d = new Date(e.data.date).toISOString().slice(0, 10);
            const host = e.data.isPartnerEvent
              ? `[Partner: ${e.data.partnerName || 'Scottish Cyber Ecosystem'}]`
              : '[CSC Gathering]';
            return `- [${e.data.title}](${siteUrl}/events/${e.id}/): ${d} · ${e.data.city} (${e.data.location}) ${host}`;
          })
          .join('\n')
      : '- No upcoming events currently scheduled. Check https://www.meetup.com/cyberscotconnect/ for announcements.';

  const recentArchiveLines = pastEvents
    .slice(0, 10)
    .map((e) => {
      const d = new Date(e.data.date).toISOString().slice(0, 10);
      return `- [${e.data.title}](${siteUrl}/events/${e.id}/): ${d} · ${e.data.city}`;
    })
    .join('\n');

  const body = `# Cyber Scotland Connect (CSC)

> Cyber Scotland Connect (CSC) is an independent, grassroots community connecting cyber security professionals, researchers, students, and practitioners across Scotland. CSC hosts regular, free, in-person meetups featuring high-signal, zero-sales technical talks and informal networking.

## Core Information
- **Name:** Cyber Scotland Connect (CSC)
- **Founded:** 2019 by Harry McLaren and Stu Hirst
- **Type:** Grassroots volunteer-led non-profit cyber security community
- **Website:** ${siteUrl}/
- **Full LLM Context Corpus:** ${siteUrl}/llms-full.txt
- **Meetup Hub:** https://www.meetup.com/cyberscotconnect/
- **LinkedIn:** https://www.linkedin.com/company/cyber-scotland-connect/
- **Discord:** https://discord.gg/9SKzqdZNvS
- **GitHub:** https://github.com/cyber-scotland-connect

## Regional Chapters
CSC organizes regional gatherings across Scotland:
- **Edinburgh:** Regular meetups, flagship volume gatherings, and technical lightning talks (frequent hosts include CodeBase Edinburgh).
- **Glasgow:** Regional evening sessions, defensive engineering, and incident response case studies.
- **Dundee:** Academic, game security, and practitioner sessions.
- **Aberdeen:** Energy sector and industrial cybersecurity focus.
- **Scotland-wide:** Virtual events and community collaborations.

## Key Principles & Policies
- **Strictly Non-Commercial / Zero Sales:** CSC strictly prohibits vendor sales pitches, commercial presentations, product demos, or direct recruitment outreach during talks. All sessions must focus on technical depth, defensive lessons, offensive research, or practical practitioner experiences.
- **Free & Open Access:** Events are free to attend and open to everyone regardless of career level, from students breaking into cyber to senior practitioners and CISOs.
- **Code of Conduct:** CSC is dedicated to a harassment-free, safe, inclusive experience. All attendees, speakers, organizers, and volunteers must abide by the community Code of Conduct: ${siteUrl}/code-of-conduct/

## Community Leadership
CSC is operated entirely by volunteer organizers and moderators:
- **Co-Founders & Organizers:** Harry McLaren, Stu Hirst
- **Community Moderator & Brand Lead:** Sophie Lanc
- **Community Moderators:** Gary Hunter, Magda de Jager, Rich Macfarlane, Kevin Gray, Richard Grey, James Ramirez, Joshua Adegoke, Ben Haine
- **Moderator Alumni:** Federico Charosky, Jamie O'Hare, Miguel Marques

## Upcoming Gatherings & Scottish Ecosystem Events (${upcomingEvents.length})
${upcomingLines}

## Recent Session Archive (Showing 10 of ${pastEvents.length} Past Events)
${recentArchiveLines}

## Key Pages & Machine-Readable Feeds
- [Home](${siteUrl}/): Community introduction, quick facts, upcoming gatherings.
- [Events & Session Archive](${siteUrl}/events/): Complete archive of ${allEvents.length} meetup volumes, agendas, slides, and talk recordings.
- [Speakers Directory](${siteUrl}/speakers/): Directory of defenders, researchers, and engineers who have delivered sessions at CSC.
- [Scottish Cyber Community Directory](${siteUrl}/community/): Curated directory of ${allCommunity.filter((c) => c.data.active).length} Scottish hacker societies, student clubs, and diversity networks.
- [Leadership Team](${siteUrl}/#leadership): Founders, regional organizers, volunteer moderators, and community alumni.
- [Ecosystem Partners](${siteUrl}/partners/): ${allPartners.filter((p) => p.data.active).length} non-profit, host venue, ecosystem, and academic partners.
- [Frequently Asked Questions (FAQ)](${siteUrl}/faq/): Guidance on attending, submitting talk proposals (CFP), and volunteering.
- [Community Resources](${siteUrl}/resources/): ${allResources.length} curated tools, learning roadmaps, and Scottish cybersecurity ecosystem links.
- [Live Calendar & RSS Feeds](${siteUrl}/calendar/): Subscribe via iCal (\`${siteUrl}/calendar/community.ics\`, \`${siteUrl}/calendar/csc.ics\`, \`${siteUrl}/calendar/partner.ics\`) or RSS (\`${siteUrl}/feeds/community.xml\`, \`${siteUrl}/feeds/csc.xml\`, \`${siteUrl}/feeds/partner.xml\`).
- [Brand Assets](${siteUrl}/brand/): Official logos, color palette, badges, and usage guidelines.
- [Code of Conduct](${siteUrl}/code-of-conduct/): Anti-harassment policy and reporting procedures.
- [Security Policy](${siteUrl}/security/): Vulnerability disclosure guidelines (\`/.well-known/security.txt\`).
- [Privacy Notice](${siteUrl}/privacy/): UK GDPR data handling transparency.
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
