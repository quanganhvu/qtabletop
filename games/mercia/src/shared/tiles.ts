// The 72 land tiles of the base game, as plain data shared by the rules engine,
// the bots and the tile art.
//
// Each tile edge is split into three "ports", numbered clockwise from the
// north-west corner:
//
//          0  1  2
//       11 ┌──────┐ 3
//       10 │      │ 4
//        9 └──────┘ 5
//          8  7  6
//
// A city edge uses all three ports; a road edge has the road on the middle
// port and meadow on either side; a meadow edge is meadow on all three. Each
// feature on a tile lists the ports it touches. Rotating a tile a quarter turn
// clockwise moves port p to (p + 3) % 12.

export type FeatureKind = 'city' | 'road' | 'field' | 'cloister';

export interface FeatureDef {
  kind: FeatureKind;
  ports: number[];
  /** A city with a pennant (coat of arms) is worth extra. */
  pennant?: boolean;
  /** Where a follower stands on this feature, in tile units 0..100 (unrotated). */
  at: [number, number];
}

export interface TileDef {
  id: string;
  count: number;
  features: FeatureDef[];
}

const N = [0, 1, 2];
const E = [3, 4, 5];
const S = [6, 7, 8];
const W = [9, 10, 11];

const city = (ports: number[], at: [number, number], pennant = false): FeatureDef => ({ kind: 'city', ports, at, ...(pennant ? { pennant } : {}) });
const road = (ports: number[], at: [number, number]): FeatureDef => ({ kind: 'road', ports, at });
const field = (ports: number[], at: [number, number]): FeatureDef => ({ kind: 'field', ports, at });
const cloister = (at: [number, number] = [50, 46]): FeatureDef => ({ kind: 'cloister', ports: [], at });

/** The start tile (one copy of D) is placed face up before the game begins. */
export const START_TILE = 'D';

export const TILE_DEFS: TileDef[] = [
  { id: 'A', count: 2, features: [cloister(), road([7], [50, 86]), field([0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11], [20, 20])] },
  { id: 'B', count: 4, features: [cloister(), field([...N, ...E, ...S, ...W], [20, 20])] },
  { id: 'C', count: 1, features: [city([...N, ...E, ...S, ...W], [50, 50], true)] },
  { id: 'D', count: 4, features: [city(N, [50, 12]), road([4, 10], [32, 50]), field([3, 11], [78, 35]), field([5, 6, 7, 8, 9], [50, 78])] },
  { id: 'E', count: 5, features: [city(N, [50, 12]), field([...E, ...S, ...W], [50, 64])] },
  { id: 'F', count: 2, features: [city([...E, ...W], [50, 50], true), field(N, [50, 11]), field(S, [50, 89])] },
  { id: 'G', count: 1, features: [city([...N, ...S], [50, 50]), field(E, [89, 50]), field(W, [11, 50])] },
  { id: 'H', count: 3, features: [city(N, [50, 12]), city(S, [50, 88]), field([...E, ...W], [50, 50])] },
  { id: 'I', count: 2, features: [city(N, [50, 12]), city(W, [12, 50]), field([...E, ...S], [64, 64])] },
  { id: 'J', count: 3, features: [city(N, [50, 12]), road([4, 7], [66, 66]), field([5, 6], [87, 87]), field([3, 8, 9, 10, 11], [30, 58])] },
  { id: 'K', count: 3, features: [city(N, [50, 12]), road([10, 7], [34, 66]), field([8, 9], [13, 87]), field([3, 4, 5, 6, 11], [70, 58])] },
  { id: 'L', count: 3, features: [city(N, [50, 12]), road([4], [82, 50]), road([7], [50, 82]), road([10], [18, 50]), field([3, 11], [78, 35]), field([5, 6], [84, 84]), field([8, 9], [16, 84])] },
  { id: 'M', count: 2, features: [city([...N, ...W], [28, 28], true), field([...E, ...S], [70, 70])] },
  { id: 'N', count: 3, features: [city([...N, ...W], [28, 28]), field([...E, ...S], [70, 70])] },
  { id: 'O', count: 2, features: [city([...N, ...W], [26, 26], true), road([4, 7], [66, 66]), field([5, 6], [87, 87]), field([3, 8], [80, 28])] },
  { id: 'P', count: 3, features: [city([...N, ...W], [26, 26]), road([4, 7], [66, 66]), field([5, 6], [87, 87]), field([3, 8], [80, 28])] },
  { id: 'Q', count: 1, features: [city([...N, ...E, ...W], [50, 34], true), field(S, [50, 88])] },
  { id: 'R', count: 3, features: [city([...N, ...E, ...W], [50, 34]), field(S, [50, 88])] },
  { id: 'S', count: 2, features: [city([...N, ...E, ...W], [50, 32], true), road([7], [50, 88]), field([6], [82, 90]), field([8], [18, 90])] },
  { id: 'T', count: 1, features: [city([...N, ...E, ...W], [50, 32]), road([7], [50, 88]), field([6], [82, 90]), field([8], [18, 90])] },
  { id: 'U', count: 8, features: [road([1, 7], [50, 36]), field([8, 9, 10, 11, 0], [22, 50]), field([2, 3, 4, 5, 6], [78, 50])] },
  { id: 'V', count: 9, features: [road([10, 7], [34, 66]), field([8, 9], [13, 87]), field([11, 0, 1, 2, 3, 4, 5, 6], [66, 34])] },
  { id: 'W', count: 4, features: [road([4], [82, 50]), road([7], [50, 82]), road([10], [18, 50]), field([11, 0, 1, 2, 3], [50, 22]), field([5, 6], [84, 84]), field([8, 9], [16, 84])] },
  { id: 'X', count: 1, features: [road([1], [50, 18]), road([4], [82, 50]), road([7], [50, 82]), road([10], [18, 50]), field([11, 0], [16, 16]), field([2, 3], [84, 16]), field([5, 6], [84, 84]), field([8, 9], [16, 84])] },
];

