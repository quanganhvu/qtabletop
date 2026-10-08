// Bot difficulty levels and how each one plays.

import { chooseBotAction, type BotStyle } from './bot';
import type { Action, GameState } from './game';

export const BOT_LEVELS = ['easy', 'normal', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export const BOT_LEVEL_INFO: Record<BotLevel, { rank: string; label: string; blurb: string }> = {
  easy: { rank: 'Squire', label: 'Easy', blurb: 'Plays for its own points and often settles for a lesser move.' },
  normal: { rank: 'Knight', label: 'Medium', blurb: 'Weighs every move against its rivals, but sometimes settles for a lesser one.' },
  hard: { rank: 'Lord', label: 'Hard', blurb: 'Weighs every move against its rivals and always plays its best.' },
};

const STYLES: Record<BotLevel, BotStyle> = {
  easy: { noise: 0.6, spread: 6, selfish: true },
  normal: { noise: 0.2, spread: 3, selfish: false },
  hard: { noise: 0, spread: 1, selfish: false },
};

export const isBotLevel = (x: unknown): x is BotLevel => typeof x === 'string' && (BOT_LEVELS as readonly string[]).includes(x);

export function chooseLeveledAction(level: BotLevel, state: GameState, botId: string, rng: () => number = Math.random): Action {
  return chooseBotAction(state, botId, rng, STYLES[level]);
}
