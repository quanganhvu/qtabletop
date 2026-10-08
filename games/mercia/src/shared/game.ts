// Pure rules engine (Carcassonne-style tile laying), shared by the server
// (authoritative), the bots and the client (for hints such as "where can this
// tile go?"). The server changes a GameState only through applyAction();
// clients receive a filtered copy via viewFor(), without the deck order.

import {
  FIELD_CITIES, PORT_FEATURE, SIDE_STEP, START_TILE, TILES, TILE_DEFS, edgeKind, facingPort, rotatePort, sideOf, unrotatePort,
  type FeatureKind,
} from './tiles';
import { FEATURE_NAMES, POINTS_NAME, tileName } from './theme';

export const MEEPLES = 7;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

export type ScoreKind = 'road' | 'city' | 'cloister' | 'field';
export const SCORE_KINDS: ScoreKind[] = ['city', 'road', 'cloister', 'field'];

/** A tile on the board. `m`: the follower on it (player index, feature index). */
export interface Placed {
  t: string;
  r: number;
  m?: { p: number; f: number };
}

export type Board = Record<string, Placed>;

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  /** Followers still in hand. */
  meeples: number;
  breakdown: Record<ScoreKind, number>;
}

export type Phase = 'turn' | 'over';

/** Structured record of what happened, so clients can show it (the log holds the same as text). */
export type GameEvent = { seq: number; playerId: string } & (
  | { kind: 'place'; tile: string; x: number; y: number; rot: number; meeple: number | null }
  | { kind: 'score'; feature: ScoreKind; points: number; winners: string[]; tiles: [number, number][]; final: boolean }
  | { kind: 'discard'; tile: string }
  | { kind: 'final' }
);

type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'seq'> : never) : never;

export interface Results {
  ranking: { id: string; name: string; score: number; breakdown: Record<ScoreKind, number> }[];
  winners: string[];
}

export interface GameState {
  players: PlayerState[];
  board: Board;
  /** Face-down tiles; the next one drawn is the last. */
  deck: string[];
  /** The tile the current player must place. */
  tile: string | null;
  current: number;
  turn: number;
  phase: Phase;
  /** The most recently placed tile. */
  last: [number, number] | null;
  results: Results | null;
  log: string[];
  events: GameEvent[];
  seq: number;
}

export type GameView = Omit<GameState, 'deck'> & { deckCount: number };

export type Action = { type: 'place'; x: number; y: number; rot: number; meeple: number | null };

export class RuleError extends Error {}

export const key = (x: number, y: number) => `${x},${y}`;
export const parseKey = (k: string): [number, number] => k.split(',').map(Number) as [number, number];

const emptyBreakdown = (): Record<ScoreKind, number> => ({ road: 0, city: 0, cloister: 0, field: 0 });

// ---- Setup ------------------------------------------------------------------------

