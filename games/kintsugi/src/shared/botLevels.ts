// Bot difficulty levels and how each one plays.

import { chooseBotAction, type BotStyle } from './bot';
import type { Action, GameState } from './game';

export const BOT_LEVELS = ['easy', 'normal', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export const BOT_LEVEL_INFO: Record<BotLevel, { rank: string; label: string; blurb: string }> = {
  easy: { rank: 'Apprentice', label: 'Easy', blurb: 'Fills its own wall and often settles for a lesser move.' },
  normal: { rank: 'Artisan', label: 'Medium', blurb: 'Plans its wall well, but sometimes settles for a lesser move.' },
  hard: { rank: 'Master', label: 'Hard', blurb: 'Plans its wall and leaves its rivals as little as it can.' },
};

const STYLES: Record<BotLevel, BotStyle> = {
  easy: { noise: 0.45, spread: 5, lookahead: false },
  normal: { noise: 0.15, spread: 3, lookahead: false },
  hard: { noise: 0, spread: 1, lookahead: true },
};

export const isBotLevel = (x: unknown): x is BotLevel => typeof x === 'string' && (BOT_LEVELS as readonly string[]).includes(x);

export function chooseLeveledAction(level: BotLevel, state: GameState, botId: string, rng: () => number = Math.random): Action {
  return chooseBotAction(state, botId, rng, STYLES[level]);
}
