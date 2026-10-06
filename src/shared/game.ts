// Pure rules engine (Splendor-style mechanics), shared by the server (authoritative) and the
// client (for hints like "can I afford this?"). The server mutates a GameState
// only through applyAction(); clients receive a filtered copy via viewFor().

export const COLORS = ['white', 'blue', 'green', 'red', 'black'] as const;
export const GOLD = 'gold';
export const TOKEN_COLORS = [...COLORS, GOLD] as const;
export const WIN_POINTS = 15;
export const MAX_TOKENS = 10;
export const MAX_RESERVED = 3;

export type Color = (typeof COLORS)[number];
export type TokenColor = Color | typeof GOLD;
export type Gems = Record<Color, number>;
export type Tokens = Record<TokenColor, number>;
export type Level = 1 | 2 | 3;

export interface Card {
  id: string;
  level: Level;
  color: Color;
  points: number;
  cost: Gems;
  /** Reserved face-down from a deck: hidden from other players. */
  blind?: boolean;
}

/** A face-down reserved card as seen by other players. */
export interface HiddenCard {
  blind: true;
  level: Level;
}

export interface Noble {
  id: string;
  points: number;
  req: Gems;
}

export interface PlayerState {
  id: string;
  name: string;
  tokens: Tokens;
  cards: Card[];
  reserved: Card[];
  nobles: Noble[];
}

export type Phase = 'turn' | 'discard' | 'noble' | 'over';

/** Structured record of what a player did, so clients can show it (the log holds the same as text). */
export type GameEvent = { seq: number; playerId: string } & (
  | { kind: 'take'; colors: Color[] }
  | { kind: 'reserve'; card: Card | HiddenCard; fromDeck: boolean; gold: boolean }
  | { kind: 'buy'; card: Card }
  | { kind: 'discard'; tokens: Partial<Tokens> }
  | { kind: 'noble'; noble: Noble }
  | { kind: 'pass' }
  | { kind: 'finalRound'; points: number }
);

type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'seq'> : never) : never;

export interface Results {
  ranking: { id: string; name: string; points: number; cards: number }[];
  winners: string[];
}

export interface GameState {
  players: PlayerState[];
  bank: Tokens;
  decks: Record<Level, Card[]>;
  board: Record<Level, (Card | null)[]>;
  nobles: Noble[];
  current: number;
  turn: number;
  phase: Phase;
  finalRound: boolean;
  results: Results | null;
  log: string[];
  events: GameEvent[];
  seq: number;
}

export type Action =
  | { type: 'take'; colors: Color[] }
  | { type: 'reserve'; cardId: string }
  | { type: 'reserveDeck'; level: Level }
  | { type: 'buy'; cardId: string }
  | { type: 'pass' }
  | { type: 'discard'; tokens: Partial<Tokens> }
  | { type: 'noble'; nobleId: string };

import { POINTS_NAME, POINTS_SYMBOL, houseName, place, resource } from './theme';

export class RuleError extends Error {}

const LETTER: Record<string, Color> = { w: 'white', u: 'blue', g: 'green', r: 'red', k: 'black' };
const LEVELS: Level[] = [1, 2, 3];
const GEMS_PER_COLOR: Record<number, number> = { 2: 4, 3: 5, 4: 7 };

