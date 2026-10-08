import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS, ALL_NOBLES, applyAction, COLORS, createGame, emptyGems, points, tokenTotal, viewFor,
  type Card, type GameState,
} from '../src/shared/game';

// Deterministic RNG so tests are reproducible.
function seeded(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const PLAYERS = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }];

function newGame(n = 2): GameState {
  return createGame([...PLAYERS, { id: 'c', name: 'Cat' }, { id: 'd', name: 'Dan' }].slice(0, n), seeded());
}

function card(overrides: Partial<Card>): Card {
  return { id: 'x', level: 1, color: 'white', points: 0, cost: emptyGems(), ...overrides };
}

describe('setup', () => {
  it('uses the full base-game card set', () => {
    expect(ALL_CARDS).toHaveLength(90);
    expect(ALL_CARDS.filter((c) => c.level === 1)).toHaveLength(40);
    expect(ALL_CARDS.filter((c) => c.level === 2)).toHaveLength(30);
    expect(ALL_CARDS.filter((c) => c.level === 3)).toHaveLength(20);
    expect(ALL_NOBLES).toHaveLength(10);
    for (const color of COLORS) expect(ALL_CARDS.filter((c) => c.color === color)).toHaveLength(18);
  });

  it.each([[2, 4], [3, 5], [4, 7]])('%i players get %i gems per color and players+1 nobles', (n, gems) => {
    const g = newGame(n);
    for (const c of COLORS) expect(g.bank[c]).toBe(gems);
    expect(g.bank.gold).toBe(5);
    expect(g.nobles).toHaveLength(n + 1);
    for (const level of [1, 2, 3] as const) expect(g.board[level]).toHaveLength(4);
    expect(g.decks[1]).toHaveLength(36);
  });

  it('rejects too few or too many players', () => {
    expect(() => createGame([PLAYERS[0]])).toThrow();
    expect(() => createGame(Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, name: `${i}` })))).toThrow();
  });
});

describe('taking gems', () => {
  it('takes 3 different gems and passes the turn', () => {
    const g = newGame();
    applyAction(g, 'a', { type: 'take', colors: ['white', 'blue', 'green'] });
    expect(g.players[0].tokens).toMatchObject({ white: 1, blue: 1, green: 1 });
    expect(g.bank.white).toBe(3);
    expect(g.current).toBe(1);
  });

  it('takes 2 of a color only when 4 are available', () => {
    const g = newGame();
    applyAction(g, 'a', { type: 'take', colors: ['red', 'red'] });
    expect(g.players[0].tokens.red).toBe(2);
    expect(() => applyAction(g, 'b', { type: 'take', colors: ['red', 'red'] })).toThrow(/at least 4/);
  });

  it('requires 3 colors when 3 are available, fewer only when the bank is short', () => {
    const g = newGame();
    expect(() => applyAction(g, 'a', { type: 'take', colors: ['red', 'blue'] })).toThrow();
    expect(() => applyAction(g, 'a', { type: 'take', colors: ['red', 'red', 'blue'] })).toThrow();
    g.bank.white = g.bank.blue = g.bank.green = 0;
    applyAction(g, 'a', { type: 'take', colors: ['red', 'black'] });
    expect(g.players[0].tokens).toMatchObject({ red: 1, black: 1 });
  });

  it('never allows taking gold directly or acting out of turn', () => {
    const g = newGame();
    expect(() => applyAction(g, 'a', { type: 'take', colors: ['gold' as never, 'red', 'blue'] })).toThrow();
    expect(() => applyAction(g, 'b', { type: 'take', colors: ['white', 'blue', 'green'] })).toThrow(/not your turn/);
  });
});

