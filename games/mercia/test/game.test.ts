import { describe, expect, it } from 'vitest';
import {
  MEEPLES, allFeatures, applyAction, createGame, farmPoints, fits, key, legalSpots, meepleOptions, viewFor,
  type Board, type GameState,
} from '../src/shared/game';
import { FIELD_CITIES, TILES, TILE_COUNT, TILE_DEFS, facingPort, rotatePoint } from '../src/shared/tiles';

function seeded(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const PLAYERS = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }];

/** A game with a chosen tile in hand (and the deck rigged so turns can continue). */
function gameWith(board: Board, tile: string, deck: string[] = ['B', 'B', 'B']): GameState {
  const g = createGame(PLAYERS, seeded());
  g.board = board;
  g.tile = tile;
  g.deck = deck;
  return g;
}

const fi = (tile: string, kind: string, nth = 0) => TILES[tile].features.map((f, i) => [f, i] as const).filter(([f]) => f.kind === kind)[nth][1];

describe('tiles', () => {
  it('has the 72 tiles of the base game', () => {
    expect(TILE_COUNT).toBe(72);
    expect(TILE_DEFS).toHaveLength(24);
  });

  it('every port belongs to exactly one feature, and each edge is one kind', () => {
    for (const t of TILE_DEFS) {
      const ports = t.features.flatMap((f) => f.ports).sort((a, b) => a - b);
      expect(ports, t.id).toEqual([...Array(12).keys()]);
      for (let side = 0; side < 4; side++) {
        const kinds = [0, 1, 2].map((k) => t.features.find((f) => f.ports.includes(side * 3 + k))!.kind);
        // City edges are city throughout; a road edge has meadow either side of the road.
        if (kinds[1] === 'city') expect(kinds, t.id).toEqual(['city', 'city', 'city']);
        if (kinds[1] === 'road') expect(kinds, t.id).toEqual(['field', 'road', 'field']);
        if (kinds[1] === 'field') expect(kinds, t.id).toEqual(['field', 'field', 'field']);
      }
    }
  });

  it('ports face their mirror on the neighboring tile', () => {
    expect(facingPort(0)).toBe(8); // north-west faces the neighbor's south-west
    expect(facingPort(4)).toBe(10);
    for (let p = 0; p < 12; p++) expect(facingPort(facingPort(p))).toBe(p);
  });

  it('meadows know which cities they border', () => {
    expect(FIELD_CITIES.D[fi('D', 'field', 0)]).toEqual([0]); // the meadow between wall and road
    expect(FIELD_CITIES.D[fi('D', 'field', 1)]).toEqual([]); // the meadow beyond the road
    expect(FIELD_CITIES.H[fi('H', 'field')].sort()).toEqual([0, 1]);
  });

  it('rotates follower spots with the tile', () => {
    expect(rotatePoint([50, 12], 1)).toEqual([88, 50]);
    expect(rotatePoint([50, 12], 2)).toEqual([50, 88]);
    expect(rotatePoint([50, 12], 4)).toEqual([50, 12]);
  });
});

describe('setup', () => {
  it.each([2, 3, 4, 5])('%i players: start tile placed, 71 tiles to draw, one in hand', (n) => {
    const g = createGame(Array.from({ length: n }, (_, i) => ({ id: String(i), name: `P${i}` })), seeded());
    expect(Object.keys(g.board)).toEqual([key(0, 0)]);
    expect(g.deck.length + 1).toBe(71);
    expect(g.tile).toBeTruthy();
    for (const p of g.players) expect(p.meeples).toBe(MEEPLES);
  });

  it('hides the deck from players', () => {
    const v = viewFor(createGame(PLAYERS, seeded()), 'a');
    expect(v).not.toHaveProperty('deck');
    expect(v.deckCount).toBe(70);
  });
});

describe('placement', () => {
  const start: Board = { [key(0, 0)]: { t: 'D', r: 0 } };

  it('edges must match their neighbors', () => {
    // Start tile: city to the north, road east-west, meadow to the south.
    expect(fits(start, 'U', 1, 0, 1)).toBe(true); // a road turned east-west continues the road
    expect(fits(start, 'U', 1, 0, 0)).toBe(false); // north-south road would meet the road with meadow
    expect(fits(start, 'E', 0, -1, 2)).toBe(true); // a city wall facing south closes the city
    expect(fits(start, 'E', 0, -1, 0)).toBe(false);
    expect(fits(start, 'B', 0, 1, 0)).toBe(true);
    expect(fits(start, 'B', 5, 5, 0)).toBe(false); // must touch the land
    expect(fits(start, 'B', 0, 0, 0)).toBe(false); // occupied
  });

  it('lists every spot a tile may go', () => {
    const spots = legalSpots(start, 'B');
    expect(spots).toEqual([{ x: 0, y: 1, rots: [0, 1, 2, 3] }]);
  });

  it('rejects illegal moves and moves out of turn', () => {
    const g = gameWith(start, 'U');
    expect(() => applyAction(g, 'b', { type: 'place', x: 1, y: 0, rot: 1, meeple: null })).toThrow(/turn/);
    expect(() => applyAction(g, 'a', { type: 'place', x: 1, y: 0, rot: 0, meeple: null })).toThrow(/fit/);
    expect(() => applyAction(g, 'a', { type: 'place', x: 1, y: 0, rot: 1, meeple: 9 })).toThrow();
  });

  it('a follower may not join a feature someone already holds', () => {
    const board: Board = { [key(0, 0)]: { t: 'D', r: 0, m: { p: 1, f: fi('D', 'road') } } };
    const opts = meepleOptions(board, 'U', 1, 0, 1);
    expect(opts).not.toContain(fi('U', 'road'));
    expect(opts).toContain(fi('U', 'field', 0));
  });
});

