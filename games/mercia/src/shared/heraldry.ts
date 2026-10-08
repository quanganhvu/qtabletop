// Coats of arms as plain data, shared by the server (which validates and stores
// each player's arms) and the client (which draws them; see client/art/heraldry.ts).

export const TINCTURES = ['or', 'argent', 'gules', 'azure', 'vert', 'sable', 'purpure'] as const;
export const DIVISIONS = ['plain', 'perPale', 'perFess', 'perBend', 'quarterly', 'chevron', 'chief', 'bend', 'pale', 'saltire'] as const;
export const CHARGES = ['none', 'fleur', 'mullet', 'crescent', 'tower', 'cross', 'crown', 'key', 'bezants'] as const;

export type Tincture = (typeof TINCTURES)[number];
export type Division = (typeof DIVISIONS)[number];
export type Charge = (typeof CHARGES)[number];

/**
 * `field` is the main color. `second` is the other half of a divided field, or
 * the color of the band (chevron, chief, bend, pale, saltire). Unused when plain.
 */
export interface Arms {
  division: Division;
  field: Tincture;
  second: Tincture;
  charge: Charge;
  chargeColor: Tincture;
}

export const TINCTURE_NAMES: Record<Tincture, string> = {
  or: 'Gold', argent: 'Silver', gules: 'Red', azure: 'Blue', vert: 'Green', sable: 'Black', purpure: 'Purple',
};
export const DIVISION_NAMES: Record<Division, string> = {
  plain: 'Plain', perPale: 'Halved', perFess: 'Split', perBend: 'Diagonal', quarterly: 'Quartered',
  chevron: 'Chevron', chief: 'Chief', bend: 'Bend', pale: 'Pale', saltire: 'Saltire',
};
export const CHARGE_NAMES: Record<Charge, string> = {
  none: 'None', fleur: 'Fleur-de-lis', mullet: 'Star', crescent: 'Crescent', tower: 'Tower',
  cross: 'Cross', crown: 'Crown', key: 'Key', bezants: 'Coins',
};

const arms = (division: Division, field: Tincture, second: Tincture, charge: Charge, chargeColor: Tincture): Arms =>
  ({ division, field, second, charge, chargeColor });

/** The noble houses' arms, by noble index (n0..n9). */
export const HOUSE_ARMS: Arms[] = [
  arms('plain', 'azure', 'or', 'fleur', 'or'), // Ashford
  arms('perPale', 'argent', 'sable', 'mullet', 'gules'), // Blackwood
  arms('chevron', 'gules', 'or', 'crescent', 'argent'), // Corwin
  arms('plain', 'vert', 'argent', 'tower', 'argent'), // Dunmore
  arms('quarterly', 'or', 'gules', 'none', 'or'), // Everleigh
  arms('plain', 'argent', 'gules', 'cross', 'gules'), // Fairhaven
  arms('chief', 'sable', 'or', 'key', 'or'), // Greyhelm
  arms('plain', 'purpure', 'or', 'crown', 'or'), // Hartwell
  arms('perBend', 'azure', 'argent', 'bezants', 'or'), // Ironvale
  arms('saltire', 'vert', 'argent', 'none', 'or'), // Lyndon
];

/** Ready-made arms players can pick from. */
export const PRESET_ARMS: Arms[] = [
  arms('plain', 'gules', 'or', 'crown', 'or'),
  arms('perPale', 'azure', 'or', 'fleur', 'argent'),
  arms('chief', 'vert', 'or', 'mullet', 'argent'),
  arms('quarterly', 'argent', 'azure', 'none', 'or'),
  arms('plain', 'sable', 'or', 'tower', 'or'),
  arms('chevron', 'azure', 'argent', 'mullet', 'or'),
  arms('perFess', 'purpure', 'or', 'crescent', 'argent'),
  arms('bend', 'gules', 'argent', 'key', 'or'),
  arms('plain', 'or', 'sable', 'cross', 'sable'),
  arms('saltire', 'azure', 'or', 'none', 'or'),
  arms('pale', 'argent', 'gules', 'fleur', 'or'),
  arms('perBend', 'sable', 'gules', 'crescent', 'or'),
];

const pick = <T>(list: readonly T[], rng: () => number) => list[Math.floor(rng() * list.length)];

export function randomArms(rng: () => number = Math.random): Arms {
  const field = pick(TINCTURES, rng);
  const second = pick(TINCTURES.filter((t) => t !== field), rng);
  const chargeColor = pick(TINCTURES.filter((t) => t !== field), rng);
  return arms(pick(DIVISIONS, rng), field, second, pick(CHARGES, rng), chargeColor);
}

/** Accept only well-formed arms from a client; anything else gets a preset. */
export function sanitizeArms(value: unknown, fallback: Arms = PRESET_ARMS[0]): Arms {
  const v = (value ?? {}) as Record<string, unknown>;
  const ok = <T extends string>(list: readonly T[], x: unknown): x is T => typeof x === 'string' && (list as readonly string[]).includes(x);
  if (ok(DIVISIONS, v.division) && ok(TINCTURES, v.field) && ok(TINCTURES, v.second) && ok(CHARGES, v.charge) && ok(TINCTURES, v.chargeColor)) {
    return arms(v.division, v.field, v.second, v.charge, v.chargeColor);
  }
  return fallback;
}
