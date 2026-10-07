import { describe, expect, it } from 'vitest';
import { chooseBotAction } from '../src/shared/bot';
import { applyAction, createGame, emptyGems, type GameState } from '../src/shared/game';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

function playBotGame(n: number, seed: number): GameState {
  const rng = seeded(seed);
  const g = createGame(Array.from({ length: n }, (_, i) => ({ id: `bot${i}`, name: `Bot ${i}` })), rng);
  for (let step = 0; step < 2000 && g.phase !== 'over'; step++) {
    const id = g.players[g.current].id;
    applyAction(g, id, chooseBotAction(g, id, rng)); // throws if the bot ever picks an illegal move
  }
  return g;
}

describe('bot', () => {
  it.each([2, 3, 4])('plays %i-bot games to completion with only legal moves', (n) => {
    const turns: number[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const g = playBotGame(n, seed);
      expect(g.phase).toBe('over');
      expect(g.results!.ranking[0].points).toBeGreaterThanOrEqual(15);
      turns.push(Math.ceil(g.turn / n));
    }
    // Sanity check that bots play sensibly: real games take roughly 20-35 rounds.
    const avgRounds = turns.reduce((a, b) => a + b, 0) / turns.length;
    expect(avgRounds).toBeLessThan(45);
  });

  it('buys an affordable point card over taking gems', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(1));
    g.board[2][0] = { id: 'prize', level: 2, color: 'red', points: 3, cost: { ...emptyGems(), red: 2 } };
    g.players[0].tokens.red = 2;
    expect(chooseBotAction(g, 'a')).toEqual({ type: 'buy', cardId: 'prize' });
  });

  it('returns exactly the excess gems, keeping gold', () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(1));
    g.players[0].tokens = { white: 3, blue: 3, green: 3, red: 2, black: 0, gold: 1 };
    g.phase = 'discard';
    const action = chooseBotAction(g, 'a');
    expect(action.type).toBe('discard');
    const tokens = (action as { tokens: Record<string, number> }).tokens;
    expect(Object.values(tokens).reduce((a, b) => a + b, 0)).toBe(2);
    expect(tokens.gold).toBe(0);
  });
});

describe('bot and gold crowns', () => {
  const base = () => {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(3));
    for (const l of [1, 2, 3] as const) g.board[l] = g.board[l].map(() => null);
    return g;
  };

  it('spends gold to buy a card it could not afford otherwise', () => {
    const g = base();
    g.board[2][0] = { id: 'prize', level: 2, color: 'red', points: 2, cost: { ...emptyGems(), red: 3 } };
    g.players[0].tokens = { ...g.players[0].tokens, red: 2, gold: 1 };
    expect(chooseBotAction(g, 'a')).toEqual({ type: 'buy', cardId: 'prize' });
  });

  it('reserves for a crown when gold is the only way to finish its card', () => {
    const g = base();
    g.board[2][0] = { id: 'prize', level: 2, color: 'red', points: 3, cost: { ...emptyGems(), red: 3 } };
    g.players[0].tokens = { ...g.players[0].tokens, red: 2 };
    g.bank.red = 0;
    expect(chooseBotAction(g, 'a')).toEqual({ type: 'reserve', cardId: 'prize' });
  });

  it("reserves a valuable card an opponent is about to buy", () => {
    const g = base();
    g.board[3][0] = { id: 'big', level: 3, color: 'black', points: 4, cost: { ...emptyGems(), black: 7 } };
    g.players[1].tokens = { ...g.players[1].tokens, black: 7 };
    expect(chooseBotAction(g, 'a')).toEqual({ type: 'reserve', cardId: 'big' });
  });
});
