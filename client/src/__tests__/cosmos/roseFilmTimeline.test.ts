import { describe, it, expect } from 'vitest';
import {
  CUES,
  FILM_DURATION,
  MEET_START,
  MEET_TRAVEL,
  RISE_TRAVEL,
  SEAT_COUNT,
  filmState,
  rosePoint,
  seatParams,
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

  it('seats thirty lights on the rims of the rose, each from its own place on the horizon', () => {
    const seats = Array.from({ length: SEAT_COUNT }, (_, i) => seatParams(i));
    expect(new Set(seats.map((s) => s.theta)).size).toBe(SEAT_COUNT);
    expect(new Set(seats.map((s) => s.startX)).size).toBe(SEAT_COUNT);
    for (const seat of seats) {
      const [x, y, z] = rosePoint(seat.theta, seat.x1);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(1.05);
      expect(Number.isFinite(z)).toBe(true);
      expect(seat.startX).toBeGreaterThan(0);
      expect(seat.startX).toBeLessThan(1);
      expect(seat.seed).toBeGreaterThanOrEqual(0);
      expect(seat.seed).toBeLessThan(1);
    }
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

  it('holds the full wall of names for at least a second and a half', () => {
    const seats = Array.from({ length: SEAT_COUNT }, (_, i) => seatParams(i));
    // A name takes 0.7 s to appear beside its light.
    const allLit = seats[SEAT_COUNT - 1].kindle + 0.7;
    expect(seats[0].lift - allLit).toBeGreaterThanOrEqual(1.5);
  });

  it('brings the light that becomes Beatrice down before the last line has stood for two seconds', () => {
    expect(MEET_START + MEET_TRAVEL).toBeLessThan(CUES.verse[0] + 2);
    expect(filmState(MEET_START, LAYOUTS[0]).beatrice).toBe(0);
    expect(filmState(FILM_DURATION - 1.5, LAYOUTS[0]).beatrice).toBe(1);
  });
});
