// Display theme: the rules engine keeps neutral ids ('blue', kiln numbers, row
// numbers); everything players read comes from here, so the game can be
// re-skinned freely.

import type { Color } from './game';

export const GAME_NAME = 'Kintsugi';
export const POINTS_NAME = 'points';

/** Each glaze: its name, and the motif brushed on its tiles (so it reads without color too). */
export const GLAZES: Record<Color, { name: string; motif: string }> = {
  blue: { name: 'indigo', motif: 'wave' },
  yellow: { name: 'ochre', motif: 'fan' },
  red: { name: 'vermilion', motif: 'blossom' },
  black: { name: 'ink', motif: 'enso' },
  white: { name: 'celadon', motif: 'bamboo' },
};

export function colorName(color: Color, capital = false): string {
  const name = GLAZES[color].name;
  return capital ? name[0].toUpperCase() + name.slice(1) : name;
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
/** "the third kiln" */
export const kilnName = (i: number) => `the ${ORDINALS[i] ?? `#${i + 1}`} kiln`;
/** "row 3" (rows are numbered from 1, top to bottom). */
export const rowName = (r: number) => `row ${r + 1}`;

/** The middle of the table, where leftover tiles gather. */
export const CENTER_NAME = 'the tray';
/** The first-player marker. */
export const TOKEN_NAME = 'the master’s seal';

export const BOT_NAMES = ['Master Tadao', 'Sachiko', 'Haruki', 'Emi'];
