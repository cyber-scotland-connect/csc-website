import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

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
    });
  }
});
