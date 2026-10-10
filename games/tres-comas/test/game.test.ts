import { describe, expect, it } from 'vitest';
import {
  CHAINS, COLS, HAND_SIZE, SHARES_PER_CHAIN, START_CASH, TILE_COUNT, applyAction, bonusesFor, canDeclareEnd, chainSizes,
  createGame, emptyShares, priceFor, tileLabel, tileStatus, viewFor,
  type Cell, type GameState,
} from '../src/shared/game';
import { seeded } from './helpers';

const PLAYERS = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Cat' }];

/** Tile index from a label like "5C". */
const T = (label: string) => (label.charCodeAt(label.length - 1) - 65) * COLS + Number(label.slice(0, -1)) - 1;

/** A game on an empty board where Ann (index 0) is about to play, holding the given tiles. */
function setup(tiles: string[], board: Record<string, Cell> = {}, n = 3): GameState {
  const g = createGame(PLAYERS.slice(0, n), seeded());
  g.players.sort((a, b) => a.id.localeCompare(b.id));
  g.board = Array(TILE_COUNT).fill(null);
  for (const [label, cell] of Object.entries(board)) g.board[T(label)] = cell;
  g.players[0].tiles = tiles.map(T);
  // Keep the bag consistent: no tile can be on the board or in a hand and also still in the bag.
  const used = new Set([...g.players.flatMap((p) => p.tiles), ...g.board.flatMap((c, i) => (c ? [i] : []))]);
  g.bag = g.bag.filter((t) => !used.has(t));
  g.current = 0;
  g.phase = 'place';
  return g;
}

/** Fills a horizontal run of cells, e.g. run('1A', 5, 'astra') → 1A…5A. */
function run(start: string, length: number, cell: Cell): Record<string, Cell> {
  const t = T(start);
  return Object.fromEntries(Array.from({ length }, (_, i) => [tileLabel(t + i), cell]));
}

describe('setup', () => {
  it('deals tiles, cash and opening tiles, closest to 1A first', () => {
    const g = createGame(PLAYERS, seeded());
    expect(g.players).toHaveLength(3);
    for (const p of g.players) {
      expect(p.cash).toBe(START_CASH);
      expect(p.tiles).toHaveLength(HAND_SIZE);
    }
    expect(g.board.filter((c) => c === 'loose')).toHaveLength(3);
    expect(g.bag).toHaveLength(TILE_COUNT - 3 - 3 * HAND_SIZE);
    for (const c of CHAINS) expect(g.bank[c]).toBe(SHARES_PER_CHAIN);
    expect(g.phase).toBe('place');
  });

  it('rejects too few or too many players', () => {
    expect(() => createGame([PLAYERS[0]])).toThrow();
    expect(() => createGame(Array.from({ length: 7 }, (_, i) => ({ id: `${i}`, name: `${i}` })))).toThrow();
  });

  it('labels tiles like the board', () => {
    expect(tileLabel(0)).toBe('1A');
    expect(tileLabel(11)).toBe('12A');
    expect(tileLabel(107)).toBe('12I');
    expect(T('7D')).toBe(3 * COLS + 6);
  });
});

describe('prices and bonuses', () => {
  it('follows the price chart', () => {
    expect(priceFor('astra', 2)).toBe(200);
    expect(priceFor('astra', 5)).toBe(500);
    expect(priceFor('astra', 10)).toBe(600);
    expect(priceFor('astra', 11)).toBe(700);
    expect(priceFor('astra', 20)).toBe(700);
    expect(priceFor('astra', 21)).toBe(800);
    expect(priceFor('astra', 40)).toBe(900);
    expect(priceFor('astra', 41)).toBe(1000);
    expect(priceFor('coral', 2)).toBe(300);
    expect(priceFor('grand', 41)).toBe(1200);
  });

  const holders = (...counts: number[]) => counts.map((n, i) => ({ id: `p${i}`, shares: { ...emptyShares(), astra: n } }));

  it('pays majority and minority', () => {
    expect(bonusesFor(holders(5, 3, 1), 'astra', 300)).toEqual([{ id: 'p0', amount: 3000 }, { id: 'p1', amount: 1500 }]);
  });
  it('gives a sole holder both bonuses', () => {
    expect(bonusesFor(holders(2, 0), 'astra', 300)).toEqual([{ id: 'p0', amount: 4500 }]);
  });
  it('splits a tie for first, rounded up to $100', () => {
    expect(bonusesFor(holders(4, 4, 4), 'astra', 300)).toEqual(['p0', 'p1', 'p2'].map((id) => ({ id, amount: 1500 })));
    expect(bonusesFor(holders(4, 4, 1), 'astra', 700)).toEqual([{ id: 'p0', amount: 5300 }, { id: 'p1', amount: 5300 }]);
  });
  it('splits a tie for second', () => {
    expect(bonusesFor(holders(5, 2, 2), 'astra', 300)).toEqual([
      { id: 'p0', amount: 3000 }, { id: 'p1', amount: 800 }, { id: 'p2', amount: 800 },
    ]);
  });
});

