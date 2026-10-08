import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, chooseLeveledAction, type BotLevel } from '../src/shared/botLevels';
import { applyAction, createGame, type GameState } from '../src/shared/game';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

/** Plays a whole game; applyAction throws if any bot ever picks an illegal move. */
function play(levels: BotLevel[], seed: number): GameState {
  const rng = seeded(seed);
  const g = createGame(levels.map((_, i) => ({ id: String(i), name: `Bot ${i}` })), rng);
  for (let step = 0; step < 2000 && g.phase !== 'over'; step++) {
    const id = g.players[g.current].id;
    applyAction(g, id, chooseLeveledAction(levels[Number(id)], g, id, rng));
  }
  return g;
}

describe('bot levels', () => {
  it.each(BOT_LEVELS)('%s bots play 2-4 player games to the end with only legal moves', (level) => {
    for (let seed = 1; seed <= 12; seed++) {
      const g = play(Array(2 + (seed % 3)).fill(level), seed);
      expect(g.phase).toBe('over');
    }
  });

  it('a Lord (hard) beats a Squire (easy) most of the time', () => {
    let lordWins = 0;
    const games = 60;
    for (let s = 0; s < games; s++) {
      const lordFirst = s % 2 === 0;
      const levels: BotLevel[] = lordFirst ? ['hard', 'easy'] : ['easy', 'hard'];
      const g = play(levels, 5000 + s);
      const lordId = lordFirst ? '0' : '1';
      if (g.results!.winners.length === 1 && g.results!.winners[0] === lordId) lordWins++;
    }
    expect(lordWins / games).toBeGreaterThan(0.6);
  });
});
