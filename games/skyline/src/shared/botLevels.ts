// Bot difficulty levels: one brain, played more or less carefully.

import { chooseBotAction } from './bot';
import type { Action, GameState } from './game';

export const BOT_LEVELS = ['easy', 'normal', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export const BOT_LEVEL_INFO: Record<BotLevel, { rank: string; label: string; blurb: string }> = {
  easy: { rank: 'Bellhop', label: 'Easy', blurb: 'Often plays a random tile or buys on a whim.' },
  normal: { rank: 'Manager', label: 'Medium', blurb: 'Weighs every move, but sometimes settles for a lesser one.' },
  hard: { rank: 'Tycoon', label: 'Hard', blurb: 'Weighs every move and always plays its best.' },
};

export const isBotLevel = (x: unknown): x is BotLevel => typeof x === 'string' && (BOT_LEVELS as readonly string[]).includes(x);

const NOISE: Record<BotLevel, number> = { easy: 0.6, normal: 0.15, hard: 0 };

export function chooseLeveledAction(level: BotLevel, state: GameState, botId: string, rng: () => number = Math.random): Action {
  return chooseBotAction(state, botId, rng, NOISE[level]);
}
