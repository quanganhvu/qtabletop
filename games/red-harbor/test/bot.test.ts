import { describe, expect, it } from 'vitest';
import { chooseBotAction } from '../src/shared/bot';
import { applyAction, createGame, type GameState } from '../src/shared/game';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

/** The player who must move next: the current player, or someone still feeding. */
const mover = (g: GameState) => (g.phase === 'feed' ? Object.keys(g.feeding)[0] : g.players[g.current].id);

function playBotGame(n: number, seed: number, noise = 0.15): GameState {
  const rng = seeded(seed);
  const g = createGame(Array.from({ length: n }, (_, i) => ({ id: `bot${i}`, name: `Bot ${i}` })), rng);
  for (let step = 0; step < 20000 && g.phase !== 'over'; step++) {
    const id = mover(g);
    applyAction(g, id, chooseBotAction(g, id, rng, noise)); // throws if the bot ever picks an illegal move
  }
  return g;
}

describe('bot', () => {
  it.each([2, 3, 4, 5])('plays %i-bot games to completion with only legal moves', (n) => {
    for (let seed = 1; seed <= 3; seed++) {
      const g = playBotGame(n, seed);
      expect(g.phase).toBe('over');
      // Sanity check that bots build an economy rather than drowning in loans.
      const best = g.results!.ranking[0];
      expect(best.total).toBeGreaterThan(40);
    }
  }, 120_000);

  it('feeds its workers when the round ends', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(2));
    while (g.phase === 'turn') applyAction(g, g.players[g.current].id, { type: 'endTurn' });
    expect(chooseBotAction(g, 'a').type).toBe('feed');
  });
});
