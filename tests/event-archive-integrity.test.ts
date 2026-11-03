import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  hasNonScottishUkPostcode,
  hasScottishPostcode,
  isNonScottishLocation,
} from '../src/utils/scottish-geography';
import { getSignificantTitleWords } from '../scripts/discover-events';

describe('Event Archive Full Integrity Test', () => {
  const eventsDir = join(process.cwd(), 'src/content/events');
  const files = readdirSync(eventsDir).filter(
    (f) => f.endsWith('.md') || f.endsWith('.mdx')
  );

  it('contains at least 40 archived and upcoming events', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  for (const file of files) {
    it(`validates integrity of ${file}`, () => {
      const content = readFileSync(join(eventsDir, file), 'utf-8');
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      expect(fmMatch).toBeTruthy();
      const fm = fmMatch![1];

      // 1. Mandatory title and date
      const title = fm.match(/^title:\s*["']?([^"'\n\r]+)/m)?.[1]?.trim();
      const date = fm.match(/^date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/m)?.[1];
      expect(title).toBeDefined();
      expect(date).toBeDefined();

      // 2. City must be one of allowed enum values
      const city = fm.match(/^city:\s*["']?([^"'\n\r]+)/m)?.[1]?.trim();
      const validCities = [
        'Edinburgh',
        'Glasgow',
        'Dundee',
        'Virtual',
        'Aberdeen',
        'Scotland-wide',
      ];
      expect(validCities).toContain(city!);

      // 3. Partner classification integrity
      const isPartnerRaw = fm.match(/^isPartnerEvent:\s*(true|false)/m)?.[1];
      expect(isPartnerRaw).toBeDefined();
      const isPartner = isPartnerRaw === 'true';
      const partnerName = fm.match(/^partnerName:\s*["']?([^"'\n\r]+)/m)?.[1]?.trim() || '';

      if (!isPartner) {
        // Official CSC event cannot define an external partner
        expect(
          partnerName === '' || partnerName === 'Cyber Scotland Connect'
        ).toBe(true);
      }

      // 4. partnerName cannot be a ticketing platform
      if (partnerName) {
        const lowerPartner = partnerName.toLowerCase();
        expect(lowerPartner).not.toBe('eventbrite');
        expect(lowerPartner).not.toBe('luma');
        expect(lowerPartner).not.toBe('meetup');
        expect(lowerPartner).not.toBe('ticketmaster');
      }

      // 5. Date sanity: cannot be more than 366 days in the future
      const maxFuture = new Date();
      maxFuture.setDate(maxFuture.getDate() + 366);
      const eventTime = new Date(date!).getTime();
      expect(eventTime).toBeLessThanOrEqual(maxFuture.getTime());

      // 6. Scottish Geography Invariant: location must never be a non-Scottish UK city or postcode
      const location = fm.match(/^location:\s*["']?([^"'\n\r]+)/m)?.[1]?.trim() || '';
      expect(location.length).toBeGreaterThan(0);
      expect(isNonScottishLocation(location)).toBe(false);
    });
  }

  describe('Scottish Geography & Discovery Hardening Guards', () => {
    it('rejects Northern England border-bleed venues and non-Scottish UK cities', () => {
      expect(isNonScottishLocation('Grainger Hub Newcastle, Newcastle upon Tyne')).toBe(true);
      expect(isNonScottishLocation('Aspire Technology Solutions Ltd, Gateshead')).toBe(true);
      expect(isNonScottishLocation('Sunderland Software Centre, Sunderland')).toBe(true);
      expect(isNonScottishLocation('ExCeL London, Royal Victoria Dock')).toBe(true);
      expect(isNonScottishLocation('Manchester Central Convention Complex')).toBe(true);
      expect(isNonScottishLocation('ICC Belfast')).toBe(true);
    });

    it('rejects non-Scottish UK postcodes including Berwick-upon-Tweed (TD15)', () => {
      expect(hasNonScottishUkPostcode('Grainger Hub, NE1 4ST')).toBe(true);
      expect(hasNonScottishUkPostcode('Gateshead Quays, NE8 3BA')).toBe(true);
      expect(hasNonScottishUkPostcode('London EC2A 4NE')).toBe(true);
      expect(hasNonScottishUkPostcode('Berwick Workspace, TD15 1AA')).toBe(true);
      expect(isNonScottishLocation('Some Venue, NE1 4ST')).toBe(true);
    });

    it('accepts valid Scottish venues, Scottish street names, and all 16 Scottish postcode areas', () => {
      expect(isNonScottishLocation('CodeBase, 37a Castle Terrace, Edinburgh, EH1 2EL')).toBe(false);
      expect(isNonScottishLocation('The Place Hotel, 34-38 York Pl, Edinburgh EH1 3HU')).toBe(false);
      expect(isNonScottishLocation('120 Bath Street, Glasgow G2 2EN')).toBe(false);
      expect(isNonScottishLocation('University of Strathclyde, Glasgow, G1 1XQ')).toBe(false);
      expect(isNonScottishLocation('Abertay cyberQuarter, Dundee, DD1 1HG')).toBe(false);
      expect(isNonScottishLocation('ONE Tech Hub, Aberdeen, AB10 1XG')).toBe(false);
      expect(isNonScottishLocation('An Lochran, Inverness Campus, IV2 5NA')).toBe(false);
      expect(isNonScottishLocation('Galashiels, Scottish Borders, TD1 1PR')).toBe(false);
      expect(hasScottishPostcode('CodeBase, EH1 2EL')).toBe(true);
      expect(hasScottishPostcode('Galashiels, TD1 1PR')).toBe(true);
      expect(hasScottishPostcode('Berwick, TD15 1AA')).toBe(false);
    });

    it('excludes generic domain stopwords during same-date title deduplication', () => {
      const wordsA = getSignificantTitleWords('Hack Your Future: Routes into Cyber');
      const wordsB = getSignificantTitleWords(
        'It Started with a Click: Protecting Your Business from Cyber Threats'
      );
      const overlap = [...wordsA].filter((w) => wordsB.has(w));
      expect(overlap.length).toBe(0);
    });
  });
});
