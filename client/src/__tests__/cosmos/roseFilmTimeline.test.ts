import { describe, it, expect } from 'vitest';
import {
  CUES,
  FILM_DURATION,
  MEET_START,
  MEET_TRAVEL,
  RING_RADIUS,
  RISE_TRAVEL,
  ROSE,
  SEAT_COUNT,
  filmState,
  seatParams,
  seatWorld,
} from '../../cosmos/rose-film/timeline';

const LAYOUTS = [
  { aspect: 1512 / 950, portrait: false },
  { aspect: 390 / 844, portrait: true },
];

describe('rose film timeline', () => {
  it('keeps every line of words inside the film, in order, without overlap', () => {
    const spans = Object.values(CUES);
    let previousEnd = 0;
    for (const [start, end] of spans) {
      // A line has faded out before the next one fades in.
      expect(start).toBeGreaterThanOrEqual(previousEnd === 0 ? 0 : previousEnd + 0.55);
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(FILM_DURATION);
      previousEnd = end;
    }
  });

  it('gives the last verse at least four seconds on screen', () => {
    expect(CUES.verse[1] - CUES.verse[0]).toBeGreaterThanOrEqual(4);
  });

  it('returns finite values for every second on both layouts', () => {
    for (const layout of LAYOUTS) {
      for (let t = 0; t <= FILM_DURATION; t += 0.1) {
        const state = filmState(t, layout);
        for (const [key, value] of Object.entries(state)) {
          expect(Number.isFinite(value), `${key} at ${t.toFixed(1)}s`).toBe(true);
        }
      }
    }
  });

  it('turns one way only and never jumps', () => {
    let previous = filmState(0, LAYOUTS[0]).rot;
    for (let t = 0.05; t <= FILM_DURATION; t += 0.05) {
      const rot = filmState(t, LAYOUTS[0]).rot;
      expect(rot).toBeGreaterThanOrEqual(previous);
      expect(rot - previous).toBeLessThan(0.02);
      previous = rot;
    }
  });

  it('opens on the river and ends on the open rose under a dark frame', () => {
    const first = filmState(0.5, LAYOUTS[0]);
    expect(first.bend).toBe(0);
    expect(first.morph).toBe(0);
    const last = filmState(FILM_DURATION, LAYOUTS[0]);
    expect(last.bend).toBe(1);
    expect(last.morph).toBe(1);
    expect(last.bloom).toBeGreaterThanOrEqual(1);
    expect(last.flash).toBe(1);
  });

  it('seats thirty lights on the crown around the round, each from its own place on the horizon', () => {
    const seats = Array.from({ length: SEAT_COUNT }, (_, i) => seatParams(i));
    expect(new Set(seats.map((s) => s.angle)).size).toBe(SEAT_COUNT);
    expect(new Set(seats.map((s) => s.startX)).size).toBe(SEAT_COUNT);
    for (const seat of seats) {
      const [x, y] = seatWorld(seat, FILM_DURATION);
      expect(Math.hypot(x, y)).toBeGreaterThan(RING_RADIUS);
      expect(Math.hypot(x, y)).toBeLessThan(ROSE.rim);
      expect(seat.startX).toBeGreaterThan(0);
      expect(seat.startX).toBeLessThan(1);
      expect(seat.seed).toBeGreaterThanOrEqual(0);
      expect(seat.seed).toBeLessThan(1);
    }
  });

  it('builds the rose from the sun outwards: tiers inside the round, a wreath outside it', () => {
    const radii = [...ROSE.tiers, RING_RADIUS, ...ROSE.wreath, ROSE.rim];
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThan(radii[i - 1]);
  });

  it('kindles each light before it rises, the earliest life first, and seats them all before the end', () => {
    const seats = Array.from({ length: SEAT_COUNT }, (_, i) => seatParams(i));
    seats.forEach((seat, i) => {
      expect(seat.lift - seat.kindle).toBeGreaterThanOrEqual(1.5);
      expect(seat.lift + RISE_TRAVEL).toBeLessThan(CUES.verse[1] - 2);
      if (i > 0) {
        expect(seat.kindle).toBeGreaterThan(seats[i - 1].kindle);
        expect(seat.lift).toBeGreaterThan(seats[i - 1].lift);
      }
    });
  });

  it('lets the sun rise only after the tiers have begun to fill', () => {
    expect(filmState(8.5, LAYOUTS[0]).sun).toBe(0);
    expect(filmState(8.5, LAYOUTS[0]).bloom).toBeGreaterThan(0.3);
    expect(filmState(CUES.verse[0] + 0.5, LAYOUTS[0]).sun).toBe(1);
  });

  it('brings the light that becomes Beatrice down before the last line has stood for two seconds', () => {
    expect(MEET_START + MEET_TRAVEL).toBeLessThan(CUES.verse[0] + 2);
    expect(filmState(MEET_START, LAYOUTS[0]).beatrice).toBe(0);
    expect(filmState(FILM_DURATION - 1.5, LAYOUTS[0]).beatrice).toBe(1);
  });
});
