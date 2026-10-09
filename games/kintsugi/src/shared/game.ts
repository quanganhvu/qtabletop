// Pure rules engine (Azul-style tile drafting), shared by the server
// (authoritative), the bots and the client (for hints such as "which rows can
// take these tiles?"). The server changes a GameState only through
// applyAction(); clients receive a filtered copy via viewFor(), without the
// order of the tiles in the bag.

import { CENTER_NAME, POINTS_NAME, TOKEN_NAME, colorName, kilnName, rowName } from './theme';

export const COLORS = ['blue', 'yellow', 'red', 'black', 'white'] as const;
export type Color = (typeof COLORS)[number];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const SIZE = 5;
export const PER_COLOR = 20;
export const PER_KILN = 4;
/** What each slot of the floor line costs, left to right. Tiles beyond the last slot cost nothing more. */
export const FLOOR_PENALTIES = [1, 1, 2, 2, 2, 3, 3];
export const BONUS = { row: 2, column: 7, color: 10 };

/** Kilns (factory displays) for each player count. */
export const kilnCount = (players: number) => 2 * players + 1;

/** The color that belongs in row r, column c of a wall (each row shifts the pattern one step right). */
export const wallColor = (r: number, c: number): Color => COLORS[(c - r + SIZE) % SIZE];
/** The column of a color in row r. */
export const wallColumn = (r: number, color: Color) => (COLORS.indexOf(color) + r) % SIZE;

/** A work row (pattern line): row r holds up to r + 1 tiles of one color. */
export interface Line {
  color: Color | null;
  count: number;
}

/** A slot on the floor line: a tile, or the first-player marker ('first'). */
export type FloorItem = Color | 'first';

export interface Breakdown {
  /** Points from tiles set in the wall during play. */
  tiles: number;
  /** Points lost on the floor line (a positive number). */
  broken: number;
  rows: number;
  columns: number;
  colors: number;
}

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  lines: Line[];
  /** wall[r][c]: is that tile of the wall set? */
  wall: boolean[][];
  floor: FloorItem[];
  breakdown: Breakdown;
}

export type Phase = 'draft' | 'over';

/** Where tiles come from: a kiln by index, or the center of the table. */
export type Source = number | 'center';
/** Where they go: a work row by index, or straight to the floor. */
export type Target = number | 'floor';

/** One tile set in a wall at the end of a round. */
export interface Setting { row: number; col: number; color: Color; points: number }

/** Structured record of what happened, so clients can show it (the log holds the same as text). */
export type GameEvent = { seq: number; playerId: string } & (
  | { kind: 'take'; source: Source; color: Color; count: number; target: Target; first: boolean; overflow: number }
  | { kind: 'round'; round: number; scores: { playerId: string; settings: Setting[]; broken: number; total: number }[] }
  | { kind: 'final'; bonuses: { playerId: string; rows: number; columns: number; colors: number }[] }
);

type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'seq'> : never) : never;

export interface Results {
  ranking: { id: string; name: string; score: number; rows: number; breakdown: Breakdown }[];
  winners: string[];
}

export interface GameState {
  players: PlayerState[];
  kilns: Color[][];
  center: Color[];
  /** Is the first-player token still in the center? */
  firstInCenter: boolean;
  /** Face-down tiles: the next drawn is the last. */
  bag: Color[];
  /** Broken and spare tiles, poured back into the bag when it runs dry. */
  lid: Color[];
  current: number;
  /** Who starts the next round (whoever took the first-player token). */
  starter: number;
  round: number;
  turn: number;
  phase: Phase;
  results: Results | null;
  log: string[];
  events: GameEvent[];
  seq: number;
}

export type GameView = Omit<GameState, 'bag'> & { bagCount: number };

export type Action = { type: 'take'; source: Source; color: Color; target: Target };

export class RuleError extends Error {}

// ---- Setup ------------------------------------------------------------------------

const emptyBreakdown = (): Breakdown => ({ tiles: 0, broken: 0, rows: 0, columns: 0, colors: 0 });

