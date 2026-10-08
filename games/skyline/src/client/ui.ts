import type { CSSProperties } from 'react';
import type { Chain } from '../shared/game';
import { CHAIN_INFO } from '../shared/theme';

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** CSS variables that paint an element in a chain's colors. */
export const chainStyle = (chain: Chain) => ({ '--chain': CHAIN_INFO[chain].color, '--chain-ink': CHAIN_INFO[chain].ink }) as CSSProperties;
