import { describe, expect, it } from 'bun:test';
import { isCscOfficialEvent, matchesScope, isValidDiscordWebhookUrl } from '../scripts/notify-discord';

describe('Discord Notification Scope & Classification Hardening', () => {
  it('identifies genuine CSC events correctly', () => {
    const cscEvent = {
      isPartnerEvent: false,
      partnerName: 'Cyber Scotland Connect',
      title: 'CSC Edinburgh Meetup: Refactoring the Enterprise',
    };
    expect(isCscOfficialEvent(cscEvent)).toBe(true);
    expect(
      matchesScope(
        {
          ...cscEvent,
          slug: '2026-10-08-edinburgh-codebase',
          filePath: 'src/content/events/2026-10-08-edinburgh-codebase.md',
          date: '2026-10-08',
          location: 'CodeBase',
          city: 'Edinburgh',
          accessType: 'Open/Public',
          description: 'CSC Meetup',
        },
        'csc'
      )
    ).toBe(true);
  });

  it('strictly rejects external events from the CSC channel even if isPartnerEvent was false', () => {
    const externalMisclassified = {
      isPartnerEvent: false,
      partnerName: 'Barclays Eagle Labs',
      title: 'It Started with a Click: Protecting Your Business from Cyber Threats',
    };
    // Must NOT be classified as CSC official event
    expect(isCscOfficialEvent(externalMisclassified)).toBe(false);

    // Must NOT match CSC scope
    expect(
      matchesScope(
        {
          ...externalMisclassified,
          slug: '2026-11-12-it-started-with-a-click-glasgow',
          filePath: 'src/content/events/2026-11-12-it-started-with-a-click-glasgow.md',
          date: '2026-11-12',
          location: 'Barclays',
          city: 'Glasgow',
          accessType: 'Open/Public',
          description: 'Workshop',
        },
        'csc'
      )
    ).toBe(false);
  });

  it('rejects events without CSC branding from the CSC channel', () => {
    const unbrandedEvent = {
      isPartnerEvent: false,
      partnerName: '',
      title: 'Cyber Security Essentials for SMEs',
    };
    expect(isCscOfficialEvent(unbrandedEvent)).toBe(false);
    expect(
      matchesScope(
        {
          ...unbrandedEvent,
          slug: '2027-11-23-cyber-security-essentials-for-smes',
          filePath: 'src/content/events/2027-11-23-cyber-security-essentials-for-smes.md',
          date: '2027-11-23',
          location: 'STEP',
          city: 'Scotland-wide',
          accessType: 'Open/Public',
          description: 'SME event',
        },
        'csc'
      )
    ).toBe(false);
  });

  it('routes partner events exclusively to scotland scope and never csc', () => {
    const partnerEvent = {
      isPartnerEvent: true,
      partnerName: 'Cyber and Fraud Centre Scotland',
      title: 'Intro to Cyber Security',
    };
    const parsed = {
      ...partnerEvent,
      slug: '2026-11-26-intro-to-cyber-security',
      filePath: 'src/content/events/2026-11-26-intro-to-cyber-security.md',
      date: '2026-11-26',
      location: 'Virtual',
      city: 'Scotland-wide',
      accessType: 'Student/Academic',
      description: 'Training',
    };

    expect(isCscOfficialEvent(partnerEvent)).toBe(false);
    expect(matchesScope(parsed, 'csc')).toBe(false);
    expect(matchesScope(parsed, 'scotland')).toBe(true);
  });

  it('validates Discord webhook URLs defensively', () => {
    expect(isValidDiscordWebhookUrl('https://discord.com/api/webhooks/123/abc')).toBe(true);
    expect(isValidDiscordWebhookUrl('https://discordapp.com/api/webhooks/456/def')).toBe(true);
    expect(isValidDiscordWebhookUrl('https://malicious-domain.com/api/webhooks/123/abc')).toBe(false);
    expect(isValidDiscordWebhookUrl('http://discord.com/api/webhooks/123/abc')).toBe(false);
    expect(isValidDiscordWebhookUrl('')).toBe(false);
  });
});