// [level, bonus, points, cost]: the 90 development cards of the base game.
const CARD_DATA: [Level, Color, number, string][] = [
  // Level 1
  [1, 'black', 0, 'w1u1g1r1'], [1, 'black', 0, 'w1u2g1r1'], [1, 'black', 0, 'w2u2r1'], [1, 'black', 0, 'g1r3k1'],
  [1, 'black', 0, 'g2r1'], [1, 'black', 0, 'w2g2'], [1, 'black', 0, 'g3'], [1, 'black', 1, 'u4'],
  [1, 'blue', 0, 'w1g1r1k1'], [1, 'blue', 0, 'w1g1r2k1'], [1, 'blue', 0, 'w1g2r2'], [1, 'blue', 0, 'u1g3r1'],
  [1, 'blue', 0, 'w1k2'], [1, 'blue', 0, 'g2k2'], [1, 'blue', 0, 'k3'], [1, 'blue', 1, 'r4'],
  [1, 'white', 0, 'u1g1r1k1'], [1, 'white', 0, 'u1g2r1k1'], [1, 'white', 0, 'u2g2k1'], [1, 'white', 0, 'w3u1k1'],
  [1, 'white', 0, 'r2k1'], [1, 'white', 0, 'u2k2'], [1, 'white', 0, 'u3'], [1, 'white', 1, 'g4'],
  [1, 'green', 0, 'w1u1r1k1'], [1, 'green', 0, 'w1u1r1k2'], [1, 'green', 0, 'u1r2k2'], [1, 'green', 0, 'w1u3g1'],
  [1, 'green', 0, 'w2u1'], [1, 'green', 0, 'u2r2'], [1, 'green', 0, 'r3'], [1, 'green', 1, 'k4'],
  [1, 'red', 0, 'w1u1g1k1'], [1, 'red', 0, 'w2u1g1k1'], [1, 'red', 0, 'w2g1k2'], [1, 'red', 0, 'w1r1k3'],
  [1, 'red', 0, 'u2g1'], [1, 'red', 0, 'w2r2'], [1, 'red', 0, 'w3'], [1, 'red', 1, 'w4'],
  // Level 2
  [2, 'black', 1, 'w3u2g2'], [2, 'black', 1, 'w3g3k2'], [2, 'black', 2, 'u1g4r2'], [2, 'black', 2, 'g5r3'],
  [2, 'black', 2, 'w5'], [2, 'black', 3, 'k6'],
  [2, 'blue', 1, 'u2g2r3'], [2, 'blue', 1, 'u2g3k3'], [2, 'blue', 2, 'w5u3'], [2, 'blue', 2, 'w2r1k4'],
  [2, 'blue', 2, 'u5'], [2, 'blue', 3, 'u6'],
  [2, 'white', 1, 'g3r2k2'], [2, 'white', 1, 'w2u3r3'], [2, 'white', 2, 'g1r4k2'], [2, 'white', 2, 'r5k3'],
  [2, 'white', 2, 'r5'], [2, 'white', 3, 'w6'],
  [2, 'green', 1, 'w3g2r3'], [2, 'green', 1, 'w2u3k2'], [2, 'green', 2, 'w4u2k1'], [2, 'green', 2, 'u5g3'],
  [2, 'green', 2, 'g5'], [2, 'green', 3, 'g6'],
  [2, 'red', 1, 'w2r2k3'], [2, 'red', 1, 'u3r2k3'], [2, 'red', 2, 'w1u4g2'], [2, 'red', 2, 'w3k5'],
  [2, 'red', 2, 'k5'], [2, 'red', 3, 'r6'],
  // Level 3
  [3, 'black', 3, 'w3u3g5r3'], [3, 'black', 4, 'r7'], [3, 'black', 4, 'g3r6k3'], [3, 'black', 5, 'r7k3'],
  [3, 'blue', 3, 'w3g3r3k5'], [3, 'blue', 4, 'w7'], [3, 'blue', 4, 'w6u3k3'], [3, 'blue', 5, 'w7u3'],
  [3, 'white', 3, 'u3g3r5k3'], [3, 'white', 4, 'k7'], [3, 'white', 4, 'w3r3k6'], [3, 'white', 5, 'w3k7'],
  [3, 'green', 3, 'w5u3r3k3'], [3, 'green', 4, 'u7'], [3, 'green', 4, 'w3u6g3'], [3, 'green', 5, 'u7g3'],
  [3, 'red', 3, 'w3u5g3k3'], [3, 'red', 4, 'g7'], [3, 'red', 4, 'u3g6r3'], [3, 'red', 5, 'g7r3'],
];