export function createGame(players: { id: string; name: string }[], rng: () => number = Math.random): GameState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) throw new RuleError(`${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  const bag: Color[] = COLORS.flatMap((c) => Array<Color>(PER_COLOR).fill(c));
  shuffle(bag, rng);
  const g: GameState = {
    players: players.map((p) => ({
      id: p.id, name: p.name, score: 0,
      lines: Array.from({ length: SIZE }, () => ({ color: null, count: 0 })),
      wall: Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false)),
      floor: [],
      breakdown: emptyBreakdown(),
    })),
    kilns: Array.from({ length: kilnCount(players.length) }, () => []),
    center: [],
    firstInCenter: true,
    bag,
    lid: [],
    current: 0,
    starter: 0,
    round: 1,
    turn: 1,
    phase: 'draft',
    results: null,
    log: ['The kilns are opened. Round 1 begins.'],
    events: [],
    seq: 0,
  };
  fillKilns(g, rng);
  return g;
}

function shuffle<T>(list: T[], rng: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

/** Four tiles onto each kiln, pouring the lid back into the bag if it runs dry. */
function fillKilns(g: GameState, rng: () => number) {
  for (const kiln of g.kilns) {
    while (kiln.length < PER_KILN) {
      if (!g.bag.length) {
        if (!g.lid.length) return; // every tile is in play: some kilns stay short
        g.bag = g.lid;
        g.lid = [];
        shuffle(g.bag, rng);
      }
      kiln.push(g.bag.pop()!);
    }
  }
}

// ---- Rules queries -----------------------------------------------------------------

/** The tiles at a source. */
export const tilesAt = (g: Pick<GameState, 'kilns' | 'center'>, source: Source): Color[] =>
  source === 'center' ? g.center : g.kilns[source] ?? [];

/** Can `color` go into work row `r` of this player? */
export function canPlace(p: Pick<PlayerState, 'lines' | 'wall'>, r: number, color: Color): boolean {
  const line = p.lines[r];
  if (!line || line.count >= r + 1) return false;
  if (line.color && line.color !== color) return false;
  return !p.wall[r][wallColumn(r, color)];
}

/** Every (source, color) pick on offer right now. */
export function picks(g: Pick<GameState, 'kilns' | 'center'>): { source: Source; color: Color; count: number }[] {
  const out: { source: Source; color: Color; count: number }[] = [];
  const add = (source: Source, tiles: Color[]) => {
    for (const color of COLORS) {
      const count = tiles.filter((c) => c === color).length;
      if (count) out.push({ source, color, count });
    }
  };
  g.kilns.forEach((k, i) => add(i, k));
  add('center', g.center);
  return out;
}

/** Every legal move for player `p`. */
export function legalMoves(g: GameState, p = g.current): Action[] {
  const me = g.players[p];
  const moves: Action[] = [];
  for (const { source, color } of picks(g)) {
    for (let r = 0; r < SIZE; r++) if (canPlace(me, r, color)) moves.push({ type: 'take', source, color, target: r });
    moves.push({ type: 'take', source, color, target: 'floor' });
  }
  return moves;
}

/** Points for setting a tile at (r, c): the lengths of the lines of tiles it joins. */
export function placementPoints(wall: boolean[][], r: number, c: number): number {
  const run = (dr: number, dc: number) => {
    let n = 0;
    for (let i = r + dr, j = c + dc; i >= 0 && i < SIZE && j >= 0 && j < SIZE && wall[i][j]; i += dr, j += dc) n++;
    return n;
  };
  const h = run(0, -1) + run(0, 1);
  const v = run(-1, 0) + run(1, 0);
  if (!h && !v) return 1;
  return (h ? h + 1 : 0) + (v ? v + 1 : 0);
}

/** What a floor line of `n` slots costs. */
export const floorPenalty = (n: number) => FLOOR_PENALTIES.slice(0, n).reduce((a, b) => a + b, 0);

export const completeRows = (wall: boolean[][]) => wall.filter((row) => row.every(Boolean)).length;
export const completeColumns = (wall: boolean[][]) =>
  Array.from({ length: SIZE }, (_, c) => wall.every((row) => row[c])).filter(Boolean).length;
export const completeColors = (wall: boolean[][]) =>
  COLORS.filter((color) => wall.every((row, r) => row[wallColumn(r, color)])).length;

// ---- Turns ------------------------------------------------------------------------

export function applyAction(g: GameState, playerId: string, action: Action, rng: () => number = Math.random): void {
  if (g.phase === 'over') throw new RuleError('The game is over');
  const me = g.players[g.current];
  if (me.id !== playerId) throw new RuleError("It's not your turn");
  if (action?.type !== 'take') throw new RuleError('Unknown action');
  const { source, color, target } = action;
  if (!(COLORS as readonly string[]).includes(color)) throw new RuleError('Unknown color');
  if (source !== 'center' && !(Number.isInteger(source) && source >= 0 && source < g.kilns.length)) throw new RuleError('Unknown kiln');
  if (!tilesAt(g, source).includes(color)) throw new RuleError(`There is no ${colorName(color)} there`);
  if (target !== 'floor') {
    if (!Number.isInteger(target) || target < 0 || target >= SIZE) throw new RuleError('Unknown row');
    if (!canPlace(me, target, color)) throw new RuleError(`${colorName(color, true)} can't go in that row`);
  }

  take(g, action);
  g.turn++;
  if (!g.center.length && g.kilns.every((k) => !k.length)) endRound(g, rng);
  else g.current = (g.current + 1) % g.players.length;
}

/**
 * Take the tiles (already checked to be legal) and lay them, without moving on
 * to the next player. Bots use this to try moves on a copy.
 */
