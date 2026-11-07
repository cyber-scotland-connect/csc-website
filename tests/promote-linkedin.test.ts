import { describe, expect, it } from 'bun:test';
import path from 'path';
import {
  resolveLinkedinOrg,
  formatLinkedinMention,
} from '../src/utils/partner-registry';
import {
  extractLinkedinHandleFromUrl,
  extractLinkedinUrlFromHtml,
} from '../scripts/discover-linkedin-orgs';
import {
  validateAntiSlop,
  validateAntiBanCompliance,
  validateFactualIntegrity,
  canPublishUnderRateAndIdempotencyLimits,
  computeContentSha256,
  resolveNextEvergreenPillar,
  resolveRotatingSponsorHighlights,
  selectContextualHashtags,
  classifyPromotionStream,
  resolveCscCadenceStep,
  parseRichEventMarkdown,
  buildCscCadencePost,
  buildWeeklyDigestPost,
  buildEvergreenOrgPost,
} from '../scripts/promote-linkedin';

describe('LinkedIn Event Promotion & Anti-Slop Engine', () => {
  it('resolves LinkedIn handles and numeric API URNs for Official Partners, Sponsors, and Community Orgs', () => {
    const codebase = resolveLinkedinOrg('CodeBase Edinburgh');
    expect(codebase?.linkedinHandle).toBe('thisiscodebase');
    expect(codebase?.linkedinOrgId).toBe('5017421');
    expect(codebase?.apiUrnMention).toBe(
      '@[CodeBase Edinburgh](urn:li:organization:5017421)'
    );
    expect(formatLinkedinMention('CodeBase Edinburgh')).toBe('@CodeBase Edinburgh');
    expect(formatLinkedinMention('CodeBase Edinburgh', { useApiUrn: true })).toBe(
      '@[CodeBase Edinburgh](urn:li:organization:5017421)'
    );

    const riversafe = resolveLinkedinOrg('RiverSafe');
    expect(riversafe?.linkedinHandle).toBe('riversafe');
    expect(riversafe?.linkedinOrgId).toBe('1861942');
    expect(formatLinkedinMention('RiverSafe')).toBe('@RiverSafe');

    const hackThursday = resolveLinkedinOrg('Hack Thursday');
    expect(hackThursday?.linkedinHandle).toBe('hack-thursday');
    expect(formatLinkedinMention('Hack Thursday')).toBe('@Hack Thursday');

    const enusec = resolveLinkedinOrg('ENUSEC (Napier Cyber Security Society)');
    expect(enusec?.linkedinHandle).toBe('enusec');

    const abertayHackers = resolveLinkedinOrg('Abertay Hackers');
    expect(abertayHackers?.linkedinHandle).toBe('abertay-hackers');
  });

  it('extracts LinkedIn handles from company and school URLs and HTML', () => {
    expect(
      extractLinkedinHandleFromUrl('https://www.linkedin.com/company/thisiscodebase/')
    ).toBe('thisiscodebase');
    expect(
      extractLinkedinHandleFromUrl('https://uk.linkedin.com/school/abertay-university/')
    ).toBe('abertay-university');

    const sampleHtml = `<footer class="social"><a href="https://www.linkedin.com/company/scotlandis/">LinkedIn</a></footer>`;
    expect(extractLinkedinUrlFromHtml(sampleHtml)).toBe(
      'https://www.linkedin.com/company/scotlandis/'
    );
  });

  it('routes events into the three distinct LinkedIn streams (csc, partners, community)', () => {
    expect(
      classifyPromotionStream({
        isPartnerEvent: false,
        partnerName: 'Cyber Scotland Connect',
        title: 'Cyber Scotland Connect: Edinburgh Meetup at CodeBase',
      })
    ).toBe('csc');

    expect(
      classifyPromotionStream({
        isPartnerEvent: true,
        partnerName: 'DIGIT',
        title: 'DIGIT Expo 2026',
      })
    ).toBe('partners');

    expect(
      classifyPromotionStream({
        isPartnerEvent: true,
        partnerName: 'Cyber and Fraud Centre Scotland',
        title: 'Intro to Cyber Security',
      })
    ).toBe('partners');

    expect(
      classifyPromotionStream({
        isPartnerEvent: false,
        partnerName: 'Hack Thursday',
        title: 'Hack Thursday Glasgow: November Gathering',
      })
    ).toBe('community');
  });

  it('maps CSC countdown day offsets (launch, 14, 7, 4, 3, 2, 1, +1) accurately', () => {
    expect(resolveCscCadenceStep('2026-11-26', '2026-11-05', true).step).toBe('launch');
    expect(resolveCscCadenceStep('2026-11-26', '2026-11-12', false).step).toBe('t-14');
    expect(resolveCscCadenceStep('2026-11-26', '2026-11-19', false).step).toBe('t-7');
    expect(resolveCscCadenceStep('2026-11-26', '2026-11-22', false).step).toBe('t-4');
    expect(resolveCscCadenceStep('2026-11-26', '2026-11-23', false).step).toBe('t-3');
    expect(resolveCscCadenceStep('2026-11-26', '2026-11-24', false).step).toBe('t-2');
    expect(resolveCscCadenceStep('2026-11-26', '2026-11-25', false).step).toBe('t-1');
    expect(resolveCscCadenceStep('2026-11-26', '2026-11-27', false).step).toBe('plus-1');
  });

  it('rejects AI slop phrases and passes clean practitioner copy', () => {
    const slopSample =
      "We are thrilled to announce a game-changer meetup where we delve into the rapidly evolving threat landscape — not just a talk, it's a movement!";
    const slopResult = validateAntiSlop(slopSample);
    expect(slopResult.passed).toBe(false);
    expect(slopResult.violations.length).toBeGreaterThanOrEqual(4);

    const cleanSample =
      'Four practitioner talks on agentic SOC operations, malware config extraction, and API authorization at @CodeBase Edinburgh.';
    const cleanResult = validateAntiSlop(cleanSample);
    expect(cleanResult.passed).toBe(true);
    expect(cleanResult.violations).toHaveLength(0);
  });

  it('generates anti-slop validated posts across all CSC cadence steps and weekly digests', async () => {
    const cscPath = path.join(
      process.cwd(),
      'src/content/events/2026-11-26-edinburgh-codebase.md'
    );
    const cscEvent = parseRichEventMarkdown(cscPath);
    expect(cscEvent).not.toBeNull();
    expect(cscEvent!.speakers.length).toBe(4);
    expect(cscEvent!.hostVenueName).toBe('CodeBase Edinburgh');
    expect(cscEvent!.sponsorNames).toContain('RiverSafe');

    for (const step of [
      'launch',
      't-14',
      't-7',
      't-4',
      't-3',
      't-2',
      't-1',
      'plus-1',
    ] as const) {
      const post = await buildCscCadencePost(cscEvent!, step, {
        enableAi: false,
        referenceDate: '2026-11-12',
      });
      expect(post.antiSlopValidation.passed).toBe(true);
      expect(post.postBody).toContain('@CodeBase Edinburgh');
      expect(post.apiReadyPostBody).toContain(
        '@[CodeBase Edinburgh](urn:li:organization:5017421)'
      );
      expect(post.resolvedSpeakerTags.length).toBe(4);
      expect(post.resolvedSpeakerTags[0].mention).toBe('@Gary Hunter');
      expect(post.firstComment).toContain(
        'https://cyberscotlandconnect.com/events/2026-11-26-edinburgh-codebase/'
      );
    }

    const digitEvent = parseRichEventMarkdown(
      path.join(process.cwd(), 'src/content/events/2026-11-19-digit-expo.md')
    );
    const partnerDigest = await buildWeeklyDigestPost('partners', [digitEvent!], {
      referenceDate: '2026-11-07',
    });
    expect(partnerDigest.antiSlopValidation.passed).toBe(true);
    expect(partnerDigest.postBody).toContain('@DIGIT');
    expect(partnerDigest.postBody).toContain('📅 Coming Up in the Next 14 Days:');

    const hackThuEvent = parseRichEventMarkdown(
      path.join(
        process.cwd(),
        'src/content/events/2026-11-19-hack-thursday-glasgow-november.md'
      )
    );
    const communityDigest = await buildWeeklyDigestPost('community', [hackThuEvent!], {
      referenceDate: '2026-11-07',
    });
    expect(communityDigest.antiSlopValidation.passed).toBe(true);
    expect(communityDigest.postBody).toContain('@Hack Thursday');

    for (const pillar of [
      'directory',
      'discord',
      'mission',
      'speakers',
      'sponsors',
      'catalogue',
    ] as const) {
      const evergreen = await buildEvergreenOrgPost(pillar, 20);
      expect(evergreen.antiSlopValidation.passed).toBe(true);
      expect(evergreen.factualIntegrity.passed).toBe(true);
      expect(evergreen.antiBanCompliance.passed).toBe(true);
      expect(evergreen.publishReady).toBe(true);
      expect(evergreen.postBody).toContain('@Cyber Scotland Connect');
    }
  });

  it('enforces factual integrity, anti-ban tag/URL caps, and rate-limit / idempotency circuit breakers', async () => {
    const cscPath = path.join(
      process.cwd(),
      'src/content/events/2026-11-26-edinburgh-codebase.md'
    );
    const cscEvent = parseRichEventMarkdown(cscPath)!;

    // 1. Factual Integrity Gate: blocks Aberdeen CSC chapter claims, standalone CSC / #CyberScotland, stale dates, and AI-hallucinated digits
    const badFactCheck = validateFactualIntegrity({
      stream: 'csc',
      cadenceStep: 'launch',
      postBody: 'Join our CSC chapter meetup in Aberdeen on Thu, 26 Nov 2026! #CyberScotland',
      firstComment: 'https://cyberscotlandconnect.com/events/',
      events: [cscEvent],
      referenceDate: '2026-12-01', // after event date -> stale event
      aiHook: 'Over 450 practitioners attended last week.', // 450 is not in source data -> hallucinated number
    });
    expect(badFactCheck.passed).toBe(false);
    expect(badFactCheck.violations.some((v) => v.includes('Aberdeen'))).toBe(true);
    expect(badFactCheck.violations.some((v) => v.includes('#CyberScotlandConnect'))).toBe(true);
    expect(badFactCheck.violations.some((v) => v.includes('abbreviated "CSC"'))).toBe(true);
    expect(badFactCheck.violations.some((v) => v.includes('stale/past event'))).toBe(true);
    expect(badFactCheck.violations.some((v) => v.includes('450'))).toBe(true);

    // 2. Anti-Ban Gate: blocks raw URLs in postBody, >6 org mentions, and missing/excessive hashtags
    const sevenOrgs = [
      'Org1',
      'Org2',
      'Org3',
      'Org4',
      'Org5',
      'Org6',
      'Org7',
    ].map((name) => ({ name, mention: `@${name}`, linkedinHandle: name.toLowerCase() }));

    const badBanCheck = validateAntiBanCompliance({
      postBody:
        'Check out https://example.com with @Org1 @Org2 @Org3 @Org4 @Org5 @Org6 @Org7 right now in Edinburgh for Scottish security practitioners.',
      firstComment: 'http://insecure-link.example.com',
      resolvedTags: sevenOrgs,
      resolvedSpeakerTags: [],
    });
    expect(badBanCheck.passed).toBe(false);
    expect(badBanCheck.violations.some((v) => v.includes('raw URL found in main postBody'))).toBe(
      true
    );
    expect(
      badBanCheck.violations.some((v) => v.includes('excessive organization @mentions'))
    ).toBe(true);
    expect(badBanCheck.violations.some((v) => v.includes('non-HTTPS URL'))).toBe(true);

    // 3. Rate-limit & Idempotency Circuit Breaker: blocks duplicate keys, duplicate SHA-256, and >2 posts/24h
    const validPost = await buildCscCadencePost(cscEvent, 'launch', {
      enableAi: false,
      referenceDate: '2026-11-07',
    });
    expect(validPost.publishReady).toBe(true);

    const sha = computeContentSha256(validPost.postBody, validPost.firstComment);
    const duplicateKeyCheck = canPublishUnderRateAndIdempotencyLimits(
      validPost,
      [
        {
          key: validPost.ledgerKey,
          stream: 'csc',
          eventSlugs: [cscEvent.slug],
          contentSha256: 'different-hash',
          postedAt: '2026-11-01T10:00:00Z',
          mode: 'live',
        },
      ],
      '2026-11-07T10:00:00Z'
    );
    expect(duplicateKeyCheck.allowed).toBe(false);
    expect(duplicateKeyCheck.reason).toContain('idempotency block');

    const cooldownCheck = canPublishUnderRateAndIdempotencyLimits(
      validPost,
      [
        {
          key: 'evergreen:directory:2026-11',
          stream: 'evergreen',
          eventSlugs: [],
          contentSha256: 'other-hash',
          postedAt: '2026-11-07T08:30:00Z', // 1.5 hours ago (< 4h cooldown)
          mode: 'live',
        },
      ],
      '2026-11-07T10:00:00Z'
    );
    expect(cooldownCheck.allowed).toBe(false);
    expect(cooldownCheck.reason).toContain('cooldown block');

    const dupShaCheck = canPublishUnderRateAndIdempotencyLimits(
      validPost,
      [
        {
          key: 'different-key',
          stream: 'csc',
          eventSlugs: [],
          contentSha256: sha,
          postedAt: '2026-11-01T10:00:00Z',
          mode: 'live',
        },
      ],
      '2026-11-07T10:00:00Z'
    );
    expect(dupShaCheck.allowed).toBe(false);
    expect(dupShaCheck.reason).toContain('duplicate content block');
  });

  it('auto-rotates Evergreen pillars, rotates sponsor @tags within anti-spam limits, and derives contextual hashtags', () => {
    // 1. Ledger-driven next-pillar rotation
    expect(
      resolveNextEvergreenPillar('2026-11-07', [
        {
          key: 'evergreen:directory:2026-11',
          stream: 'evergreen',
          evergreenPillar: 'directory',
          eventSlugs: [],
          contentSha256: 'abc',
          postedAt: '2026-11-01T10:00:00Z',
          mode: 'live',
        },
      ])
    ).toBe('speakers');

    // 2. Date-driven fortnight rotation when ledger has no prior evergreen entries
    const firstHalfPillar = resolveNextEvergreenPillar('2026-11-01', []);
    const secondHalfPillar = resolveNextEvergreenPillar('2026-11-15', []);
    expect(firstHalfPillar).not.toBe(secondHalfPillar);

    // 3. Rotating sponsor & venue highlights stay <= 5 active @Org tags while crediting all 9 supporters
    const rotA = resolveRotatingSponsorHighlights('2026-11-01');
    const rotB = resolveRotatingSponsorHighlights('2026-11-15');
    expect(rotA.taggedHosts.length).toBe(2);
    expect(rotA.taggedSponsors.length).toBe(2);
    expect(rotA.taggedHosts.length + rotA.plainHosts.length).toBe(4);
    expect(rotA.taggedSponsors.length + rotA.plainSponsors.length).toBe(5);
    expect(rotA.taggedSponsors).not.toEqual(rotB.taggedSponsors);

    // 4. Contextual hashtag taxonomy (3-4 tags: Brand + Region + Topic)
    const edinburghSocTags = selectContextualHashtags({
      stream: 'csc',
      city: 'Edinburgh',
      corpus: 'The Path to an Agentic SoC and SIEM detection engineering',
    });
    expect(edinburghSocTags).toContain('#CyberScotlandConnect');
    expect(edinburghSocTags).toContain('#EdinburghTech');
    expect(edinburghSocTags).toContain('#SecOps');
    expect(edinburghSocTags.length).toBeLessThanOrEqual(4);

    const glasgowOffsecTags = selectContextualHashtags({
      stream: 'community',
      city: 'Glasgow',
      corpus: '2600 Glasgow informal hacker and reverse engineering CTF',
    });
    expect(glasgowOffsecTags).toContain('#CyberScotlandConnect');
    expect(glasgowOffsecTags).toContain('#GlasgowTech');
    expect(glasgowOffsecTags).toContain('#OffSec');
  });
});