export const TILES: Record<string, TileDef> = Object.fromEntries(TILE_DEFS.map((t) => [t.id, t]));
export const TILE_COUNT = TILE_DEFS.reduce((n, t) => n + t.count, 0);

/** For each tile type, the feature index at each of the 12 ports (-1: none). */
export const PORT_FEATURE: Record<string, number[]> = Object.fromEntries(TILE_DEFS.map((t) => {
  const at = Array<number>(12).fill(-1);
  t.features.forEach((f, i) => f.ports.forEach((p) => (at[p] = i)));
  return [t.id, at];
}));

/**
 * For each tile type and meadow feature, the cities on the same tile it borders
 * (a meadow port sits right next to a city port), for scoring farms.
 */
export const FIELD_CITIES: Record<string, Record<number, number[]>> = Object.fromEntries(TILE_DEFS.map((t) => {
  const at = PORT_FEATURE[t.id];
  const map: Record<number, number[]> = {};
  t.features.forEach((f, i) => {
    if (f.kind !== 'field') return;
    const cities = new Set<number>();
    for (const p of f.ports) {
      for (const q of [(p + 1) % 12, (p + 11) % 12]) {
        if (at[q] >= 0 && t.features[at[q]].kind === 'city') cities.add(at[q]);
      }
    }
    map[i] = [...cities];
  });
  return [t.id, map];
}));

/** Side of a port: 0 north, 1 east, 2 south, 3 west. */
export const sideOf = (port: number) => Math.floor(port / 3);
/** Step to the neighboring square across each side. */
export const SIDE_STEP: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/** The port on the neighboring tile that touches this one. */
export const facingPort = (port: number) => ((sideOf(port) + 2) % 4) * 3 + (2 - (port % 3));

/** A tile type's port as it lies on the board after rotating `rot` quarter turns clockwise. */
export const rotatePort = (port: number, rot: number) => (port + 3 * rot) % 12;
export const unrotatePort = (port: number, rot: number) => (port + 12 - 3 * (rot % 4)) % 12;

/** What the middle of a tile edge is (city, road or meadow), after rotation. */
export function edgeKind(tile: string, rot: number, side: number): FeatureKind {
  const f = PORT_FEATURE[tile][unrotatePort(side * 3 + 1, rot)];
  return TILES[tile].features[f].kind;
}

/** A point in tile units, rotated with the tile. */
export function rotatePoint([x, y]: [number, number], rot: number): [number, number] {
  let px = x, py = y;
  for (let i = 0; i < rot % 4; i++) [px, py] = [100 - py, px];
  return [px, py];
}
