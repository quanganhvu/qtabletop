// Everything players read: the game's name, the hotel chains and bot names. Re-skin the game here.

import type { Chain } from './game';

export const GAME_NAME = 'Skyline';
export const MONEY_SYMBOL = '$';

/** `look` names each chain's architecture; the board draws it from the `look-<chain>` styles. */
export const CHAIN_INFO: Record<Chain, { name: string; color: string; ink: string; look: string }> = {
  astra: { name: 'Astra', color: '#e3b341', ink: '#2a1e05', look: 'Neon motel' },
  bayside: { name: 'Bayside', color: '#d4553f', ink: '#fff4ec', look: 'Red-brick inn' },
  coral: { name: 'Coral', color: '#e58fa8', ink: '#3a0f1c', look: 'Miami deco' },
  dorado: { name: 'Dorado', color: '#a8743f', ink: '#fff4ec', look: 'Adobe pueblo' },
  empire: { name: 'Empire', color: '#4c9a5a', ink: '#f2fff4', look: 'Beaux-arts stone' },
  fontaine: { name: 'Fontaine', color: '#3f7fd1', ink: '#f2f7ff', look: 'Glass tower' },
  grand: { name: 'Grand', color: '#3fb6c9', ink: '#05262b', look: 'Diagrid spire' },
};

export const TIER_NAMES = ['Budget', 'Midscale', 'Luxury'] as const;

export const BOT_NAMES = ['Vera', 'Otto', 'Mabel', 'Hugo', 'Ines', 'Felix', 'Rosa'];

/** Seat colors, in seating order. */
export const PLAYER_COLORS = ['#e8c170', '#7cc4e8', '#e88a9a', '#9be08a', '#c4a0f0', '#f0a868'];

export const chainName = (chain: Chain) => CHAIN_INFO[chain].name;

export function money(amount: number): string {
  return `${amount < 0 ? '-' : ''}${MONEY_SYMBOL}${Math.abs(amount).toLocaleString('en-US')}`;
}
