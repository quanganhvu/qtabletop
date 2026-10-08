// Bot difficulty levels: the same brain, with more or less noise in its choices.

import { chooseBotAction } from './bot';
import type { Action, GameState } from './game';

export const BOT_LEVELS = ['easy', 'normal', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export const BOT_LEVEL_INFO: Record<BotLevel, { rank: string; label: string; blurb: string }> = {
  easy: { rank: 'Cadet', label: 'Easy', blurb: 'Fresh off the shuttle: often settles for a lesser move.' },
  normal: { rank: 'Engineer', label: 'Medium', blurb: 'Weighs every move, but sometimes settles for a lesser one.' },
  hard: { rank: 'Magnate', label: 'Hard', blurb: 'Weighs every move and always plays its best.' },
};

export const isBotLevel = (x: unknown): x is BotLevel => typeof x === 'string' && (BOT_LEVELS as readonly string[]).includes(x);

const NOISE: Record<BotLevel, number> = { easy: 0.55, normal: 0.15, hard: 0 };

export function chooseLeveledAction(level: BotLevel, state: GameState, botId: string, rng: () => number = Math.random): Action {
  return chooseBotAction(state, botId, rng, NOISE[level]);
}
