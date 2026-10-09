import { describe, expect, it } from 'vitest';
import {
  COLORS, applyAction, canPlace, completeColors, completeColumns, completeRows, createGame, floorPenalty, legalMoves,
  placementPoints, wallColor, wallColumn, type GameState,
} from '../src/shared/game';
import { chooseLeveledAction, type BotLevel } from '../src/shared/botLevels';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const emptyWall = () => Array.from({ length: 5 }, () => Array<boolean>(5).fill(false));
const totalTiles = (g: GameState) =>
  g.bag.length + g.lid.length + g.center.length + g.kilns.flat().length
  + g.players.reduce((a, p) => a + p.lines.reduce((b, l) => b + l.count, 0) + p.floor.filter((f) => f !== 'first').length
    + p.wall.flat().filter(Boolean).length, 0);

describe('setup', () => {
  it('fills 2n+1 kilns with four tiles each', () => {
    for (const n of [2, 3, 4]) {
      const g = createGame(players(n), seeded(n));
      expect(g.kilns).toHaveLength(2 * n + 1);
      expect(g.kilns.every((k) => k.length === 4)).toBe(true);
      expect(totalTiles(g)).toBe(100);
    }
  });
});

describe('the wall', () => {
  it('shifts each row one step right, so every color appears once per row and column', () => {
    for (let r = 0; r < 5; r++) {
      expect(new Set(Array.from({ length: 5 }, (_, c) => wallColor(r, c))).size).toBe(5);
      for (const color of COLORS) expect(wallColor(r, wallColumn(r, color))).toBe(color);
    }
    for (let c = 0; c < 5; c++) expect(new Set(Array.from({ length: 5 }, (_, r) => wallColor(r, c))).size).toBe(5);
  });

  it('scores a lone tile 1, and counts the lines a tile joins', () => {
    const wall = emptyWall();
    wall[2][2] = true;
    expect(placementPoints(wall, 2, 2)).toBe(1);
    wall[2][1] = true;
    wall[2][3] = true;
    expect(placementPoints(wall, 2, 2)).toBe(3);
    wall[1][2] = true;
    expect(placementPoints(wall, 2, 2)).toBe(3 + 2);
  });

  it('counts finished rows, columns and colors', () => {
    const wall = emptyWall();
    for (let c = 0; c < 5; c++) wall[0][c] = true;
    for (let r = 0; r < 5; r++) wall[r][0] = true;
    expect(completeRows(wall)).toBe(1);
    expect(completeColumns(wall)).toBe(1);
    for (let r = 0; r < 5; r++) wall[r][wallColumn(r, 'red')] = true;
    expect(completeColors(wall)).toBe(1);
  });

  it('charges the floor 1, 1, 2, 2, 2, 3, 3', () => {
    expect([0, 1, 2, 3, 7, 9].map(floorPenalty)).toEqual([0, 1, 2, 4, 14, 14]);
  });
});

describe('turns', () => {
  it('takes every tile of a color from a kiln, sends the rest to the center, and overflows to the floor', () => {
    const g = createGame(players(2), seeded(7));
    g.kilns[0] = ['red', 'red', 'red', 'blue'];
    applyAction(g, 'p0', { type: 'take', source: 0, color: 'red', target: 1 });
    const p = g.players[0];
    expect(p.lines[1]).toEqual({ color: 'red', count: 2 });
    expect(p.floor).toEqual(['red']);
    expect(g.kilns[0]).toEqual([]);
    expect(g.center).toEqual(['blue']);
    expect(g.current).toBe(1);
  });

  it('gives the first taker from the center the first-player token, on their floor', () => {
    const g = createGame(players(2), seeded(8));
    g.kilns[0] = ['red', 'red', 'blue', 'blue'];
    applyAction(g, 'p0', { type: 'take', source: 0, color: 'red', target: 4 });
    applyAction(g, 'p1', { type: 'take', source: 'center', color: 'blue', target: 4 });
    expect(g.players[1].floor).toEqual(['first']);
    expect(g.firstInCenter).toBe(false);
    expect(g.starter).toBe(1);
  });

  it('refuses a row of another color, or a color already in that wall row', () => {
    const g = createGame(players(2), seeded(9));
    g.kilns[0] = ['red', 'red', 'blue', 'blue'];
    const p = g.players[0];
    p.lines[2] = { color: 'blue', count: 1 };
    expect(canPlace(p, 2, 'red')).toBe(false);
    p.wall[3][wallColumn(3, 'red')] = true;
    expect(canPlace(p, 3, 'red')).toBe(false);
    expect(() => applyAction(g, 'p0', { type: 'take', source: 0, color: 'red', target: 3 })).toThrow();
    expect(() => applyAction(g, 'p1', { type: 'take', source: 0, color: 'red', target: 0 })).toThrow(/not your turn/);
  });

  it('sets full rows at the end of the round and starts the next with the token holder', () => {
    const g = createGame(players(2), seeded(10));
    g.bag.push(...g.kilns.flat());
    g.bag.splice(g.bag.indexOf('red'), 1);
    for (let i = 0; i < 3; i++) g.bag.splice(g.bag.indexOf('blue'), 1);
    g.kilns = [['red', 'blue', 'blue', 'blue'], [], [], [], []];
    g.center = [];
    applyAction(g, 'p0', { type: 'take', source: 0, color: 'red', target: 0 });
    applyAction(g, 'p1', { type: 'take', source: 'center', color: 'blue', target: 2 });
    expect(g.round).toBe(2);
    expect(g.players[0].wall[0][wallColumn(0, 'red')]).toBe(true);
    expect(g.players[0].score).toBe(1);
    expect(g.players[1].wall[2][wallColumn(2, 'blue')]).toBe(true);
    expect(g.players[1].score).toBe(0); // 1 point, minus 1 for the token
    expect(g.current).toBe(1);
    expect(g.kilns.every((k) => k.length === 4)).toBe(true);
    expect(totalTiles(g)).toBe(100);
  });
});

describe('whole games', () => {
  const levels: BotLevel[] = ['easy', 'normal', 'hard'];
  it('bots of every level finish 2–4 player games with legal moves, keeping all 100 tiles', () => {
    for (const n of [2, 3, 4]) {
      const rng = seeded(100 + n);
      const g = createGame(players(n), rng);
      for (let turn = 0; g.phase !== 'over'; turn++) {
        expect(turn).toBeLessThan(1000);
        const id = g.players[g.current].id;
        const action = chooseLeveledAction(levels[(g.current + n) % 3], g, id, rng);
        expect(legalMoves(g)).toContainEqual(action);
        applyAction(g, id, action, rng);
        expect(totalTiles(g)).toBe(100);
      }
      expect(g.results!.ranking).toHaveLength(n);
      expect(g.players.some((p) => completeRows(p.wall) > 0)).toBe(true);
    }
  });

  it('a Master beats an Apprentice most of the time', () => {
    let wins = 0;
    const games = 30;
    for (let i = 0; i < games; i++) {
      const rng = seeded(500 + i);
      const g = createGame(players(2), rng);
      const levelOf = (p: number): BotLevel => ((p + i) % 2 === 0 ? 'hard' : 'easy');
      while (g.phase !== 'over') {
        const id = g.players[g.current].id;
        applyAction(g, id, chooseLeveledAction(levelOf(g.current), g, id, rng), rng);
      }
      const hard = g.players.findIndex((_, p) => levelOf(p) === 'hard');
      if (g.results!.winners.includes(g.players[hard].id)) wins++;
    }
    expect(wins / games).toBeGreaterThan(0.6);
  });
});
