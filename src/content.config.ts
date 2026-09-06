import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const eventsCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    time: z.string().optional(),
    location: z.string(),
    locationUrl: z.string().url().optional(),
    city: z.enum(['Edinburgh', 'Glasgow', 'Dundee', 'Virtual', 'Aberdeen', 'Scotland-wide']),
    isPartnerEvent: z.boolean().default(false),
    partnerName: z.string().optional(),
    meetupUrl: z.string().url().optional(),
    registrationUrl: z.string().url().optional(),
    streamUrl: z.string().url().optional(),
    slidesUrl: z.string().url().optional(),
    recordingUrl: z.string().url().optional(),
    accessibility: z.object({
      stepFree: z.boolean().default(true),
      hearingLoop: z.boolean().default(false),
      notes: z.string().optional(),
    }).default({ stepFree: true, hearingLoop: false }),
    speakers: z.array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        company: z.string().optional(),
        talkTitle: z.string(),
        abstract: z.string().optional(),
      })
    ).optional(),
    agenda: z.array(
      z.object({
        time: z.string(),
        title: z.string(),
        speaker: z.string().optional(),
        speakerUrl: z.string().optional(),
        description: z.string().optional(),
        type: z.enum(['networking', 'talk', 'break', 'social', 'intro', 'panel', 'other']).default('other'),
      })
    ).optional(),
    featured: z.boolean().default(false),
  }),
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
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/partners' }),
  schema: z.object({
    name: z.string(),
    tier: z.enum(['Host Venue', 'Ecosystem Partner', 'Sponsor', 'Academic Partner']),
    websiteUrl: z.string().url(),
    description: z.string(),
    logo: z.string().optional(),
    active: z.boolean().default(true),
    order: z.number().default(99),
  }),
});

export const collections = {
  events: eventsCollection,
  leaders: leadersCollection,
  partners: partnersCollection,
};
