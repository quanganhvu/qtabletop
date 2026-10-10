// Everything players read: the game's name, the startups and bot names. Re-skin the game here.

import type { Chain } from './game';

export const GAME_NAME = 'Tres Comas';
export const MONEY_SYMBOL = '$';

/**
 * The startups. The keys are the engine's neutral ids. `look` names each startup's
 * headquarters; the board draws it from the `look-<id>` styles. Names start with
 * different letters: the initial is shown on each company's tallest tower.
 */
export const CHAIN_INFO: Record<Chain, { name: string; color: string; ink: string; look: string; pitch: string; ticker: string }> = {
  astra: { name: 'SeeFood', color: '#e3b341', ink: '#2a1e05', look: 'Hacker-hostel garage', pitch: 'hot dog / not hot dog', ticker: 'SEEF' },
  bayside: { name: 'Bachmanity', color: '#d4553f', ink: '#fff4ec', look: 'Brick-loft offices', pitch: "Erlich & Big Head's lifestyle brand", ticker: 'BACH' },
  coral: { name: 'Aviato', color: '#e58fa8', ink: '#3a0f1c', look: 'Pastel campus', pitch: 'travel data, with a branded car', ticker: 'AVTO' },
  dorado: { name: 'Raviga', color: '#a8743f', ink: '#fff4ec', look: 'Terraced campus', pitch: "Laurie Bream's venture fund", ticker: 'RVGA' },
  empire: { name: 'Endframe', color: '#4c9a5a', ink: '#f2fff4', look: 'Old-money stone HQ', pitch: 'a middle-out knock-off', ticker: 'ENDF' },
  fontaine: { name: 'Hooli', color: '#3f7fd1', ink: '#f2f7ff', look: 'Glass tower', pitch: 'making the world a better place', ticker: 'HOOL' },
  grand: { name: 'Pied Piper', color: '#3fb6c9', ink: '#05262b', look: 'Diagrid spire', pitch: 'middle-out compression', ticker: 'PIPR' },
};

/** Share-price tiers, cheapest first. */
export const TIER_NAMES = ['Seed', 'Growth', 'Big Tech'] as const;

/** What a startup is called in running text. */
export const COMPANY = { one: 'startup', many: 'startups' } as const;

/** Bot names by level, in the order they're used: each level is played by fitting characters from the show. */
export const BOT_NAMES = {
  easy: ['Jian-Yang', 'Big Head', 'Jared'],
  normal: ['Gilfoyle', 'Dinesh', 'Richard', 'Monica'],
  hard: ['Russ Hanneman', 'Gavin Belson', 'Laurie Bream'],
} as const;
/** Spare names, if a room has more bots of one level than that level has characters. */
export const SPARE_BOT_NAMES = ['Erlich', 'Peter Gregory', 'Hoover', 'Denpok', 'Nelson'];

/** Seat colors, in seating order. */
export const PLAYER_COLORS = ['#e8c170', '#7cc4e8', '#e88a9a', '#9be08a', '#c4a0f0', '#f0a868'];

export const chainName = (chain: Chain) => CHAIN_INFO[chain].name;

export function money(amount: number): string {
  return `${amount < 0 ? '-' : ''}${MONEY_SYMBOL}${Math.abs(amount).toLocaleString('en-US')}`;
}