const NOBLE_DATA = ['r4g4', 'k4r4', 'u4g4', 'w4u4', 'w4k4', 'w3u3k3', 'w3r3k3', 'u3g3r3', 'g3r3k3', 'w3u3g3'];

export const ALL_CARDS: readonly Card[] = CARD_DATA.map(([level, color, points, cost], i) => ({
  id: 'c' + i, level, color, points, cost: parseCost(cost),
}));

export const ALL_NOBLES: readonly Noble[] = NOBLE_DATA.map((req, i) => ({ id: 'n' + i, points: 3, req: parseCost(req) }));

function parseCost(str: string): Gems {
  const cost = emptyGems();
  for (const [, letter, n] of str.matchAll(/([wugrk])(\d)/g)) cost[LETTER[letter]] = Number(n);
  return cost;
}

export function emptyGems(): Gems {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0 };
}

export function emptyTokens(): Tokens {
  return { ...emptyGems(), gold: 0 };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createGame(players: { id: string; name: string }[], rng: () => number = Math.random): GameState {
  const n = players.length;
  if (n < 2 || n > 4) throw new RuleError('The game needs 2 to 4 players');

  const decks = {} as Record<Level, Card[]>;
  const board = {} as Record<Level, (Card | null)[]>;
  for (const level of LEVELS) {
    decks[level] = shuffle(ALL_CARDS.filter((c) => c.level === level).map((c) => structuredClone(c)), rng);
    board[level] = decks[level].splice(0, 4);
  }
  const nobles = shuffle(ALL_NOBLES.map((nb) => structuredClone(nb)), rng).slice(0, n + 1);

  const bank = emptyTokens();
  for (const c of COLORS) bank[c] = GEMS_PER_COLOR[n];
  bank.gold = 5;

  return {
    players: players.map((p) => ({ id: p.id, name: p.name, tokens: emptyTokens(), cards: [], reserved: [], nobles: [] })),
    bank,
    decks,
    board,
    nobles,
    current: 0,
    turn: 1,
    phase: 'turn',
    finalRound: false,
    results: null,
    log: [`Game started. ${players[0].name} goes first.`],
    events: [],
    seq: 0,
  };
}

// ---- Derived values -------------------------------------------------------

export function bonuses(player: Pick<PlayerState, 'cards'>): Gems {
  const b = emptyGems();
  for (const card of player.cards) b[card.color]++;
  return b;
}

export function points(player: Pick<PlayerState, 'cards' | 'nobles'>): number {
  return player.cards.reduce((s, c) => s + c.points, 0) + player.nobles.reduce((s, nb) => s + nb.points, 0);
}

export function tokenTotal(tokens: Partial<Tokens>): number {
  return Object.values(tokens).reduce((a, b) => a + (b ?? 0), 0);
}

/**
 * Tokens spent to buy `card`: colored gems first, gold covers the shortfall.
 * Returns null if the player cannot afford it.
 */
export function paymentFor(tokens: Tokens, bonus: Gems, card: Pick<Card, 'cost'>): Tokens | null {
  const pay = emptyTokens();
  let short = 0;
  for (const c of COLORS) {
    const need = Math.max(0, card.cost[c] - bonus[c]);
    pay[c] = Math.min(need, tokens[c]);
    short += need - pay[c];
  }
  if (short > tokens.gold) return null;
  pay.gold = short;
  return pay;
}

export function meetsNoble(bonus: Gems, noble: Noble): boolean {
  return COLORS.every((c) => bonus[c] >= noble.req[c]);
}

// ---- Actions --------------------------------------------------------------

type Handler = (state: GameState, player: PlayerState, action: any) => void;

const HANDLERS: Record<Exclude<Phase, 'over'>, Record<string, Handler>> = {
  turn: { take, reserve, reserveDeck, buy, pass },
  discard: { discard },
  noble: { noble: chooseNoble },
};

/** Validates and applies an action. Throws RuleError if the move is illegal. */
export function applyAction(state: GameState, playerId: string, action: Action): void {
  if (!action || typeof action.type !== 'string') throw new RuleError('Invalid action');
  if (state.phase === 'over') throw new RuleError('The game is over');
  const player = state.players[state.current];
  if (player.id !== playerId) throw new RuleError('It is not your turn');

  const handlers = HANDLERS[state.phase];
  if (!Object.hasOwn(handlers, action.type)) throw new RuleError("You can't do that right now");
  handlers[action.type](state, player, action);
}

function take(state: GameState, player: PlayerState, { colors }: { colors: unknown }) {
  if (!Array.isArray(colors) || colors.some((c) => !COLORS.includes(c))) throw new RuleError('Invalid selection');
  const picked = colors as Color[];

  if (picked.length === 2 && picked[0] === picked[1]) {
    const c = picked[0];
    if (state.bank[c] < 4) throw new RuleError('You can only take 2 of the same resource when at least 4 are available');
    moveTokens(state.bank, player.tokens, c, 2);
    addLog(state, `${player.name} took 2 ${resource(c, 2)}.`);
    addEvent(state, { playerId: player.id, kind: 'take', colors: [c, c] });
  } else {
    if (new Set(picked).size !== picked.length) throw new RuleError('Pick 3 different resources, or 2 of the same one');
    if (picked.some((c) => state.bank[c] < 1)) throw new RuleError('That resource has run out');
    // You may take fewer than 3 only when fewer than 3 colors are left in the bank.
    const required = Math.min(3, COLORS.filter((c) => state.bank[c] > 0).length);
    if (picked.length !== required) {
      throw new RuleError(required === 3 ? 'Pick 3 different resources, or 2 of the same one' : `Pick ${required} different resources`);
    }
    for (const c of picked) moveTokens(state.bank, player.tokens, c, 1);
    addLog(state, `${player.name} took ${picked.map((c) => resource(c)).join(', ')}.`);
    addEvent(state, { playerId: player.id, kind: 'take', colors: picked });
  }
  afterMainAction(state, player);
}

function reserve(state: GameState, player: PlayerState, { cardId }: { cardId: unknown }) {
  if (player.reserved.length >= MAX_RESERVED) throw new RuleError('You already have 3 reserved cards');
  const loc = findOnBoard(state, cardId);
  if (!loc) throw new RuleError('That card is not on the board');
  const card = takeFromBoard(state, loc);
  player.reserved.push(card);
  const gotGold = gainGold(state, player);
  addLog(state, `${player.name} reserved ${place(card.level, card.color)}${gotGold ? ' and received a gold crown' : ''}.`);
  addEvent(state, { playerId: player.id, kind: 'reserve', card, fromDeck: false, gold: gotGold });
  afterMainAction(state, player);
}

function reserveDeck(state: GameState, player: PlayerState, { level }: { level: unknown }) {
  if (player.reserved.length >= MAX_RESERVED) throw new RuleError('You already have 3 reserved cards');
  if (!LEVELS.includes(level as Level)) throw new RuleError('Invalid deck');
  const deck = state.decks[level as Level];
  const card = deck.shift();
  if (!card) throw new RuleError('That deck is empty');
  const reserved = { ...card, blind: true };
  player.reserved.push(reserved);
  const gotGold = gainGold(state, player);
  addLog(state, `${player.name} reserved a secret tier ${level} card${gotGold ? ' and received a gold crown' : ''}.`);
  addEvent(state, { playerId: player.id, kind: 'reserve', card: reserved, fromDeck: true, gold: gotGold });
  afterMainAction(state, player);
}

function buy(state: GameState, player: PlayerState, { cardId }: { cardId: unknown }) {
  const loc = findOnBoard(state, cardId);
  const reservedIdx = player.reserved.findIndex((c) => c.id === cardId);
  const card = loc ? state.board[loc.level][loc.index] : player.reserved[reservedIdx];
  if (!card) throw new RuleError('You cannot buy that card');
  const pay = paymentFor(player.tokens, bonuses(player), card);
  if (!pay) throw new RuleError('You cannot afford that card');

  for (const c of TOKEN_COLORS) moveTokens(player.tokens, state.bank, c, pay[c]);
  if (loc) takeFromBoard(state, loc);
  else player.reserved.splice(reservedIdx, 1);
  const { blind: _blind, ...owned } = card;
  player.cards.push(owned);
  addLog(state, `${player.name} bought ${place(card.level, card.color)}${card.points ? ` (+${card.points}${POINTS_SYMBOL})` : ''}.`);
  addEvent(state, { playerId: player.id, kind: 'buy', card: owned });
  afterMainAction(state, player);
}

function pass(state: GameState, player: PlayerState) {
  addLog(state, `${player.name} passed.`);
  addEvent(state, { playerId: player.id, kind: 'pass' });
  afterMainAction(state, player);
}

function discard(state: GameState, player: PlayerState, { tokens }: { tokens: unknown }) {
  if (!tokens || typeof tokens !== 'object') throw new RuleError('Invalid discard');
  const excess = tokenTotal(player.tokens) - MAX_TOKENS;
  const entries = Object.entries(tokens as Record<string, unknown>);
  let total = 0;
  for (const [c, n] of entries) {
    if (!(TOKEN_COLORS as readonly string[]).includes(c) || !Number.isInteger(n)) throw new RuleError('Invalid discard');
    if ((n as number) < 0 || (n as number) > player.tokens[c as TokenColor]) throw new RuleError('Invalid discard');
    total += n as number;
  }
  if (total !== excess) throw new RuleError(`You must return exactly ${excess} resource${excess === 1 ? '' : 's'}`);
  for (const [c, n] of entries) moveTokens(player.tokens, state.bank, c as TokenColor, n as number);
  addLog(state, `${player.name} returned ${total} resource${total === 1 ? '' : 's'}.`);
  addEvent(state, { playerId: player.id, kind: 'discard', tokens: Object.fromEntries(entries.filter(([, n]) => (n as number) > 0)) });
  checkNobles(state, player);
}

function chooseNoble(state: GameState, player: PlayerState, { nobleId }: { nobleId: unknown }) {
  const noble = state.nobles.find((nb) => nb.id === nobleId);
  if (!noble || !meetsNoble(bonuses(player), noble)) throw new RuleError('That house will not pledge to you yet');
  claimNoble(state, player, noble);
  endTurn(state);
}

// ---- Turn flow ------------------------------------------------------------

function afterMainAction(state: GameState, player: PlayerState) {
  if (tokenTotal(player.tokens) > MAX_TOKENS) {
    state.phase = 'discard';
    return;
  }
  checkNobles(state, player);
}

function checkNobles(state: GameState, player: PlayerState) {
  const bonus = bonuses(player);
  const eligible = state.nobles.filter((nb) => meetsNoble(bonus, nb));
  if (eligible.length > 1) {
    state.phase = 'noble';
    return;
  }
  if (eligible.length === 1) claimNoble(state, player, eligible[0]);
  endTurn(state);
}

function claimNoble(state: GameState, player: PlayerState, noble: Noble) {
  state.nobles = state.nobles.filter((nb) => nb !== noble);
  player.nobles.push(noble);
  addLog(state, `${houseName(noble.id)} pledged allegiance to ${player.name} (+3${POINTS_SYMBOL}).`);
  addEvent(state, { playerId: player.id, kind: 'noble', noble });
}

function endTurn(state: GameState) {
  const player = state.players[state.current];
  if (!state.finalRound && points(player) >= WIN_POINTS) {
    state.finalRound = true;
    addLog(state, `${player.name} reached ${points(player)} ${POINTS_NAME}! Finishing the round.`);
    addEvent(state, { playerId: player.id, kind: 'finalRound', points: points(player) });
  }
  const next = (state.current + 1) % state.players.length;
  // The round ends when play returns to the first player, so everyone gets the same number of turns.
  if (state.finalRound && next === 0) {
    finishGame(state);
    return;
  }
  state.current = next;
  state.phase = 'turn';
  state.turn++;
}

function finishGame(state: GameState) {
  state.phase = 'over';
  const ranking = state.players
    .map((p) => ({ id: p.id, name: p.name, points: points(p), cards: p.cards.length }))
    .sort((a, b) => b.points - a.points || a.cards - b.cards);
  const best = ranking[0];
  const winners = ranking.filter((r) => r.points === best.points && r.cards === best.cards);
  state.results = { ranking, winners: winners.map((w) => w.id) };
  const names = winners.map((w) => w.name).join(' & ');
  addLog(state, `Game over! ${names} win${winners.length > 1 ? '' : 's'} with ${best.points} ${POINTS_NAME}.`);
}

// ---- Helpers --------------------------------------------------------------

function moveTokens(from: Tokens, to: Tokens, color: TokenColor, n: number) {
  from[color] -= n;
  to[color] += n;
}

function gainGold(state: GameState, player: PlayerState): boolean {
  if (state.bank.gold === 0) return false;
  moveTokens(state.bank, player.tokens, GOLD, 1);
  return true;
}

function findOnBoard(state: GameState, cardId: unknown): { level: Level; index: number } | null {
  for (const level of LEVELS) {
    const index = state.board[level].findIndex((c) => c?.id === cardId);
    if (index !== -1) return { level, index };
  }
  return null;
}

/** Removes a card from the board and refills the slot from its deck (or leaves it empty). */
function takeFromBoard(state: GameState, { level, index }: { level: Level; index: number }): Card {
  const card = state.board[level][index]!;
  state.board[level][index] = state.decks[level].shift() ?? null;
  return card;
}

function addLog(state: GameState, msg: string) {
  state.log.push(msg);
  if (state.log.length > 100) state.log.shift();
}

function addEvent(state: GameState, event: NewEvent) {
  state.events ??= []; // games saved before events existed
  state.seq = (state.seq ?? 0) + 1;
  state.events.push({ ...event, seq: state.seq } as GameEvent);
  if (state.events.length > 30) state.events.shift();
}

// ---- Views ----------------------------------------------------------------

export interface PlayerView {
  id: string;
  name: string;
  tokens: Tokens;
  bonuses: Gems;
  points: number;
  cardCount: number;
  nobles: Noble[];
  reserved: (Card | HiddenCard)[];
}

export interface GameView {
  players: PlayerView[];
  bank: Tokens;
  board: Record<Level, (Card | null)[]>;
  deckCounts: Record<Level, number>;
  nobles: Noble[];
  current: number;
  turn: number;
  phase: Phase;
  finalRound: boolean;
  results: Results | null;
  log: string[];
  events: GameEvent[];
}

export function isHidden(card: Card | HiddenCard): card is HiddenCard {
  return !('cost' in card);
}

/** What a given player (or spectator) is allowed to see. */
export function viewFor(state: GameState, viewerId: string | null): GameView {
  return {
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      tokens: p.tokens,
      bonuses: bonuses(p),
      points: points(p),
      cardCount: p.cards.length,
      nobles: p.nobles,
      reserved: p.reserved.map((c): Card | HiddenCard =>
        c.blind && p.id !== viewerId ? { blind: true, level: c.level } : c),
    })),
    bank: state.bank,
    board: state.board,
    deckCounts: { 1: state.decks[1].length, 2: state.decks[2].length, 3: state.decks[3].length },
    nobles: state.nobles,
    current: state.current,
    turn: state.turn,
    phase: state.phase,
    finalRound: state.finalRound,
    results: state.results,
    log: state.log.slice(-40),
    events: (state.events ?? []).map((e) =>
      e.kind === 'reserve' && e.fromDeck && e.playerId !== viewerId ? { ...e, card: { blind: true, level: e.card.level } } : e),
  };
}
