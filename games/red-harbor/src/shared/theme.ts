// Display theme. The rules engine keeps neutral keys inherited from the harbour
// game ('wood', 'franc', ships, the town...); everything players read comes from
// here, so the game can be re-skinned freely.

import type { Good } from './goods';

/** Working title: see the README for the shortlist. */
export const GAME_NAME = 'Red Harbor';
export const TAGLINE = 'Mine, farm and build your way to a fortune while the colonies turn Mars green. 2–5 players.';

/** Credits: written after the number, e.g. "5cr". */
export const FRANC = 'cr';

export const BOT_NAMES = ['Commander Vega', 'Dr. Okafor', 'Engineer Lindqvist', 'Captain Reyes', 'Dr. Tanaka'];

/** [singular, plural] for each good. */
export const GOOD_NAMES: Record<Good, [string, string]> = {
  franc: ['credit', 'credits'],
  fish: ['algae', 'algae'],
  wood: ['biomass', 'biomass'],
  clay: ['regolith', 'regolith'],
  iron: ['iron ore', 'iron ore'],
  grain: ['crops', 'crops'],
  cattle: ['insect colony', 'insect colonies'],
  coal: ['uranium', 'uranium'],
  hides: ['chitin', 'chitin'],
  smokedFish: ['algae cake', 'algae cakes'],
  charcoal: ['biofuel', 'biofuel'],
  bricks: ['block', 'blocks'],
  steel: ['steel', 'steel'],
  bread: ['meal', 'meals'],
  meat: ['protein', 'protein'],
  coke: ['fuel rod', 'fuel rods'],
  leather: ['composite', 'composite'],
};

/** Words for the places and pieces of the board. */
export const T = {
  town: 'the Colony Authority',
  townShort: 'Colony',
  harbour: 'Spaceport',
  offers: 'Landing pads',
  supply: 'Orbit',
  ship: 'rocket',
  ships: 'rockets',
  proposals: 'Blueprints',
  worker: 'engineer',
  round: 'Sol cycle',
  feeding: 'Life support',
  harvest: 'greenhouse yield',
  craft: 'workshop',
  industry: 'industry',
  fishing: 'farm',
} as const;
