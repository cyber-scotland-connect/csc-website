import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { isNonScottishLocation } from './utils/scottish-geography';
import { isOfficialPartnerOrSponsor } from './utils/partner-registry';

const eventsCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    time: z.string().optional(),
    location: z.string(),
    locationUrl: z.string().url().optional(),
    city: z.enum([
      'Edinburgh',
      'Glasgow',
      'Dundee',
      'Virtual',
      'Aberdeen',
      'Scotland-wide',
    ]),
    isPartnerEvent: z.boolean().default(false),
    partnerName: z.string().optional(),
    hostVenue: z.string().optional(),
    sponsors: z.array(z.string()).optional(),
    organizerType: z
      .enum(['Community', 'Commercial', 'Public Sector', 'Academic'])
      .default('Community'),
    accessType: z
      .enum([
        'Open/Public',
        'Corporate/Paid',
        'Student/Academic',
        'Restricted/Civil Service',
      ])
      .default('Open/Public'),
    meetupUrl: z.string().url().optional(),
    registrationUrl: z.string().url().optional(),
    streamUrl: z.string().url().optional(),
    slidesUrl: z.string().optional(),
    recordingUrl: z.string().url().optional(),
    accessibility: z
      .object({
        stepFree: z.boolean().nullable().optional(),
        hearingLoop: z.boolean().nullable().optional(),
        notes: z.string().optional(),
      })
      .default({ stepFree: null, hearingLoop: null })
      .refine(
        (val) => {
          if (val.stepFree === true || val.hearingLoop === true) {
            if (!val.notes || val.notes.trim().length < 10) return false;
            const lower = val.notes.toLowerCase();
            if (
              lower.startsWith('check with') ||
              lower.startsWith('check organizer') ||
              lower.startsWith('check registration')
            ) {
              return false;
            }
          }
          return true;
        },
        {
          message:
            'Accessibility fields (stepFree, hearingLoop) cannot be true without specific confirmed accommodation details in notes. Never guess true with generic check-with-organizer notes.',
        }
      ),
    speakers: z
      .array(
        z.object({
          name: z.string(),
          role: z.string().optional(),
          company: z.string().optional(),
          talkTitle: z.string(),
          abstract: z.string().optional(),
          slidesUrl: z.string().optional(),
          linkedinUrl: z.string().url().optional(),
        })
      )
      .optional(),
    agenda: z
      .array(
        z.object({
          time: z.string(),
          title: z.string(),
          speaker: z.string().optional(),
          speakerUrl: z.string().optional(),
          description: z.string().optional(),
          type: z
            .enum([
              'networking',
              'talk',
              'break',
              'social',
              'intro',
              'panel',
              'other',
            ])
            .default('other'),
        })
      )
      .optional(),
    featured: z.boolean().default(false),
    photos: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
          caption: z.string().optional(),
        })
      )
      .max(6)
      .optional(),
    albumUrl: z.string().url().optional(),
  })
  .refine(
    (data) => {
      // 1. Official partner event guard:
      // If isPartnerEvent is true, partnerName MUST be an official partner or sponsor registered in src/content/partners/
      if (data.isPartnerEvent) {
        if (!data.partnerName || !isOfficialPartnerOrSponsor(data.partnerName)) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        'Events with isPartnerEvent: true must specify an official partner or sponsor registered in src/content/partners/. For community or signposted external events (e.g. Cyber Connect, FutureScot, Hack Thursday), set isPartnerEvent: false and provide partnerName as the organizing group.',
    }
  )
  .refine(
    (data) => {
      // 2. Generic ticketing or venue platforms cannot be listed as the partnerName
      if (data.partnerName) {
        const lower = data.partnerName.toLowerCase().trim();
        if (
          lower === 'eventbrite' ||
          lower === 'luma' ||
          lower === 'meetup' ||
          lower === 'ticketmaster'
        ) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        'Generic ticketing platforms (Eventbrite, Luma, Meetup, Ticketmaster) cannot be listed as partnerName. Specify the actual organising group or omit partnerName.',
    }
  )
  .refine(
    (data) => {
      // 3. Temporal sanity guard: dates cannot be more than 366 days in the future
      const maxFuture = new Date();
      maxFuture.setDate(maxFuture.getDate() + 366);
      return new Date(data.date).getTime() <= maxFuture.getTime();
    },
    {
      message:
        'Event date cannot be more than 366 days in the future. Check for scraping year errors.',
    }
  )
  .refine(
    (data) => {
      // 4. Scottish geography invariant: physical event locations must not be in non-Scottish UK cities or postcodes
      return !isNonScottishLocation(data.location);
    },
    {
      message:
        'Event location must be in Scotland (or Online/Virtual). Non-Scottish UK cities, counties, and non-Scottish UK postcodes (e.g. Newcastle, Gateshead, London, NE/EC/M/BT/CF postcodes) are strictly rejected.',
    }
  ),
});

const leadersCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/leaders' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    chapter: z.string().default('Scotland-wide'),
    bio: z.string(),
    avatar: z.string().optional(),
    linkedin: z.string().url().optional(),
    github: z.string().url().optional(),
    website: z.string().url().optional(),
    status: z.enum(['active', 'alumni']).default('active'),
    order: z.number().default(99),
  }),
});

const partnersCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/partners',
  }),
  schema: z.object({
    name: z.string(),
    tier: z.enum([
      'Host Venue',
      'Ecosystem Partner',
      'Sponsor',
      'Academic Partner',
    ]),
    websiteUrl: z.string().url(),
    linkedinUrl: z.string().url().optional(),
    linkedinHandle: z.string().optional(),
    description: z.string(),
    logo: z.string().optional(),
    active: z.boolean().default(true),
    order: z.number().default(99),
  }),
});

const resourcesCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/resources',
  }),
  schema: z.object({
    title: z.string(),
    url: z.string().url(),
    category: z.enum([
      'Scottish & UK Ecosystem',
      'Defensive & Detection Engineering',
      'Offensive & AppSec',
      'DFIR & Incident Response',
      'Cloud, DevSecOps & Supply Chain',
      'Interactive Labs & Tooling',
    ]),
    type: z
      .enum([
        'Community Project',
        'Living Standard',
        'Open Source Tool',
        'Interactive Lab',
        'Public Body / Advisory',
      ])
      .default('Community Project'),
    description: z.string(),
    isScottishOrUK: z.boolean().default(false),
    order: z.number().default(99),
  }),
});

const communityCollection = defineCollection({
  loader: glob({
    pattern: '**/[^_]*.{md,mdx}',
    base: './src/content/community',
  }),
  schema: z.object({
    name: z.string(),
    category: z.enum([
      'Hacker Society & Meetup',
      'Student Cyber Society',
      'Diversity & Inclusion',
      'Professional Association',
      'Support & Veteran Network',
    ]),
    city: z.enum([
      'Edinburgh',
      'Glasgow',
      'Dundee',
      'Aberdeen',
      'St Andrews',
      'Scotland-wide',
    ]),
    websiteUrl: z.string().url(),
    linkedinUrl: z.string().url().optional(),
    linkedinHandle: z.string().optional(),
    chatUrl: z.string().url().optional(),
    description: z.string(),
    logo: z.string().optional(),
    meetingFrequency: z.string().optional(),
    active: z.boolean().default(true),
    order: z.number().default(99),
  }),
});

export const collections = {
  events: eventsCollection,
  leaders: leadersCollection,
  partners: partnersCollection,
  resources: resourcesCollection,
  community: communityCollection,
};