describe('placing tiles', () => {
  it('a lone tile just sits on the board', () => {
    const g = setup(['5E']);
    applyAction(g, 'a', { type: 'place', tile: T('5E') });
    expect(g.board[T('5E')]).toBe('loose');
    expect(g.current).toBe(1); // nothing to buy, so the turn ends
    expect(g.players[0].tiles).toHaveLength(HAND_SIZE);
  });

  it('rejects tiles you do not hold and moves out of turn', () => {
    const g = setup(['5E']);
    expect(() => applyAction(g, 'a', { type: 'place', tile: T('6E') })).toThrow(/don't have/);
    expect(() => applyAction(g, 'b', { type: 'place', tile: T('5E') })).toThrow(/Not your turn/);
  });

  it('founds a chain and pays a free share', () => {
    const g = setup(['5E'], { '6E': 'loose', '7E': 'loose' });
    applyAction(g, 'a', { type: 'place', tile: T('5E') });
    expect(g.phase).toBe('found');
    expect(g.pending!.options).toEqual([...CHAINS]);
    applyAction(g, 'a', { type: 'found', chain: 'coral' });
    expect(chainSizes(g.board).coral).toBe(3);
    expect(g.players[0].shares.coral).toBe(1);
    expect(g.bank.coral).toBe(SHARES_PER_CHAIN - 1);
    expect(g.phase).toBe('buy');
  });

  it('grows a chain and picks up connected loose tiles', () => {
    const g = setup(['5E'], { ...run('2E', 3, 'astra'), '6E': 'loose', '6F': 'loose' });
    applyAction(g, 'a', { type: 'place', tile: T('5E') });
    expect(chainSizes(g.board).astra).toBe(6);
  });

  it('cannot found an eighth chain', () => {
    // Seven 2-tile chains spaced out along rows A and C.
    const board: Record<string, Cell> = { '1I': 'loose' };
    CHAINS.forEach((c, i) => Object.assign(board, run(`${(i % 4) * 3 + 1}${i < 4 ? 'A' : 'C'}`, 2, c)));
    const g = setup(['2I', '12I'], board);
    expect(tileStatus(g.board, T('2I'))).toBe('blocked');
    expect(() => applyAction(g, 'a', { type: 'place', tile: T('2I') })).toThrow(/seven startups/);
  });

  it('a tile joining two safe chains is dead and gets replaced', () => {
    const g = setup(['11B', '5E'], { ...run('1A', 11, 'astra'), ...run('1C', 11, 'bayside') });
    expect(tileStatus(g.board, T('11B'))).toBe('dead');
    expect(() => applyAction(g, 'a', { type: 'place', tile: T('11B') })).toThrow(/too big to buy/);
    applyAction(g, 'a', { type: 'place', tile: T('5E') });
    applyAction(g, 'a', { type: 'buy', shares: {} });
    expect(g.players[0].tiles).not.toContain(T('11B'));
    expect(g.players[0].tiles).toHaveLength(HAND_SIZE);
  });
});

describe('mergers', () => {
  /** Astra (3 tiles, 1A–3A) meets Bayside (5 tiles, 5A–9A) when 4A is played. */
  function mergeGame() {
    const g = setup(['4A'], { ...run('1A', 3, 'astra'), ...run('5A', 5, 'bayside') });
    const [ann, bob, cat] = g.players;
    ann.shares.astra = 2;
    bob.shares.astra = 4;
    cat.shares.astra = 1;
    g.bank.astra -= 7;
    return g;
  }

  it('the larger chain survives; bonuses are paid; holders decide in turn from the mergemaker', () => {
    const g = mergeGame();
    applyAction(g, 'a', { type: 'place', tile: T('4A') });
    expect(g.phase).toBe('merge');
    // Astra was 3 tiles: $300. Bob majority $3000, Ann minority $1500.
    expect(g.players[1].cash).toBe(START_CASH + 3000);
    expect(g.players[0].cash).toBe(START_CASH + 1500);
    expect(g.merger!.decider).toBe(0);

    applyAction(g, 'a', { type: 'dispose', sell: 2, trade: 0 });
    expect(g.players[0].cash).toBe(START_CASH + 1500 + 600);
    expect(g.merger!.decider).toBe(1);
    expect(() => applyAction(g, 'c', { type: 'dispose', sell: 1, trade: 0 })).toThrow(/Waiting for Bob/);
    expect(() => applyAction(g, 'b', { type: 'dispose', sell: 0, trade: 3 })).toThrow(/2 for 1/);
    applyAction(g, 'b', { type: 'dispose', sell: 0, trade: 4 });
    expect(g.players[1].shares.bayside).toBe(2);
    applyAction(g, 'c', { type: 'dispose', sell: 0, trade: 0 }); // keeps 1

    expect(g.phase).toBe('buy');
    expect(g.current).toBe(0);
    const sizes = chainSizes(g.board);
    expect(sizes.astra).toBe(0);
    expect(sizes.bayside).toBe(9);
    expect(g.players[2].shares.astra).toBe(1);
    expect(g.bank.astra).toBe(SHARES_PER_CHAIN - 1);
  });

  it('the mergemaker picks the survivor when the chains are tied', () => {
    const g = setup(['4A'], { ...run('1A', 3, 'astra'), ...run('5A', 3, 'bayside') });
    applyAction(g, 'a', { type: 'place', tile: T('4A') });
    expect(g.phase).toBe('survivor');
    expect(g.pending!.options.sort()).toEqual(['astra', 'bayside']);
    applyAction(g, 'a', { type: 'survivor', chain: 'astra' });
    // Nobody holds bayside shares, so the merger completes at once.
    expect(chainSizes(g.board).astra).toBe(7);
    expect(chainSizes(g.board).bayside).toBe(0);
  });

  it('settles several defunct chains, largest first', () => {
    // 5E joins grand (6 tiles, row F), coral (3, row D) and astra (2, left of 5E).
    const g = setup(['5E'], { ...run('3E', 2, 'astra'), ...run('5F', 6, 'grand'), ...run('5D', 3, 'coral') });
    g.players[1].shares.astra = 1;
    g.players[2].shares.coral = 1;
    applyAction(g, 'a', { type: 'place', tile: T('5E') });
    expect(g.merger!.defuncts).toEqual(['coral', 'astra']);
    expect(g.merger!.decider).toBe(2);
    applyAction(g, 'c', { type: 'dispose', sell: 1, trade: 0 });
    expect(g.merger!.defuncts).toEqual(['astra']);
    applyAction(g, 'b', { type: 'dispose', sell: 1, trade: 0 });
    expect(chainSizes(g.board).grand).toBe(12);
  });

  it('limits trades to the survivor shares left in the bank', () => {
    const g = mergeGame();
    g.bank.bayside = 1;
    applyAction(g, 'a', { type: 'place', tile: T('4A') });
    applyAction(g, 'a', { type: 'dispose', sell: 2, trade: 0 });
    expect(() => applyAction(g, 'b', { type: 'dispose', sell: 0, trade: 4 })).toThrow(/Only 1/);
  });
});

describe('buying and ending', () => {
  it('buys up to 3 shares of chains on the board', () => {
    const g = setup(['9I'], run('1A', 3, 'astra'));
    applyAction(g, 'a', { type: 'place', tile: T('9I') });
    expect(g.phase).toBe('buy');
    expect(() => applyAction(g, 'a', { type: 'buy', shares: { bayside: 1 } })).toThrow(/not on the board/);
    expect(() => applyAction(g, 'a', { type: 'buy', shares: { astra: 4 } })).toThrow(/at most 3/);
    applyAction(g, 'a', { type: 'buy', shares: { astra: 3 } });
    expect(g.players[0].shares.astra).toBe(3);
    expect(g.players[0].cash).toBe(START_CASH - 900);
    expect(g.current).toBe(1);
  });

  it("can't overspend", () => {
    const g = setup(['9I'], run('1A', 3, 'astra'));
    g.players[0].cash = 500;
    applyAction(g, 'a', { type: 'place', tile: T('9I') });
    expect(() => applyAction(g, 'a', { type: 'buy', shares: { astra: 2 } })).toThrow(/afford/);
  });

  it('can be declared over once every chain is safe, paying bonuses and selling shares', () => {
    const g = setup(['9I'], { ...run('1A', 11, 'astra') });
    expect(canDeclareEnd(g.board)).toBe(true);
    g.players[0].shares.astra = 3;
    g.players[1].shares.astra = 1;
    applyAction(g, 'a', { type: 'place', tile: T('9I') });
    applyAction(g, 'a', { type: 'buy', shares: {}, end: true });
    expect(g.phase).toBe('over');
    // Astra at 11 tiles: $700. Ann: $7000 majority + 3 × $700.
    expect(g.players[0].cash).toBe(START_CASH + 7000 + 2100);
    expect(g.players[1].cash).toBe(START_CASH + 3500 + 700);
    expect(g.results!.winners).toEqual(['a']);
  });

  it("can't be declared over early", () => {
    const g = setup(['9I'], run('1A', 5, 'astra'));
    applyAction(g, 'a', { type: 'place', tile: T('9I') });
    expect(() => applyAction(g, 'a', { type: 'buy', shares: {}, end: true })).toThrow(/can't end/);
  });
});

describe('views', () => {
  it('hides other hands and the bag', () => {
    const g = createGame(PLAYERS, seeded());
    const v = viewFor(g, g.players[0].id);
    expect(v.players[0].tiles).toEqual(g.players[0].tiles);
    expect(v.players[1].tiles).toBeNull();
    expect(v.players[1].tileCount).toBe(HAND_SIZE);
    expect('bag' in v).toBe(false);
    expect(v.bagCount).toBe(g.bag.length);
  });
});