export function take(g: GameState, { source, color, target }: Action) {
  const me = g.players[g.current];
  const tiles = tilesAt(g, source);
  const taken = tiles.filter((c) => c === color);
  const rest = tiles.filter((c) => c !== color);
  let first = false;
  if (source === 'center') {
    g.center = rest;
    if (g.firstInCenter) {
      g.firstInCenter = false;
      g.starter = g.current;
      first = true;
      toFloor(g, me, 'first');
    }
  } else {
    g.kilns[source] = [];
    g.center = [...g.center, ...rest];
  }

  let overflow = taken.length;
  if (target !== 'floor') {
    const line = me.lines[target];
    const fit = Math.min(taken.length, target + 1 - line.count);
    me.lines[target] = { color, count: line.count + fit };
    overflow -= fit;
  }
  for (let i = 0; i < overflow; i++) toFloor(g, me, color);

  const what = `${taken.length} ${colorName(color)}`;
  const from = source === 'center' ? CENTER_NAME : kilnName(source);
  const where = target === 'floor' ? 'and dropped them on the floor' : `for ${rowName(target)}`;
  const broke = target !== 'floor' && overflow ? `, ${overflow} broke on the floor` : '';
  log(g, `${me.name} took ${what} from ${from} ${where}${broke}${first ? `, and ${TOKEN_NAME}` : ''}.`);
  emit(g, { kind: 'take', playerId: me.id, source, color, count: taken.length, target, first, overflow });
}

function toFloor(g: GameState, p: PlayerState, item: FloorItem) {
  if (p.floor.length < FLOOR_PENALTIES.length) p.floor.push(item);
  else if (item !== 'first') g.lid.push(item);
}

/** Tile the walls: full work rows move into the walls, floors are swept, and a new round (or the end) begins. */
function endRound(g: GameState, rng: () => number) {
  const scores: Extract<GameEvent, { kind: 'round' }>['scores'] = [];
  for (const p of g.players) {
    const settings: Setting[] = [];
    p.lines.forEach((line, r) => {
      if (!line.color || line.count < r + 1) return;
      const col = wallColumn(r, line.color);
      p.wall[r][col] = true;
      const points = placementPoints(p.wall, r, col);
      settings.push({ row: r, col, color: line.color, points });
      for (let i = 1; i < line.count; i++) g.lid.push(line.color);
      p.lines[r] = { color: null, count: 0 };
    });
    const gained = settings.reduce((a, s) => a + s.points, 0);
    const broken = Math.min(floorPenalty(p.floor.length), p.score + gained);
    p.score += gained - broken;
    p.breakdown.tiles += gained;
    p.breakdown.broken += broken;
    for (const item of p.floor) if (item !== 'first') g.lid.push(item);
    p.floor = [];
    scores.push({ playerId: p.id, settings, broken, total: p.score });
    const parts = [gained && `${gained} for ${settings.length} tile${settings.length === 1 ? '' : 's'}`, broken && `lost ${broken} to broken tiles`].filter(Boolean);
    if (parts.length) log(g, `${p.name}: ${parts.join(', ')} (${p.score} ${POINTS_NAME}).`);
  }
  emit(g, { kind: 'round', playerId: g.players[g.starter].id, round: g.round, scores });

  if (g.players.some((p) => completeRows(p.wall) > 0)) return finish(g);

  g.round++;
  g.current = g.starter;
  g.firstInCenter = true;
  fillKilns(g, rng);
  log(g, `Round ${g.round} begins. ${g.players[g.current].name} starts.`);
}

/** End of the game: bonuses for finished rows, columns and colors. */
function finish(g: GameState) {
  g.phase = 'over';
  log(g, 'A wall row is finished: the last round is over. Bonuses:');
  const bonuses: Extract<GameEvent, { kind: 'final' }>['bonuses'] = [];
  for (const p of g.players) {
    const rows = completeRows(p.wall) * BONUS.row;
    const columns = completeColumns(p.wall) * BONUS.column;
    const colors = completeColors(p.wall) * BONUS.color;
    Object.assign(p.breakdown, { rows, columns, colors });
    p.score += rows + columns + colors;
    bonuses.push({ playerId: p.id, rows, columns, colors });
    if (rows + columns + colors) log(g, `${p.name} earns ${rows + columns + colors} in bonuses (${p.score} ${POINTS_NAME}).`);
  }
  emit(g, { kind: 'final', playerId: g.players[g.current].id, bonuses });

  const ranking = g.players
    .map((p) => ({ id: p.id, name: p.name, score: p.score, rows: completeRows(p.wall), breakdown: p.breakdown }))
    .sort((a, b) => b.score - a.score || b.rows - a.rows);
  const top = ranking[0];
  const winners = ranking.filter((r) => r.score === top.score && r.rows === top.rows);
  g.results = { ranking, winners: winners.map((r) => r.id) };
  log(g, `${winners.map((r) => r.name).join(' and ')} win${winners.length > 1 ? '' : 's'} with ${top.score} ${POINTS_NAME}!`);
}

function log(g: GameState, line: string) {
  g.log.push(line);
  if (g.log.length > 200) g.log.splice(0, g.log.length - 200);
}

function emit(g: GameState, e: NewEvent) {
  g.events.push({ ...e, seq: ++g.seq } as GameEvent);
  if (g.events.length > 40) g.events.splice(0, g.events.length - 40);
}

/** What one player may see: everything except the order of the tiles in the bag. */
export function viewFor(g: GameState, _playerId: string | null): GameView {
  const { bag, ...rest } = g;
  return { ...rest, bagCount: bag.length };
}
