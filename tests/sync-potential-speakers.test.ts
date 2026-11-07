import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import {
  parseCsv,
  extractLinkedinHandle,
  slugifySpeakerName,
  buildPotentialSpeakersRegistry,
  SPEAKERS_CSV_PATH,
  CFP_CSV_PATH,
} from '../scripts/sync-potential-speakers';

describe('sync-potential-speakers', () => {
  it('parses standard and multi-line quoted CSV strings', () => {
    const csv = `Col1,Col2,Col3\nVal1,"Val2 with\nlinebreak",Val3\n"Quoted ""with quotes""",Simple,Final`;
    const parsed = parseCsv(csv);
    expect(parsed.length).toBe(3);
    expect(parsed[0]).toEqual(['Col1', 'Col2', 'Col3']);
    expect(parsed[1][1]).toContain('Val2 with\nlinebreak');
    expect(parsed[2][0]).toBe('Quoted "with quotes"');
  });

  it('extracts clean LinkedIn handles from diverse URL formats', () => {
    expect(
      extractLinkedinHandle('https://www.linkedin.com/in/caleb-eghan-b60a2bba/')
    ).toBe('caleb-eghan-b60a2bba');
    expect(
      extractLinkedinHandle(
        'https://linkedin.com/in/feride-omerova-46439533b?utm_source=share_via'
      )
    ).toBe('feride-omerova-46439533b');
    expect(extractLinkedinHandle(undefined)).toBeUndefined();
    expect(extractLinkedinHandle('https://github.com/someone')).toBeUndefined();
  });

  it('slugifies speaker names reliably', () => {
    expect(slugifySpeakerName('Caleb Eghan')).toBe('caleb-eghan');
    expect(slugifySpeakerName('Feride Omerova')).toBe('feride-omerova');
    expect(slugifySpeakerName('Dr. Jane Doe-Smith, PhD')).toBe('dr-jane-doe-smith-phd');
  });

  it('builds registry successfully from existing local CSV snapshots', () => {
    if (!existsSync(SPEAKERS_CSV_PATH) || !existsSync(CFP_CSV_PATH)) {
      // In CI environments where private Google Sheet CSV snapshots are excluded via .gitignore, skip gracefully
      return;
    }
    const registry = buildPotentialSpeakersRegistry();
    expect(registry.length).toBeGreaterThanOrEqual(3);

    const caleb = registry.find((s) => s.id === 'caleb-eghan');
    expect(caleb).toBeDefined();
    expect(caleb?.fullName).toBe('Caleb Eghan');
    expect(caleb?.organisation).toBe('RiverSafe');
    expect(caleb?.linkedinHandle).toBe('caleb-eghan-b60a2bba');
    expect(caleb?.talks.length).toBeGreaterThanOrEqual(1);
    expect(caleb?.talks[0].title).toContain('Break the bank');

    const feride = registry.find((s) => s.id === 'feride-omerova');
    expect(feride).toBeDefined();
    expect(feride?.talks.length).toBeGreaterThanOrEqual(1);
    expect(feride?.talks[0].title).toContain('When AI Agents Go Rogue');
  });
});
