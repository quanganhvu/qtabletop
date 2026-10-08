// Display theme: the rules engine keeps neutral color keys ('white', 'blue', ...);
// everything players read comes from here, so the game can be re-skinned freely.

import type { Color, Level, TokenColor } from './game';

export const GAME_NAME = 'Stronghold';
export const POINTS_NAME = 'renown';
export const POINTS_SYMBOL = '⚜';

export const RESOURCES: Record<TokenColor, { name: string; plural: string }> = {
  white: { name: 'stone', plural: 'stone' },
  blue: { name: 'cloth', plural: 'cloth' },
  green: { name: 'timber', plural: 'timber' },
  red: { name: 'wine', plural: 'wine' },
  black: { name: 'iron', plural: 'iron' },
  gold: { name: 'gold crown', plural: 'gold crowns' },
};

export const TIER_NAMES: Record<Level, string> = { 1: 'Land', 2: 'Town', 3: 'Realm' };

/** Each tier × resource has its own place (and illustration). */
export const PLACES: Record<Level, Record<Color, string>> = {
  1: { white: 'Quarry', blue: "Weaver's Cottage", green: "Woodcutter's Camp", red: 'Vineyard', black: 'Iron Mine' },
  2: { white: "Masons' Guild", blue: 'Cloth Market', green: 'Watermill', red: 'Tavern', black: "Blacksmith's Forge" },
  3: { white: 'Cathedral', blue: 'Guild Hall', green: 'Great Hall', red: 'Royal Feast Hall', black: 'Castle Keep' },
};

/** The 10 noble houses (the game's "nobles"), by noble index (n0..n9). */
export const HOUSES = [
  'House Ashford', 'House Blackwood', 'House Corwin', 'House Dunmore', 'House Everleigh',
  'House Fairhaven', 'House Greyhelm', 'House Hartwell', 'House Ironvale', 'House Lyndon',
];

export const BOT_NAMES = ['Sir Godfrey', 'Lady Rowena', 'Baron Edmund', 'Countess Matilda'];

export const resource = (c: TokenColor, n = 1) => (n === 1 ? RESOURCES[c].name : RESOURCES[c].plural);
export const place = (level: Level, color: Color) => PLACES[level][color];
export const houseName = (nobleId: string) => HOUSES[Number(nobleId.slice(1))] ?? 'A noble house';