describe('reserving', () => {
  it('reserves a board card, refills the slot and grants gold', () => {
    const g = newGame();
    const target = g.board[2][1]!;
    const deckTop = g.decks[2][0];
    applyAction(g, 'a', { type: 'reserve', cardId: target.id });
    expect(g.players[0].reserved).toEqual([target]);
    expect(g.board[2][1]).toBe(deckTop);
    expect(g.players[0].tokens.gold).toBe(1);
    expect(g.bank.gold).toBe(4);
  });

  it('hides blind-reserved cards from other players only', () => {
    const g = newGame();
    applyAction(g, 'a', { type: 'reserveDeck', level: 3 });
    expect(viewFor(g, 'a').players[0].reserved[0]).toHaveProperty('cost');
    expect(viewFor(g, 'b').players[0].reserved[0]).toEqual({ blind: true, level: 3 });
    expect(viewFor(g, null).players[0].reserved[0]).toEqual({ blind: true, level: 3 });
  });

  it('caps reserved cards at 3 and still reserves without gold', () => {
    const g = newGame();
    g.bank.gold = 0;
    for (let i = 0; i < 3; i++) {
      g.current = 0;
      applyAction(g, 'a', { type: 'reserveDeck', level: 1 });
    }
    expect(g.players[0].tokens.gold).toBe(0);
    g.current = 0;
    expect(() => applyAction(g, 'a', { type: 'reserveDeck', level: 1 })).toThrow(/3 reserved/);
  });
});

