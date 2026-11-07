import { describe, expect, it } from 'bun:test';
import {
  calculateCateringRatios,
  generateEventOpsPack,
} from '../scripts/event-ops';

describe('event-ops', () => {
  it('calculates catering and dietary splits according to Playbook V2 formula', () => {
    const catering = calculateCateringRatios(50);
    expect(catering.attendees).toBe(50);
    expect(catering.totalPizzas).toBe(25);
    expect(catering.meatPizzas).toBe(13); // 50%
    expect(catering.vegPizzas).toBe(8);   // 30%
    expect(catering.veganPizzas).toBe(3); // 10%
    expect(catering.glutenFreePizzas).toBe(1);
    expect(catering.waterUnits).toBe(35);
    expect(catering.softDrinksBottles).toBe(7);
  });

  it('scales catering dynamically for larger attendee caps', () => {
    const catering = calculateCateringRatios(100);
    expect(catering.totalPizzas).toBe(50);
    expect(catering.meatPizzas).toBe(25);
    expect(catering.vegPizzas).toBe(15);
    expect(catering.veganPizzas).toBe(5);
    expect(catering.waterUnits).toBe(70);
  });

  it('generates complete 5-track operations pack for an event', () => {
    const pack = generateEventOpsPack('2026-11-26-edinburgh-codebase');
    expect(pack).toContain('TRACK 1: HOST VENUE LOGISTICS CHECK');
    expect(pack).toContain('TRACK 2: SPONSOR & CATERING INVOICING CHECK');
    expect(pack).toContain('TRACK 3: MOD SQUAD ROSTER CALLOUT');
    expect(pack).toContain('TRACK 4: PERSONALIZED SPEAKER BRIEFS');
    expect(pack).toContain('TRACK 5: MINUTE-BY-MINUTE DAY-OF TIMETABLE');
    expect(pack).toContain('CodeBase Edinburgh');
    expect(pack).toContain('RiverSafe');
    expect(pack).toContain('Gary Hunter');
    expect(pack).toContain('Caleb Eghan');
  });
});
