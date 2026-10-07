// Bot difficulty levels and which brain each one uses.

import { chooseBotAction } from './bot';
import type { Action, GameState } from './game';
import { chooseStrongAction } from './strongBot';

export const BOT_LEVELS = ['easy', 'normal', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export const BOT_LEVEL_INFO: Record<BotLevel, { rank: string; label: string; blurb: string }> = {
  easy: { rank: 'Squire', label: 'Easy', blurb: 'Plays greedily for one card at a time.' },
  normal: { rank: 'Knight', label: 'Medium', blurb: 'Weighs every move, but sometimes settles for a lesser one.' },
  hard: { rank: 'Lord', label: 'Hard', blurb: 'Weighs every move and always plays its best.' },
};

export const isBotLevel = (x: unknown): x is BotLevel => typeof x === 'string' && (BOT_LEVELS as readonly string[]).includes(x);

/** A Knight plays its best move most of the time and one of the next best otherwise. */
const KNIGHT_NOISE = 0.15;

export function chooseLeveledAction(level: BotLevel, state: GameState, botId: string, rng: () => number = Math.random): Action {
  switch (level) {
    case 'easy': return chooseBotAction(state, botId, rng);
    case 'normal': return chooseStrongAction(state, botId, rng, KNIGHT_NOISE);
    case 'hard': return chooseStrongAction(state, botId, rng, 0);
  }
}
