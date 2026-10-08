// Pure rules engine (Acquire-style hotel chains), shared by the server (authoritative) and the
// client (for hints like "can I play this tile?"). The server mutates a GameState only through
// applyAction(); clients receive a filtered copy via viewFor().

export const CHAINS = ['astra', 'bayside', 'coral', 'dorado', 'empire', 'fontaine', 'grand'] as const;
export type Chain = (typeof CHAINS)[number];

export const ROWS = 9;
export const COLS = 12;
export const TILE_COUNT = ROWS * COLS;
export const HAND_SIZE = 6;
export const START_CASH = 6000;
export const SHARES_PER_CHAIN = 25;
export const MAX_BUY = 3;
export const SAFE_SIZE = 11;
export const END_SIZE = 41;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** Price tier: budget chains are cheapest, luxury chains cost $200 more per share. */
export const TIER: Record<Chain, 0 | 1 | 2> = {
  astra: 0, bayside: 0, coral: 1, dorado: 1, empire: 1, fontaine: 2, grand: 2,
};

/** A board cell: empty, an unincorporated hotel tile, or part of a chain. */
export type Cell = Chain | 'loose' | null;
export type Shares = Record<Chain, number>;

export interface PlayerState {
  id: string;
  name: string;
  cash: number;
  shares: Shares;
  tiles: number[];
}

/**
 * place:    the current player plays a tile.
 * found:    their tile created a new chain; they pick which one.
 * survivor: their tile merged chains tied for largest; they pick the survivor.
 * merge:    each holder of the defunct chain, in turn, sells, trades or keeps their shares.
 * buy:      the current player buys up to 3 shares (and may declare the game over).
 */
export type Phase = 'place' | 'found' | 'survivor' | 'merge' | 'buy' | 'over';

export interface Merger {
  tile: number;
  survivor: Chain;
  /** Chains being absorbed, largest first. The first one is being settled now. */
  defuncts: Chain[];
  /** Index of the player deciding what to do with their shares of defuncts[0]. */
  decider: number;
}

export interface Payout { id: string; amount: number }

/** Structured record of what happened, so clients can show it (the log holds the same as text). */
export type GameEvent = { seq: number; playerId: string } & (
  | { kind: 'place'; tile: number }
  | { kind: 'found'; chain: Chain; bonusShare: boolean }
  | { kind: 'merge'; tile: number; survivor: Chain; defuncts: Chain[] }
  | { kind: 'bonus'; chain: Chain; payouts: Payout[] }
  | { kind: 'dispose'; chain: Chain; sold: number; traded: number; kept: number }
  | { kind: 'buy'; shares: Partial<Shares>; cost: number }
  | { kind: 'noTile' }
  | { kind: 'end'; declared: boolean }
);

type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'seq'> : never) : never;

export interface Results {
  ranking: { id: string; name: string; cash: number }[];
  winners: string[];
  /** Bonuses and share sales paid out at the end, per player. */
  payouts: Record<string, { bonuses: number; sales: number }>;
}

export interface GameState {
  players: PlayerState[];
  board: Cell[];
  bag: number[];
  /** Shares left in the bank. */
  bank: Shares;
  current: number;
  turn: number;
  phase: Phase;
  /** The tile that triggered a 'found' or 'survivor' choice, and the chains to choose from. */
  pending: { tile: number; options: Chain[] } | null;
  merger: Merger | null;
  lastTile: number | null;
  results: Results | null;
  log: string[];
  events: GameEvent[];
  seq: number;
}

export type Action =
  | { type: 'place'; tile: number }
  | { type: 'found'; chain: Chain }
  | { type: 'survivor'; chain: Chain }
  /** `trade` counts defunct shares handed in (2 per survivor share); the rest are kept. */
  | { type: 'dispose'; sell: number; trade: number }
  | { type: 'buy'; shares: Partial<Shares>; end?: boolean };

import { chainName, money } from './theme';

export class RuleError extends Error {}

// ---- Board geometry ---------------------------------------------------------

export const ROW_LETTERS = 'ABCDEFGHI';

