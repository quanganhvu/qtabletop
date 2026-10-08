import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, chooseLeveledAction, type BotLevel } from '../src/shared/botLevels';
import { actorIndex, applyAction, createGame, type GameState } from '../src/shared/game';
import { seeded } from './helpers';

function playOut(levels: BotLevel[], seed: number): GameState {
  const rng = seeded(seed);
  const g = createGame(levels.map((_, i) => ({ id: `p${i}`, name: `P${i}` })), rng);
  const levelOf = Object.fromEntries(levels.map((l, i) => [`p${i}`, l]));
  for (let moves = 0; g.phase !== 'over'; moves++) {
    if (moves > 5000) throw new Error('Game did not finish');
    const id = g.players[actorIndex(g)].id;
    applyAction(g, id, chooseLeveledAction(levelOf[id], g, id, rng));
  }
  return g;
}

describe('bots', () => {
  it.each([2, 3, 4, 6])('play legal moves through a whole %i-player game', (n) => {
    for (let seed = 1; seed <= 3; seed++) {
      const g = playOut(Array.from({ length: n }, (_, i) => BOT_LEVELS[i % 3]), seed * 7 + n);
      expect(g.results!.ranking).toHaveLength(n);
      for (const p of g.players) expect(p.cash).toBeGreaterThanOrEqual(0);
    }
  });

  it('a hard bot usually beats an easy one', () => {
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = playOut(seed % 2 ? ['hard', 'easy'] : ['easy', 'hard'], seed);
      const hardId = seed % 2 ? 'p0' : 'p1';
      if (g.results!.winners.includes(hardId)) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(13);
  });
});