export function createGame(players: { id: string; name: string }[], rng: () => number = Math.random): GameState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) throw new RuleError(`${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  const deck: string[] = [];
  for (const t of TILE_DEFS) for (let i = 0; i < t.count - (t.id === START_TILE ? 1 : 0); i++) deck.push(t.id);
  shuffle(deck, rng);
  const g: GameState = {
    players: players.map((p) => ({ id: p.id, name: p.name, score: 0, meeples: MEEPLES, breakdown: emptyBreakdown() })),
    board: { [key(0, 0)]: { t: START_TILE, r: 0 } },
    deck,
    tile: null,
    current: 0,
    turn: 1,
    phase: 'turn',
    last: [0, 0],
    results: null,
    log: ['The land is unrolled. The first tile lies on the table.'],
    events: [],
    seq: 0,
  };
  draw(g);
  return g;
}

function shuffle<T>(list: T[], rng: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

// ---- Placement --------------------------------------------------------------------

/** Can `tile`, turned `rot` quarter turns, be laid at (x, y)? */
export function fits(board: Board, tile: string, x: number, y: number, rot: number): boolean {
  if (board[key(x, y)]) return false;
  let neighbors = 0;
  for (let side = 0; side < 4; side++) {
    const [dx, dy] = SIDE_STEP[side];
    const n = board[key(x + dx, y + dy)];
    if (!n) continue;
    neighbors++;
    if (edgeKind(tile, rot, side) !== edgeKind(n.t, n.r, (side + 2) % 4)) return false;
  }
  return neighbors > 0;
}

/** Every empty square next to the land, with the rotations `tile` may take there. */
export function legalSpots(board: Board, tile: string): { x: number; y: number; rots: number[] }[] {
  const seen = new Set<string>();
  const spots: { x: number; y: number; rots: number[] }[] = [];
  for (const k of Object.keys(board)) {
    const [bx, by] = parseKey(k);
    for (const [dx, dy] of SIDE_STEP) {
      const x = bx + dx, y = by + dy, kk = key(x, y);
      if (board[kk] || seen.has(kk)) continue;
      seen.add(kk);
      const rots = [0, 1, 2, 3].filter((r) => fits(board, tile, x, y, r));
      if (rots.length) spots.push({ x, y, rots });
    }
  }
  return spots;
}

// ---- Features -----------------------------------------------------------------------

/** One connected city, road, meadow or abbey across the board. */
export interface Feature {
  kind: FeatureKind;
  /** "x,y,f" for each tile feature that is part of it. */
  nodes: string[];
  /** Distinct tiles it spans. */
  tiles: string[];
  /** Tile edges that still face an empty square: zero means it is complete. */
  open: number;
  pennants: number;
  meeples: { p: number; x: number; y: number }[];
}

const node = (x: number, y: number, f: number) => `${x},${y},${f}`;

/** Follow a feature across tile edges, starting from feature `f` of the tile at (x, y). */
export function featureFrom(board: Board, x: number, y: number, f: number): Feature {
  const start = board[key(x, y)];
  const kind = TILES[start.t].features[f].kind;
  const out: Feature = { kind, nodes: [], tiles: [], open: 0, pennants: 0, meeples: [] };
  if (kind === 'cloister') {
    out.nodes.push(node(x, y, f));
    out.tiles.push(key(x, y));
    out.open = 8 - cloisterNeighbors(board, x, y);
    if (start.m?.f === f) out.meeples.push({ p: start.m.p, x, y });
    return out;
  }
  const seen = new Set<string>([node(x, y, f)]);
  const tiles = new Set<string>();
  const openEdges = new Set<string>();
  const stack: [number, number, number][] = [[x, y, f]];
  while (stack.length) {
    const [cx, cy, cf] = stack.pop()!;
    const placed = board[key(cx, cy)];
    const def = TILES[placed.t].features[cf];
    out.nodes.push(node(cx, cy, cf));
    tiles.add(key(cx, cy));
    if (def.pennant) out.pennants++;
    if (placed.m?.f === cf) out.meeples.push({ p: placed.m.p, x: cx, y: cy });
    for (const port of def.ports) {
      const bp = rotatePort(port, placed.r);
      const side = sideOf(bp);
      const [dx, dy] = SIDE_STEP[side];
      const nx = cx + dx, ny = cy + dy;
      const n = board[key(nx, ny)];
      if (!n) {
        openEdges.add(`${cx},${cy},${side}`);
        continue;
      }
      const nf = PORT_FEATURE[n.t][unrotatePort(facingPort(bp), n.r)];
      const id = node(nx, ny, nf);
      if (!seen.has(id)) {
        seen.add(id);
        stack.push([nx, ny, nf]);
      }
    }
  }
  out.tiles = [...tiles];
  out.open = openEdges.size;
  return out;
}

export function cloisterNeighbors(board: Board, x: number, y: number): number {
  let n = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && board[key(x + dx, y + dy)]) n++;
  return n;
}

/** Every feature on the board, plus which feature each tile feature belongs to. */
export function allFeatures(board: Board): { features: Feature[]; of: Map<string, number> } {
  const features: Feature[] = [];
  const of = new Map<string, number>();
  for (const [k, placed] of Object.entries(board)) {
    const [x, y] = parseKey(k);
    TILES[placed.t].features.forEach((_, f) => {
      if (of.has(node(x, y, f))) return;
      const feat = featureFrom(board, x, y, f);
      for (const n of feat.nodes) of.set(n, features.length);
      features.push(feat);
    });
  }
  return { features, of };
}

/** Players with the most followers on a feature (all of them on a tie). */
export function majority(feat: Feature): number[] {
  const counts = new Map<number, number>();
  for (const m of feat.meeples) counts.set(m.p, (counts.get(m.p) ?? 0) + 1);
  const best = Math.max(0, ...counts.values());
  return best ? [...counts].filter(([, c]) => c === best).map(([p]) => p).sort((a, b) => a - b) : [];
}

/** Points a feature is worth: `complete` for scoring during play, otherwise at the end. */
export function featurePoints(feat: Feature, complete: boolean): number {
  switch (feat.kind) {
    case 'road': return feat.tiles.length;
    case 'city': return (feat.tiles.length + feat.pennants) * (complete ? 2 : 1);
    case 'cloister': return 9 - feat.open;
    case 'field': return 0; // farms are scored separately, at the end
  }
}

/** The tile features on the just-laid tile where you may stand a follower. */
export function meepleOptions(board: Board, tile: string, x: number, y: number, rot: number): number[] {
  const b = { ...board, [key(x, y)]: { t: tile, r: rot } };
  return TILES[tile].features.map((_, f) => f).filter((f) => featureFrom(b, x, y, f).meeples.length === 0);
}

// ---- Turns ------------------------------------------------------------------------

export function applyAction(g: GameState, playerId: string, action: Action): void {
  if (g.phase === 'over') throw new RuleError('The game is over');
  const me = g.players[g.current];
  if (me.id !== playerId) throw new RuleError("It's not your turn");
  if (action?.type !== 'place') throw new RuleError('Unknown action');
  const { x, y, rot } = action;
  const meeple = action.meeple ?? null;
  const tile = g.tile!;
  if (![x, y, rot].every(Number.isInteger) || rot < 0 || rot > 3) throw new RuleError('Invalid placement');
  if (!fits(g.board, tile, x, y, rot)) throw new RuleError("That tile doesn't fit there");
  if (meeple !== null) {
    if (!Number.isInteger(meeple) || !TILES[tile].features[meeple]) throw new RuleError('Invalid follower spot');
    if (me.meeples <= 0) throw new RuleError('You have no followers left');
    if (!meepleOptions(g.board, tile, x, y, rot).includes(meeple)) throw new RuleError('Someone already holds that feature');
  }

  lay(g, { type: 'place', x, y, rot, meeple });
  g.current = (g.current + 1) % g.players.length;
  g.turn++;
  draw(g);
}

/**
 * Lay the current tile (already checked to be legal) and score what it finishes,
 * without moving on to the next player. Bots use this to try moves on a copy.
 */
export function lay(g: GameState, { x, y, rot, meeple }: Action) {
  const me = g.players[g.current];
  const playerId = me.id;
  const tile = g.tile!;
  g.board[key(x, y)] = meeple === null ? { t: tile, r: rot } : { t: tile, r: rot, m: { p: g.current, f: meeple } };
  if (meeple !== null) me.meeples--;
  g.last = [x, y];
  g.tile = null;
  const where = TILES[tile].features[meeple ?? 0];
  log(g, meeple === null
    ? `${me.name} laid ${tileName(tile)}.`
    : `${me.name} laid ${tileName(tile)} and sent a ${FEATURE_NAMES[where.kind].follower} to the ${FEATURE_NAMES[where.kind].name}.`);
  emit(g, { kind: 'place', playerId, tile, x, y, rot, meeple });

  scoreCompleted(g, x, y);
}

/** Score roads and cities finished by the tile at (x, y), and abbeys it surrounds. */
function scoreCompleted(g: GameState, x: number, y: number) {
  const placed = g.board[key(x, y)];
  const done = new Set<string>();
  TILES[placed.t].features.forEach((def, f) => {
    if (def.kind !== 'road' && def.kind !== 'city') return;
    const feat = featureFrom(g.board, x, y, f);
    if (feat.open > 0 || done.has(feat.nodes[0])) return;
    feat.nodes.forEach((n) => done.add(n));
    award(g, feat, true);
  });
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cx = x + dx, cy = y + dy;
      const t = g.board[key(cx, cy)];
      if (!t?.m) continue;
      if (TILES[t.t].features[t.m.f].kind !== 'cloister') continue;
      const feat = featureFrom(g.board, cx, cy, t.m.f);
      if (feat.open === 0) award(g, feat, true);
    }
  }
}

/** Pay the majority holders of a feature and send its followers home. */
function award(g: GameState, feat: Feature, complete: boolean, points = featurePoints(feat, complete)) {
  const winners = majority(feat);
  if (!winners.length || points <= 0) return; // a farm with no finished cities is worth nothing
  const kind = feat.kind as ScoreKind;
  for (const p of winners) {
    g.players[p].score += points;
    g.players[p].breakdown[kind] += points;
  }
  const names = winners.map((p) => g.players[p].name).join(' and ');
  const what = FEATURE_NAMES[feat.kind].name;
  log(g, complete
    ? `${names} scored ${points} ${POINTS_NAME} for a finished ${what}.`
    : `${names} scored ${points} ${POINTS_NAME} for ${kind === 'field' ? 'a' : 'an unfinished'} ${what}.`);
  emit(g, {
    kind: 'score', playerId: g.players[winners[0]].id, feature: kind, points, final: !complete,
    winners: winners.map((p) => g.players[p].id), tiles: feat.tiles.map(parseKey),
  });
  if (complete) returnMeeples(g, feat);
}

function returnMeeples(g: GameState, feat: Feature) {
  for (const m of feat.meeples) {
    const k = key(m.x, m.y);
    const t = g.board[k];
    g.board[k] = { t: t.t, r: t.r }; // replace rather than mutate: bots share tile objects between simulated boards
    g.players[m.p].meeples++;
  }
}

/** Turn over tiles until one can be placed; with none left, the game ends. */
function draw(g: GameState) {
  while (g.deck.length) {
    const t = g.deck.pop()!;
    if (legalSpots(g.board, t).length) {
      g.tile = t;
      return;
    }
    log(g, `${capitalize(tileName(t))} fits nowhere and is set aside.`);
    emit(g, { kind: 'discard', playerId: g.players[g.current].id, tile: t });
  }
  finish(g);
}

/** End of the game: unfinished roads, cities and abbeys, then the farms. */
function finish(g: GameState) {
  g.tile = null;
  g.phase = 'over';
  log(g, 'The last tile is laid. Final scoring:');
  emit(g, { kind: 'final', playerId: g.players[g.current].id });
  const { features, of } = allFeatures(g.board);
  for (const kind of ['road', 'city', 'cloister'] as const) {
    for (const feat of features) if (feat.kind === kind && feat.meeples.length) award(g, feat, false);
  }
  for (const feat of features) {
    if (feat.kind === 'field' && feat.meeples.length) award(g, feat, false, farmPoints(g.board, feat, features, of));
  }
  const ranking = g.players
    .map((p) => ({ id: p.id, name: p.name, score: p.score, breakdown: p.breakdown }))
    .sort((a, b) => b.score - a.score);
  const top = ranking[0].score;
  g.results = { ranking, winners: ranking.filter((r) => r.score === top).map((r) => r.id) };
  log(g, `${ranking.filter((r) => r.score === top).map((r) => r.name).join(' and ')} win${g.results.winners.length > 1 ? '' : 's'} with ${top} ${POINTS_NAME}!`);
}

/** The finished cities a meadow borders. */
export function farmCities(board: Board, field: Feature, features: Feature[], of: Map<string, number>): number[] {
  const cities = new Set<number>();
  for (const n of field.nodes) {
    const [x, y, f] = n.split(',').map(Number);
    for (const c of FIELD_CITIES[board[key(x, y)].t][f] ?? []) cities.add(of.get(node(x, y, c))!);
  }
  return [...cities];
}

/** 3 points for each finished city the meadow borders. */
export function farmPoints(board: Board, field: Feature, features: Feature[], of: Map<string, number>): number {
  return 3 * farmCities(board, field, features, of).filter((c) => features[c].open === 0).length;
}

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

function log(g: GameState, line: string) {
  g.log.push(line);
  if (g.log.length > 200) g.log.splice(0, g.log.length - 200);
}

function emit(g: GameState, e: NewEvent) {
  g.events.push({ ...e, seq: ++g.seq } as GameEvent);
  if (g.events.length > 40) g.events.splice(0, g.events.length - 40);
}

/** What one player may see: everything except the order of the face-down tiles. */
export function viewFor(g: GameState, _playerId: string | null): GameView {
  const { deck, ...rest } = g;
  return { ...rest, deckCount: deck.length };
}