describe('scoring', () => {
  it('a finished city scores 2 per tile and returns the knight', () => {
    const g = gameWith({ [key(0, 0)]: { t: 'D', r: 0, m: { p: 0, f: fi('D', 'city') } } }, 'E');
    g.players[0].meeples = MEEPLES - 1;
    applyAction(g, 'a', { type: 'place', x: 0, y: -1, rot: 2, meeple: null });
    expect(g.players[0].score).toBe(4);
    expect(g.players[0].breakdown.city).toBe(4);
    expect(g.players[0].meeples).toBe(MEEPLES);
    expect(g.board[key(0, 0)].m).toBeUndefined();
    expect(g.events.some((e) => e.kind === 'score' && e.points === 4)).toBe(true);
  });

  it('pennants add 2 each to a finished city', () => {
    // A pennant gateway (F) between two walls facing it: 3 tiles + 1 pennant.
    const g = gameWith({ [key(0, 0)]: { t: 'F', r: 0, m: { p: 1, f: 0 } }, [key(-1, 0)]: { t: 'E', r: 1 } }, 'E');
    g.current = 1;
    applyAction(g, 'b', { type: 'place', x: 1, y: 0, rot: 3, meeple: null });
    expect(g.players[1].score).toBe(8);
  });

  it('a road scores 1 per tile when both ends are closed', () => {
    // Start tile road runs east-west; close it with two crossroads.
    const g = gameWith({ [key(0, 0)]: { t: 'D', r: 0 }, [key(-1, 0)]: { t: 'X', r: 0 } }, 'X');
    g.board[key(0, 0)].m = { p: 0, f: fi('D', 'road') };
    applyAction(g, 'a', { type: 'place', x: 1, y: 0, rot: 0, meeple: null });
    expect(g.players[0].score).toBe(3);
    expect(g.players[0].breakdown.road).toBe(3);
  });

  it('ties both score in full; a larger majority takes it all', () => {
    const board: Board = {
      [key(0, 0)]: { t: 'U', r: 1, m: { p: 0, f: 0 } },
      [key(1, 0)]: { t: 'U', r: 1, m: { p: 1, f: 0 } },
      [key(-1, 0)]: { t: 'X', r: 0 },
    };
    const g = gameWith(board, 'X');
    applyAction(g, 'a', { type: 'place', x: 2, y: 0, rot: 0, meeple: null });
    expect(g.players.map((p) => p.score)).toEqual([4, 4]);
  });

  it('a surrounded abbey scores 9', () => {
    const board: Board = { [key(0, 0)]: { t: 'B', r: 0, m: { p: 0, f: 0 } } };
    for (const [x, y] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]]) board[key(x, y)] = { t: 'B', r: 0 };
    const g = gameWith(board, 'B');
    applyAction(g, 'a', { type: 'place', x: 1, y: 1, rot: 0, meeple: null });
    expect(g.players[0].score).toBe(9);
    expect(g.players[0].breakdown.cloister).toBe(9);
  });

  it('end of game: unfinished features score at half value, farms 3 per finished city', () => {
    // A closed 2-tile city (start tile + wall), a farmer in the meadow beside it, an unfinished city with a knight.
    const board: Board = {
      [key(0, 0)]: { t: 'D', r: 0, m: { p: 0, f: fi('D', 'field', 0) } },
      [key(0, -1)]: { t: 'E', r: 2 },
      [key(1, -1)]: { t: 'E', r: 0, m: { p: 1, f: 0 } },
    };
    const { features, of } = allFeatures(board);
    const farm = features[of.get(`0,0,${fi('D', 'field', 0)}`)!];
    expect(farmPoints(board, farm, features, of)).toBe(3);

    const g = gameWith(board, 'B', []);
    applyAction(g, 'a', { type: 'place', x: 0, y: 1, rot: 0, meeple: null });
    expect(g.phase).toBe('over');
    expect(g.players[0].breakdown.field).toBe(3);
    expect(g.players[1].breakdown.city).toBe(1);
    expect(g.results!.winners).toEqual(['a']);
  });

  it('discards a tile that fits nowhere', () => {
    // Surround the land with nothing a full city tile can join.
    const g = gameWith({ [key(0, 0)]: { t: 'B', r: 0 } }, 'B', ['B', 'C']);
    applyAction(g, 'a', { type: 'place', x: 1, y: 0, rot: 0, meeple: null });
    expect(g.tile).toBe('B');
    expect(g.events.some((e) => e.kind === 'discard' && e.tile === 'C')).toBe(true);
  });
});
