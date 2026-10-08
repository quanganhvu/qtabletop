import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, chooseLeveledAction, type BotLevel } from '../src/shared/botLevels';
import { applyAction, createGame, MEEPLES, type GameState } from '../src/shared/game';

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
  for (let step = 0; step < 200 && g.phase !== 'over'; step++) {
    const id = g.players[g.current].id;
    applyAction(g, id, chooseLeveledAction(levels[Number(id)], g, id, rng));
  }
  return g;
}

describe('bots', () => {
  it.each(BOT_LEVELS)('%s bots play games to the end with only legal moves', { timeout: 120_000 }, (level) => {
    for (let seed = 1; seed <= 3; seed++) {
      const g = play(Array(2 + (seed % 4)).fill(level), seed);
      expect(g.phase).toBe('over');
      expect(Object.keys(g.board).length).toBeGreaterThan(60);
      for (const p of g.players) {
        expect(p.meeples).toBeGreaterThanOrEqual(0);
        expect(p.meeples).toBeLessThanOrEqual(MEEPLES);
      }
    }
  });

  it('a Lord (hard) beats a Squire (easy) most of the time', { timeout: 120_000 }, () => {
    let lordWins = 0;
    const games = 16;
    for (let s = 0; s < games; s++) {
      const lordFirst = s % 2 === 0;
      const g = play(lordFirst ? ['hard', 'easy'] : ['easy', 'hard'], 5000 + s);
      const lordId = lordFirst ? '0' : '1';
      if (g.results!.winners.length === 1 && g.results!.winners[0] === lordId) lordWins++;
    }
    expect(lordWins / games).toBeGreaterThan(0.6);
  });
});
