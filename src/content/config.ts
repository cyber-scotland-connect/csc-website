import { defineCollection, z } from 'astro:content';

const eventsCollection = defineCollection({
  type: 'content',
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
    }).default({}),
    speakers: z.array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        company: z.string().optional(),
        talkTitle: z.string(),
        abstract: z.string().optional(),
      })
    ).optional(),
    featured: z.boolean().default(false),
  }),
});

const leadersCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    role: z.string(),
    chapter: z.string().default('Scotland-wide'),
    bio: z.string(),
    avatar: z.string().optional(),
    linkedin: z.string().url().optional(),
    github: z.string().url().optional(),
    website: z.string().url().optional(),
    order: z.number().default(99),
  }),
});

const partnersCollection = defineCollection({
  type: 'content',
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
