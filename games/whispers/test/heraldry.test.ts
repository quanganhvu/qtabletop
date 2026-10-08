import { describe, expect, it } from 'vitest';
import { HOUSE_ARMS, PRESET_ARMS, randomArms, sanitizeArms } from '../src/shared/heraldry';

describe('heraldry', () => {
  it('accepts well-formed arms unchanged', () => {
    for (const arms of [...PRESET_ARMS, ...HOUSE_ARMS]) expect(sanitizeArms(arms)).toEqual(arms);
  });

  it('replaces malformed arms with a fallback, dropping unknown fields', () => {
    expect(sanitizeArms(null)).toEqual(PRESET_ARMS[0]);
    expect(sanitizeArms({ ...PRESET_ARMS[3], charge: '<script>' })).toEqual(PRESET_ARMS[0]);
    expect(sanitizeArms({ ...PRESET_ARMS[3], extra: 'x' })).toEqual(PRESET_ARMS[3]);
  });

  it('only generates valid random arms with a contrasting emblem', () => {
    for (let i = 0; i < 200; i++) {
      const arms = randomArms();
      expect(sanitizeArms(arms, undefined)).toEqual(arms);
      expect(arms.chargeColor).not.toBe(arms.field);
    }
  });
});
