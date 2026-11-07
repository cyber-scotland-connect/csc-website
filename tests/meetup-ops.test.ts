import { describe, expect, it } from 'bun:test';
import {
  generateFinalReminderBroadcast,
  generateInterceptorRecipe,
  generateWaitlistBroadcast,
  listOfficialCscEvents,
  loadMeetupEventContext,
  processAttendeeCsv,
  resolveUpcomingCscEvent,
} from '../scripts/meetup-ops';

describe('meetup-ops', () => {
  it('scans and lists all official CSC events across Scotland', () => {
    const list = listOfficialCscEvents();
    expect(list.length).toBeGreaterThanOrEqual(15);
    expect(list.some((e) => e.slug === '2026-11-26-edinburgh-codebase')).toBeTrue();
  });

  it('automatically resolves the next upcoming scheduled event when no slug is provided', () => {
    const autoSlug = resolveUpcomingCscEvent();
    expect(autoSlug).toBeDefined();
    expect(autoSlug).toBe('2026-11-26-edinburgh-codebase');
  });

  it('correctly loads event context and parses meetupUrl metadata', () => {
    const ctx = loadMeetupEventContext('2026-11-26-edinburgh-codebase');
    expect(ctx.slug).toBe('2026-11-26-edinburgh-codebase');
    expect(ctx.hostVenue).toBe('CodeBase Edinburgh');
    expect(ctx.city).toBe('Edinburgh');
    expect(ctx.eventId).toBe('316327219');
    expect(ctx.groupSlug).toBe('cyberscotconnect');
    expect(ctx.capacityLimit).toBe(80);
    expect(ctx.speakers.length).toBeGreaterThanOrEqual(4);
    expect(ctx.speakers.some((s) => s.name === 'Gary Hunter')).toBeTrue();
  });

  it('generates T-7/T-4 waitlist broadcast with capacity warning and RSVP link', () => {
    const ctx = loadMeetupEventContext('2026-11-26-edinburgh-codebase');
    const broadcast = generateWaitlistBroadcast(ctx);
    expect(broadcast.recipientFilter).toBe('Going (Attending Members)');
    expect(broadcast.subject).toContain('Checking your attendance');
    expect(broadcast.body).toContain('80 attendees');
    expect(broadcast.body).toContain('https://www.meetup.com/cyberscotconnect/events/316327219/');
    expect(broadcast.body).toContain('Harry McLaren');
  });

  it('generates T-1 final arrival reminder broadcast with speaker lineup and logistics', () => {
    const ctx = loadMeetupEventContext('2026-11-26-edinburgh-codebase');
    const reminder = generateFinalReminderBroadcast(ctx);
    expect(reminder.subject).toContain('Tomorrow Night: Logistics & Schedule');
    expect(reminder.body).toContain('CodeBase Edinburgh');
    expect(reminder.body).toContain('Doors Open: 17:30');
    expect(reminder.body).toContain('Gary Hunter');
    expect(reminder.body).toContain('Caleb Eghan');
  });

  it('processes and formats exported Meetup CSV into venue security check-in roster', () => {
    const mockCsv = `Name,User ID,Title,RSVP,Guests\nAlice Smith,101,DevSecOps,Yes,0\nBob Brown,102,Security Analyst,Yes,0\nCharlie Adams,103,CISO,No,0\nDavid Clark,104,Student,Going,0`;
    const roster = processAttendeeCsv(mockCsv);
    expect(roster).toContain('# Cyber Scotland Connect — Venue Security & Check-In Roster');
    expect(roster).toContain('Alice Smith');
    expect(roster).toContain('David Clark');
    expect(roster).not.toContain('Charlie Adams');
  });

  it('generates complete Interceptor browser automation recipe', () => {
    const ctx = loadMeetupEventContext('2026-11-26-edinburgh-codebase');
    const recipe = generateInterceptorRecipe(ctx);
    expect(recipe).toContain('INTERCEPTOR BROWSER AUTOMATION RECIPE');
    expect(recipe).toContain('https://www.meetup.com/cyberscotconnect/events/316327219/attendees/');
    expect(recipe).toContain('Contact attendees');
  });
});