describe('buying', () => {
  it('pays with bonuses, then gems, then gold', () => {
    const g = newGame();
    const p = g.players[0];
    p.cards = [card({ id: 'b1', color: 'red' })];
    p.tokens = { white: 0, blue: 0, green: 0, red: 1, black: 1, gold: 1 };
    const target = card({ id: 'target', level: 2, color: 'blue', points: 2, cost: { ...emptyGems(), red: 3, black: 1 } });
    g.board[2][0] = target;
    const bankBefore = { ...g.bank };

    applyAction(g, 'a', { type: 'buy', cardId: 'target' });

    expect(p.cards.map((c) => c.id)).toEqual(['b1', 'target']);
    expect(p.tokens).toEqual({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
    expect(g.bank.red).toBe(bankBefore.red + 1);
    expect(g.bank.gold).toBe(bankBefore.gold + 1);
    expect(points(p)).toBe(2);
  });

  it('rejects unaffordable cards and cards that are not available', () => {
    const g = newGame();
    g.board[1][0] = card({ id: 'pricey', cost: { ...emptyGems(), black: 4 } });
    expect(() => applyAction(g, 'a', { type: 'buy', cardId: 'pricey' })).toThrow(/afford/);
    expect(() => applyAction(g, 'a', { type: 'buy', cardId: 'nope' })).toThrow();
  });

  it('buys a blind-reserved card and strips the hidden flag', () => {
    const g = newGame();
    applyAction(g, 'a', { type: 'reserveDeck', level: 1 });
    const reserved = g.players[0].reserved[0];
    g.current = 0;
    g.players[0].tokens = { white: 9, blue: 9, green: 9, red: 9, black: 9, gold: 0 };
    g.phase = 'turn';
    applyAction(g, 'a', { type: 'buy', cardId: reserved.id });
    expect(g.players[0].reserved).toHaveLength(0);
    expect(g.players[0].cards[0]).not.toHaveProperty('blind');
  });
});

describe('gem limit', () => {
  it('forces the player to return gems down to 10 before the turn ends', () => {
    const g = newGame();
    g.players[0].tokens = { white: 3, blue: 3, green: 3, red: 0, black: 0, gold: 0 };
    applyAction(g, 'a', { type: 'take', colors: ['red', 'black', 'white'] });
    expect(g.phase).toBe('discard');
    expect(g.current).toBe(0);
    expect(() => applyAction(g, 'a', { type: 'take', colors: ['red', 'black', 'white'] })).toThrow();
    expect(() => applyAction(g, 'a', { type: 'discard', tokens: { white: 1 } })).toThrow(/exactly 2/);
    applyAction(g, 'a', { type: 'discard', tokens: { white: 2 } });
    expect(tokenTotal(g.players[0].tokens)).toBe(10);
    expect(g.current).toBe(1);
  });
});

describe('nobles', () => {
  function gameWithNobleReady(nobleReqs: Partial<Record<(typeof COLORS)[number], number>>[]) {
    const g = newGame();
    g.nobles = nobleReqs.map((req, i) => ({ id: `n${i}`, points: 3, req: { ...emptyGems(), ...req } }));
    g.players[0].cards = [
      ...Array.from({ length: 4 }, (_, i) => card({ id: `r${i}`, color: 'red' })),
      ...Array.from({ length: 3 }, (_, i) => card({ id: `g${i}`, color: 'green' })),
    ];
    g.board[1][0] = card({ id: 'free-green', color: 'green' });
    return g;
  }

  it('visits automatically when exactly one qualifies', () => {
    const g = gameWithNobleReady([{ red: 4, green: 4 }, { blue: 4 }]);
    applyAction(g, 'a', { type: 'buy', cardId: 'free-green' });
    expect(g.players[0].nobles.map((n) => n.id)).toEqual(['n0']);
    expect(g.nobles.map((n) => n.id)).toEqual(['n1']);
    expect(g.current).toBe(1);
  });

  it('lets the player choose when several qualify', () => {
    const g = gameWithNobleReady([{ red: 4, green: 4 }, { red: 3, green: 3 }]);
    applyAction(g, 'a', { type: 'buy', cardId: 'free-green' });
    expect(g.phase).toBe('noble');
    applyAction(g, 'a', { type: 'noble', nobleId: 'n1' });
    expect(g.players[0].nobles.map((n) => n.id)).toEqual(['n1']);
    expect(g.nobles).toHaveLength(1);
    expect(g.current).toBe(1);
  });
});

describe('end of game', () => {
  it('finishes the round after someone reaches 15, and the tie-break is fewer cards', () => {
    const g = newGame(3);
    const [a, b, c] = g.players;
    a.cards = [card({ id: 'a1', points: 5 }), card({ id: 'a2', points: 5 }), card({ id: 'a3', points: 5 })];
    b.cards = [card({ id: 'b1', points: 5 }), card({ id: 'b2', points: 5 }), card({ id: 'b3', points: 4 })];
    g.board[1][0] = card({ id: 'one', points: 1 });

    applyAction(g, 'a', { type: 'pass' });
    expect(g.finalRound).toBe(true);
    expect(g.phase).toBe('turn');
    applyAction(g, 'b', { type: 'buy', cardId: 'one' }); // Bob ties on points with more cards
    applyAction(g, 'c', { type: 'pass' });

    expect(g.phase).toBe('over');
    expect(g.results!.winners).toEqual(['a']);
    expect(g.results!.ranking.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(c.cards).toHaveLength(0);
    expect(() => applyAction(g, 'a', { type: 'pass' })).toThrow(/over/);
  });

  it('declares a shared win on an exact tie', () => {
    const g = newGame();
    g.players[0].cards = [card({ id: 'a1', points: 15 })];
    g.players[1].cards = [card({ id: 'b1', points: 15 })];
    applyAction(g, 'a', { type: 'pass' });
    applyAction(g, 'b', { type: 'pass' });
    expect(g.results!.winners).toEqual(['a', 'b']);
  });
});

describe('events', () => {
  it('records what each player did, hiding blind reserves from others', () => {
    const g = newGame();
    applyAction(g, 'a', { type: 'take', colors: ['white', 'blue', 'green'] });
    applyAction(g, 'b', { type: 'reserveDeck', level: 2 });
    expect(g.events.map((e) => [e.seq, e.playerId, e.kind])).toEqual([[1, 'a', 'take'], [2, 'b', 'reserve']]);
    expect(viewFor(g, 'b').events[1]).toMatchObject({ kind: 'reserve', fromDeck: true, card: { cost: expect.any(Object) } });
    expect(viewFor(g, 'a').events[1]).toMatchObject({ kind: 'reserve', card: { blind: true, level: 2 } });
  });
});