/** Tiles are numbered row by row: 0 = 1A, 11 = 12A, 12 = 1B … 107 = 12I. */
export const tileLabel = (t: number) => `${(t % COLS) + 1}${ROW_LETTERS[Math.floor(t / COLS)]}`;

export function neighbors(t: number): number[] {
  const r = Math.floor(t / COLS);
  const c = t % COLS;
  const out: number[] = [];
  if (r > 0) out.push(t - COLS);
  if (r < ROWS - 1) out.push(t + COLS);
  if (c > 0) out.push(t - 1);
  if (c < COLS - 1) out.push(t + 1);
  return out;
}

export function emptyShares(): Shares {
  return Object.fromEntries(CHAINS.map((c) => [c, 0])) as Shares;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- Chains, prices and bonuses --------------------------------------------

export function chainSizes(board: readonly Cell[]): Shares {
  const sizes = emptyShares();
  for (const cell of board) if (cell && cell !== 'loose') sizes[cell]++;
  return sizes;
}

export function activeChains(board: readonly Cell[]): Chain[] {
  const sizes = chainSizes(board);
  return CHAINS.filter((c) => sizes[c] > 0);
}

/** Share price for a chain of the given size (0 when it isn't on the board). */
export function priceFor(chain: Chain, size: number): number {
  if (size < 2) return 0;
  let base: number;
  if (size <= 5) base = size * 100;
  else if (size <= 10) base = 600;
  else if (size <= 40) base = 700 + Math.floor((size - 11) / 10) * 100;
  else base = 1000;
  return base + TIER[chain] * 100;
}

export const chainPrice = (board: readonly Cell[], chain: Chain) => priceFor(chain, chainSizes(board)[chain]);

const roundUp100 = (x: number) => Math.ceil(x / 100) * 100;

/**
 * Majority (10× price) and minority (5× price) shareholder bonuses. A sole holder takes both;
 * ties split the bonuses involved, rounded up to the nearest $100.
 */
export function bonusesFor(players: readonly Pick<PlayerState, 'id' | 'shares'>[], chain: Chain, price: number): Payout[] {
  const majority = price * 10;
  const minority = price * 5;
  const holders = players.filter((p) => p.shares[chain] > 0).sort((a, b) => b.shares[chain] - a.shares[chain]);
  if (!holders.length) return [];
  const firsts = holders.filter((h) => h.shares[chain] === holders[0].shares[chain]);
  if (firsts.length > 1 || holders.length === 1) {
    const each = roundUp100((majority + minority) / firsts.length);
    return firsts.map((h) => ({ id: h.id, amount: each }));
  }
  const seconds = holders.filter((h) => h.shares[chain] === holders[1].shares[chain]);
  const each = roundUp100(minority / seconds.length);
  return [{ id: holders[0].id, amount: majority }, ...seconds.map((h) => ({ id: h.id, amount: each }))];
}

// ---- Tiles ------------------------------------------------------------------

/**
 * ok:      can be played.
 * blocked: would found an eighth chain while all seven are on the board (may become playable later).
 * dead:    would merge two safe chains, so it can never be played.
 */
export type TileStatus = 'ok' | 'blocked' | 'dead';

export function tileStatus(board: readonly Cell[], t: number): TileStatus {
  const adjacent = neighbors(t).map((n) => board[n]).filter((c): c is Chain | 'loose' => !!c);
  const chains = [...new Set(adjacent.filter((c): c is Chain => c !== 'loose'))];
  if (chains.length >= 2) {
    const sizes = chainSizes(board);
    if (chains.filter((c) => sizes[c] >= SAFE_SIZE).length >= 2) return 'dead';
  }
  if (!chains.length && adjacent.includes('loose') && activeChains(board).length === CHAINS.length) return 'blocked';
  return 'ok';
}

export function adjacentChains(board: readonly Cell[], t: number): Chain[] {
  return [...new Set(neighbors(t).map((n) => board[n]).filter((c): c is Chain => !!c && c !== 'loose'))];
}

/** Turns tile `t` and every loose tile connected to it into `chain`. */
function absorb(board: Cell[], t: number, chain: Chain) {
  board[t] = chain;
  const stack = [t];
  while (stack.length) {
    for (const n of neighbors(stack.pop()!)) {
      if (board[n] === 'loose') {
        board[n] = chain;
        stack.push(n);
      }
    }
  }
}

// ---- Setup ------------------------------------------------------------------

export function createGame(players: { id: string; name: string }[], rng: () => number = Math.random): GameState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new RuleError(`The game needs ${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  }
  const bag = shuffle(Array.from({ length: TILE_COUNT }, (_, i) => i), rng);
  const board: Cell[] = Array(TILE_COUNT).fill(null);
  const state: GameState = {
    players: [],
    board,
    bag,
    bank: Object.fromEntries(CHAINS.map((c) => [c, SHARES_PER_CHAIN])) as Shares,
    current: 0,
    turn: 1,
    phase: 'place',
    pending: null,
    merger: null,
    lastTile: null,
    results: null,
    log: [],
    events: [],
    seq: 0,
  };

  // Everyone draws a tile and places it; the one closest to 1A goes first.
  const draws = players.map((p) => ({ p, tile: bag.pop()! }));
  for (const { p, tile } of draws) {
    board[tile] = 'loose';
    addLog(state, `${p.name} drew ${tileLabel(tile)}`);
  }
  const key = (t: number) => (t % COLS) * ROWS + Math.floor(t / COLS);
  draws.sort((a, b) => key(a.tile) - key(b.tile));
  state.players = draws.map(({ p }) => ({ id: p.id, name: p.name, cash: START_CASH, shares: emptyShares(), tiles: [] }));
  for (const p of state.players) p.tiles = bag.splice(-HAND_SIZE).sort((a, b) => a - b);
  addLog(state, `${state.players[0].name} goes first`);
  startTurn(state);
  return state;
}

// ---- Actions ----------------------------------------------------------------

type Handler = (state: GameState, player: PlayerState, action: Record<string, unknown>) => void;

const HANDLERS: Record<Exclude<Phase, 'over'>, Record<string, Handler>> = {
  place: { place },
  found: { found },
  survivor: { survivor },
  merge: { dispose },
  buy: { buy },
};

/** Index of the player who must act now: during a merger, that's whoever is deciding on their shares. */
export function actorIndex(state: Pick<GameState, 'phase' | 'merger' | 'current'>): number {
  return state.phase === 'merge' && state.merger ? state.merger.decider : state.current;
}

export function applyAction(state: GameState, playerId: string, action: Action): void {
  if (state.phase === 'over') throw new RuleError('The game is over');
  const player = state.players[actorIndex(state)];
  if (player.id !== playerId) {
    throw new RuleError(state.phase === 'merge' ? `Waiting for ${player.name} to decide` : 'Not your turn');
  }
  const handler = HANDLERS[state.phase][(action as { type?: unknown })?.type as string];
  if (!handler) throw new RuleError("You can't do that now");
  handler(state, player, action as unknown as Record<string, unknown>);
}

function place(state: GameState, player: PlayerState, { tile }: { tile?: unknown }) {
  const t = tile as number;
  if (!Number.isInteger(t) || !player.tiles.includes(t)) throw new RuleError("You don't have that tile");
  const status = tileStatus(state.board, t);
  if (status === 'dead') throw new RuleError('That tile would merge two safe chains');
  if (status === 'blocked') throw new RuleError('All seven chains are already on the board');

  player.tiles = player.tiles.filter((x) => x !== t);
  state.board[t] = 'loose';
  state.lastTile = t;
  addLog(state, `${player.name} played ${tileLabel(t)}`);
  addEvent(state, { kind: 'place', playerId: player.id, tile: t });

  const chains = adjacentChains(state.board, t);
  if (chains.length === 0) {
    if (neighbors(t).some((n) => state.board[n] === 'loose')) {
      const active = activeChains(state.board);
      state.pending = { tile: t, options: CHAINS.filter((c) => !active.includes(c)) };
      state.phase = 'found';
      return;
    }
    toBuy(state);
  } else if (chains.length === 1) {
    absorb(state.board, t, chains[0]);
    toBuy(state);
  } else {
    const sizes = chainSizes(state.board);
    const largest = Math.max(...chains.map((c) => sizes[c]));
    const tied = chains.filter((c) => sizes[c] === largest);
    if (tied.length > 1) {
      state.pending = { tile: t, options: tied };
      state.phase = 'survivor';
      return;
    }
    startMerger(state, t, tied[0], chains);
  }
}

function found(state: GameState, player: PlayerState, { chain }: { chain?: unknown }) {
  const p = state.pending!;
  if (!p.options.includes(chain as Chain)) throw new RuleError('Pick a chain that is not on the board');
  const c = chain as Chain;
  absorb(state.board, p.tile, c);
  state.pending = null;
  const bonusShare = state.bank[c] > 0;
  if (bonusShare) {
    state.bank[c]--;
    player.shares[c]++;
  }
  addLog(state, `${player.name} founded ${chainName(c)}${bonusShare ? ' and got a free share' : ''}`);
  addEvent(state, { kind: 'found', playerId: player.id, chain: c, bonusShare });
  toBuy(state);
}

function survivor(state: GameState, _player: PlayerState, { chain }: { chain?: unknown }) {
  const p = state.pending!;
  if (!p.options.includes(chain as Chain)) throw new RuleError('Pick one of the largest chains');
  state.pending = null;
  startMerger(state, p.tile, chain as Chain, adjacentChains(state.board, p.tile));
}

function startMerger(state: GameState, tile: number, survivor: Chain, chains: Chain[]) {
  const sizes = chainSizes(state.board);
  const defuncts = chains
    .filter((c) => c !== survivor)
    .sort((a, b) => sizes[b] - sizes[a] || CHAINS.indexOf(a) - CHAINS.indexOf(b));
  state.merger = { tile, survivor, defuncts, decider: state.current };
  const player = state.players[state.current];
  addLog(state, `${player.name} merged ${defuncts.map(chainName).join(' and ')} into ${chainName(survivor)}`);
  addEvent(state, { kind: 'merge', playerId: player.id, tile, survivor, defuncts: [...defuncts] });
  beginDefunct(state);
}

/** Pays the shareholder bonuses for the chain being absorbed, then asks its holders what to do. */
function beginDefunct(state: GameState): void {
  const m = state.merger!;
  const defunct = m.defuncts[0];
  const price = chainPrice(state.board, defunct);
  const payouts = bonusesFor(state.players, defunct, price);
  for (const { id, amount } of payouts) {
    const p = state.players.find((x) => x.id === id)!;
    p.cash += amount;
    addLog(state, `${p.name} earned a ${money(amount)} ${chainName(defunct)} bonus`);
  }
  addEvent(state, { kind: 'bonus', playerId: state.players[state.current].id, chain: defunct, payouts });
  const next = nextHolder(state, defunct, 0);
  if (next === -1) return finishDefunct(state);
  m.decider = next;
  state.phase = 'merge';
}

/** The next player, counting `offset` seats on from the mergemaker, who holds shares of `chain`. */
function nextHolder(state: GameState, chain: Chain, offset: number): number {
  const n = state.players.length;
  for (let k = offset; k < n; k++) {
    const i = (state.current + k) % n;
    if (state.players[i].shares[chain] > 0) return i;
  }
  return -1;
}

function dispose(state: GameState, player: PlayerState, { sell, trade }: { sell?: unknown; trade?: unknown }) {
  const m = state.merger!;
  const defunct = m.defuncts[0];
  const held = player.shares[defunct];
  const s = sell as number;
  const t = trade as number;
  if (!Number.isInteger(s) || !Number.isInteger(t) || s < 0 || t < 0) throw new RuleError('Invalid amounts');
  if (s + t > held) throw new RuleError(`You only have ${held} ${chainName(defunct)} shares`);
  if (t % 2) throw new RuleError('Shares trade 2 for 1');
  if (t / 2 > state.bank[m.survivor]) throw new RuleError(`Only ${state.bank[m.survivor]} ${chainName(m.survivor)} shares are left`);

  const price = chainPrice(state.board, defunct);
  player.shares[defunct] -= s + t;
  state.bank[defunct] += s + t;
  player.cash += s * price;
  player.shares[m.survivor] += t / 2;
  state.bank[m.survivor] -= t / 2;
  const kept = held - s - t;
  const parts = [s && `sold ${s}`, t && `traded ${t}`, kept && `kept ${kept}`].filter(Boolean);
  addLog(state, `${player.name} ${parts.join(', ')} ${chainName(defunct)}`);
  addEvent(state, { kind: 'dispose', playerId: player.id, chain: defunct, sold: s, traded: t, kept });

  const n = state.players.length;
  const next = nextHolder(state, defunct, ((m.decider - state.current + n) % n) + 1);
  if (next === -1) finishDefunct(state);
  else m.decider = next;
}

function finishDefunct(state: GameState): void {
  const m = state.merger!;
  const defunct = m.defuncts.shift()!;
  for (let i = 0; i < TILE_COUNT; i++) if (state.board[i] === defunct) state.board[i] = m.survivor;
  if (m.defuncts.length) return beginDefunct(state);
  absorb(state.board, m.tile, m.survivor);
  state.merger = null;
  toBuy(state);
}

function buy(state: GameState, player: PlayerState, { shares, end }: { shares?: unknown; end?: unknown }) {
  const order = (shares ?? {}) as Record<string, unknown>;
  if (typeof order !== 'object') throw new RuleError('Invalid order');
  let total = 0;
  let cost = 0;
  const sizes = chainSizes(state.board);
  const bought: Partial<Shares> = {};
  for (const [key, value] of Object.entries(order)) {
    const chain = key as Chain;
    const n = value as number;
    if (!CHAINS.includes(chain) || !Number.isInteger(n) || n < 0) throw new RuleError('Invalid order');
    if (!n) continue;
    if (!sizes[chain]) throw new RuleError(`${chainName(chain)} is not on the board`);
    if (state.bank[chain] < n) throw new RuleError(`Only ${state.bank[chain]} ${chainName(chain)} shares are left`);
    total += n;
    cost += n * priceFor(chain, sizes[chain]);
    bought[chain] = n;
  }
  if (total > MAX_BUY) throw new RuleError(`You can buy at most ${MAX_BUY} shares a turn`);
  if (cost > player.cash) throw new RuleError("You can't afford that");
  if (end && !canDeclareEnd(state.board)) throw new RuleError("The game can't end yet");

  for (const [chain, n] of Object.entries(bought) as [Chain, number][]) {
    player.shares[chain] += n;
    state.bank[chain] -= n;
  }
  player.cash -= cost;
  if (total) {
    const list = Object.entries(bought).map(([c, n]) => `${n} ${chainName(c as Chain)}`).join(', ');
    addLog(state, `${player.name} bought ${list} for ${money(cost)}`);
    addEvent(state, { kind: 'buy', playerId: player.id, shares: bought, cost });
  }
  if (end) {
    addLog(state, `${player.name} declared the game over`);
    return finishGame(state, true);
  }
  finishTurn(state);
}

/** True when the current player may declare the game over. */
export function canDeclareEnd(board: readonly Cell[]): boolean {
  const sizes = chainSizes(board);
  const active = CHAINS.filter((c) => sizes[c] > 0);
  return active.some((c) => sizes[c] >= END_SIZE) || (active.length > 0 && active.every((c) => sizes[c] >= SAFE_SIZE));
}

/** Goes to the buy step, or skips it when there is nothing to buy and nothing to declare. */
function toBuy(state: GameState) {
  state.phase = 'buy';
  const player = state.players[state.current];
  const sizes = chainSizes(state.board);
  const canBuy = CHAINS.some((c) => sizes[c] > 0 && state.bank[c] > 0 && priceFor(c, sizes[c]) <= player.cash);
  if (!canBuy && !canDeclareEnd(state.board)) finishTurn(state);
}

function finishTurn(state: GameState) {
  const player = state.players[state.current];
  // Tiles that can never be played are swapped for new ones.
  for (const t of [...player.tiles]) {
    if (tileStatus(state.board, t) === 'dead' && state.bag.length) {
      player.tiles = player.tiles.filter((x) => x !== t);
      addLog(state, `${player.name} discarded unplayable tile ${tileLabel(t)}`);
    }
  }
  while (player.tiles.length < HAND_SIZE && state.bag.length) player.tiles.push(state.bag.pop()!);
  player.tiles.sort((a, b) => a - b);
  state.current = (state.current + 1) % state.players.length;
  state.turn++;
  startTurn(state);
}

function startTurn(state: GameState) {
  const player = state.players[state.current];
  state.phase = 'place';
  const playable = (p: PlayerState) => p.tiles.some((t) => tileStatus(state.board, t) === 'ok');
  if (playable(player)) return;

  // Nobody can ever play again: blocked tiles everywhere, or dead ones and no tiles left to replace them.
  const stuck = state.players.every((p) => p.tiles.every((t) => {
    const s = tileStatus(state.board, t);
    return s === 'blocked' || (s === 'dead' && !state.bag.length);
  }));
  if (stuck) {
    addLog(state, 'No more tiles can be played');
    return finishGame(state, false);
  }
  addLog(state, `${player.name} has no playable tile`);
  addEvent(state, { kind: 'noTile', playerId: player.id });
  toBuy(state);
}

/** Pays the final bonuses for every chain on the board and sells off all shares. */
function finishGame(state: GameState, declared: boolean) {
  const payouts: Results['payouts'] = Object.fromEntries(state.players.map((p) => [p.id, { bonuses: 0, sales: 0 }]));
  for (const chain of activeChains(state.board)) {
    const price = chainPrice(state.board, chain);
    for (const { id, amount } of bonusesFor(state.players, chain, price)) payouts[id].bonuses += amount;
    for (const p of state.players) {
      payouts[p.id].sales += p.shares[chain] * price;
      state.bank[chain] += p.shares[chain];
      p.shares[chain] = 0;
    }
  }
  for (const p of state.players) {
    p.cash += payouts[p.id].bonuses + payouts[p.id].sales;
    // Shares of chains no longer on the board are worthless.
    for (const c of CHAINS) {
      state.bank[c] += p.shares[c];
      p.shares[c] = 0;
    }
  }
  const ranking = state.players.map((p) => ({ id: p.id, name: p.name, cash: p.cash })).sort((a, b) => b.cash - a.cash);
  const winners = ranking.filter((r) => r.cash === ranking[0].cash).map((r) => r.id);
  state.results = { ranking, winners, payouts };
  state.phase = 'over';
  state.pending = null;
  state.merger = null;
  const names = ranking.filter((r) => winners.includes(r.id)).map((r) => r.name).join(' and ');
  addLog(state, `${names} ${winners.length > 1 ? 'tie' : 'wins'} with ${money(ranking[0].cash)}`);
  addEvent(state, { kind: 'end', playerId: state.players[state.current].id, declared });
}

function addLog(state: GameState, msg: string) {
  state.log.push(msg);
  if (state.log.length > 150) state.log.shift();
}

function addEvent(state: GameState, event: NewEvent) {
  state.seq++;
  state.events.push({ ...event, seq: state.seq } as GameEvent);
  if (state.events.length > 30) state.events.shift();
}

// ---- Views ------------------------------------------------------------------

export interface PlayerView {
  id: string;
  name: string;
  cash: number;
  shares: Shares;
  /** Only your own tiles are visible. */
  tiles: number[] | null;
  tileCount: number;
}

export interface GameView extends Omit<GameState, 'players' | 'bag' | 'log'> {
  players: PlayerView[];
  bagCount: number;
  log: string[];
}

/** What a given player (or spectator) is allowed to see. */
export function viewFor(state: GameState, viewerId: string | null): GameView {
  const { players, bag, log, ...rest } = state;
  return {
    ...rest,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      cash: p.cash,
      shares: p.shares,
      tiles: p.id === viewerId ? p.tiles : null,
      tileCount: p.tiles.length,
    })),
    bagCount: bag.length,
    log: log.slice(-60),
  };
}
