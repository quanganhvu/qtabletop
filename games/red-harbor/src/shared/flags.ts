// Shipping-company house flags as plain data, shared by the server (which
// validates and stores each player's flag) and the client (which draws it).

export const FLAG_COLORS = ['navy', 'red', 'white', 'yellow', 'green', 'black', 'sky', 'orange'] as const;
export const FLAG_PATTERNS = ['plain', 'band', 'stripes', 'pale', 'diagonal', 'cross', 'saltire', 'border', 'disc', 'star', 'quarters', 'chevron'] as const;

export type FlagColor = (typeof FLAG_COLORS)[number];
export type FlagPattern = (typeof FLAG_PATTERNS)[number];

/** `field` is the background; `mark` colors the pattern on top. */
export interface Flag {
  pattern: FlagPattern;
  field: FlagColor;
  mark: FlagColor;
}

export const FLAG_HEX: Record<FlagColor, string> = {
  navy: '#1d3557', red: '#b3322c', white: '#f2ede1', yellow: '#e2b33c',
  green: '#2f6b4f', black: '#1e1e22', sky: '#5d9cc9', orange: '#d9772b',
};

export const FLAG_COLOR_NAMES: Record<FlagColor, string> = {
  navy: 'Navy', red: 'Red', white: 'White', yellow: 'Yellow', green: 'Green', black: 'Black', sky: 'Sky blue', orange: 'Orange',
};

export const FLAG_PATTERN_NAMES: Record<FlagPattern, string> = {
  plain: 'Plain', band: 'Band', stripes: 'Stripes', pale: 'Pale', diagonal: 'Diagonal', cross: 'Cross',
  saltire: 'Saltire', border: 'Border', disc: 'Disc', star: 'Star', quarters: 'Quarters', chevron: 'Chevron',
};

const flag = (pattern: FlagPattern, field: FlagColor, mark: FlagColor): Flag => ({ pattern, field, mark });

/** Ready-made flags (bots take these in order). */
export const PRESET_FLAGS: Flag[] = [
  flag('band', 'navy', 'white'),
  flag('disc', 'red', 'white'),
  flag('cross', 'yellow', 'navy'),
  flag('star', 'green', 'yellow'),
  flag('saltire', 'sky', 'white'),
  flag('quarters', 'black', 'orange'),
  flag('diagonal', 'white', 'red'),
  flag('border', 'orange', 'navy'),
  flag('stripes', 'white', 'sky'),
  flag('chevron', 'navy', 'yellow'),
];

const pick = <T>(list: readonly T[], rng: () => number) => list[Math.floor(rng() * list.length)];

export function randomFlag(rng: () => number = Math.random): Flag {
  const field = pick(FLAG_COLORS, rng);
  return flag(pick(FLAG_PATTERNS, rng), field, pick(FLAG_COLORS.filter((c) => c !== field), rng));
}

/** Accept only well-formed flags from a client; anything else gets a preset. */
export function sanitizeFlag(value: unknown, fallback: Flag = PRESET_FLAGS[0]): Flag {
  const v = (value ?? {}) as Record<string, unknown>;
  const ok = <T extends string>(list: readonly T[], x: unknown): x is T => typeof x === 'string' && (list as readonly string[]).includes(x);
  if (ok(FLAG_PATTERNS, v.pattern) && ok(FLAG_COLORS, v.field) && ok(FLAG_COLORS, v.mark)) return flag(v.pattern, v.field, v.mark);
  return fallback;
}
