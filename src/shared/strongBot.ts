// A stronger bot: instead of chasing one card, it scores every legal move by the
// position it leads to and picks the best (or, at lower skill, one of the best).
//
// A position is valued by renown, progress toward noble houses, how soon the
// best few cards come within reach, how useful its permanent discounts are, and
// the resources in hand. It only looks at public information plus its own
// reserved cards.

import { chooseBotAction as chooseGreedyAction } from './bot';
import {
  COLORS, MAX_RESERVED, MAX_TOKENS, WIN_POINTS, bonuses, emptyTokens, paymentFor, points, tokenTotal,
  type Action, type Card, type Color, type Gems, type GameState, type Noble, type PlayerState, type Tokens,
} from './game';

/** Position after a hypothetical move, for one player. */
interface Snap {
  tokens: Tokens;
  bonus: Gems;
  points: number;
  reserved: Card[];
  cards: number;
  gone: Set<string>; // cards no longer on offer (bought or reserved by this move)
}

interface Ctx {
  state: GameState;
  board: Card[];
  nobles: Noble[];
  early: number; // 1 at the start, falling to 0 as the game matures
  urgency: number; // how much raw renown matters right now (endgame)
  demand: Gems; // how much each resource is wanted across cards on offer
}

/** Evaluation weights (tuned by simulated matches against the greedy bot). */
export const W = {
  points: 4.8,
  ownedBase: 1.2,
  ownedEarly: 3.3,
  tokens: 0.15,
  gold: 0.3,
  reservePenalty: 1.2,
  nobles: 2.6,
  offer1: 0.6,
  offer2: 0.3,
  offer3: 0.15,
};

export function chooseStrongAction(state: GameState, botId: string, rng: () => number = Math.random, noise = 0): Action {
  if (state.phase !== 'turn') return chooseGreedyAction(state, botId, rng); // discards and noble choice
  const me = state.players.find((p) => p.id === botId);
  if (!me) throw new Error('Bot is not in this game');

  const board = [3, 2, 1].flatMap((l) => state.board[l as 1 | 2 | 3]).filter((c): c is Card => !!c);
  const leader = Math.max(...state.players.map((p) => points(p)));
  const ctx: Ctx = {
    state,
    board,
    nobles: state.nobles,
    early: Math.max(0, 1 - (me.cards.length + me.reserved.length) / 9),
    urgency: leader >= 10 ? 1 + (leader - 10) * 0.35 : 1,
    demand: demandOf(board, me.reserved, bonuses(me)),
  };
  const base = snapOf(me);

  const scored = legalMoves(state, me).map((action) => ({ action, score: evaluate(ctx, apply(ctx, base, action, me), me) + blockBonus(ctx, me, action) }));
  scored.sort((a, b) => b.score - a.score);

  // At lower skill, sometimes settle for one of the next-best moves.
  if (noise > 0 && scored.length > 1 && rng() < noise) {
    const pool = scored.slice(0, Math.min(4, scored.length));
    return pool[1 + Math.floor(rng() * (pool.length - 1))].action;
  }
  return scored[0].action;
}

// ---- Moves ------------------------------------------------------------------------

function legalMoves(state: GameState, me: PlayerState): Action[] {
  const moves: Action[] = [];
  const bonus = bonuses(me);
  const available = COLORS.filter((c) => state.bank[c] > 0);

  // Take three different (or as many different as remain).
  const k = Math.min(3, available.length);
  const combos = (from: Color[], n: number): Color[][] =>
    n === 0 ? [[]] : from.flatMap((c, i) => combos(from.slice(i + 1), n - 1).map((rest) => [c, ...rest]));
  if (k > 0) for (const colors of combos(available, k)) moves.push({ type: 'take', colors });
  // Take two of a kind.
  for (const c of COLORS) if (state.bank[c] >= 4) moves.push({ type: 'take', colors: [c, c] });

  // Buy anything affordable, on the table or in reserve.
  for (const card of [...[3, 2, 1].flatMap((l) => state.board[l as 1 | 2 | 3]), ...me.reserved]) {
    if (card && paymentFor(me.tokens, bonus, card)) moves.push({ type: 'buy', cardId: card.id });
  }

  // Reserve a card from the table.
  if (me.reserved.length < MAX_RESERVED) {
    for (const card of [3, 2, 1].flatMap((l) => state.board[l as 1 | 2 | 3])) if (card) moves.push({ type: 'reserve', cardId: card.id });
  }
  if (!moves.length) moves.push({ type: 'pass' });
  return moves;
}

function snapOf(p: PlayerState): Snap {
  return { tokens: { ...p.tokens }, bonus: bonuses(p), points: points(p), reserved: [...p.reserved], cards: p.cards.length, gone: new Set() };
}

/** The position after `action`, without running the full rules (no deck draws, no turn change). */
function apply(ctx: Ctx, s: Snap, action: Action, me: PlayerState): Snap {
  const next: Snap = { ...s, tokens: { ...s.tokens }, bonus: { ...s.bonus }, reserved: [...s.reserved], gone: new Set(s.gone) };
  switch (action.type) {
    case 'take': {
      for (const c of action.colors) next.tokens[c]++;
      // Over the limit: shed the least useful resources, as the bot would.
      let excess = tokenTotal(next.tokens) - MAX_TOKENS;
      while (excess-- > 0) {
        const drop = COLORS.filter((c) => next.tokens[c] > 0).sort((a, b) => ctx.demand[a] - ctx.demand[b])[0];
        if (!drop) break;
        next.tokens[drop]--;
      }
      break;
    }
    case 'buy': {
      const card = [...ctx.board, ...me.reserved].find((c) => c.id === action.cardId)!;
      const pay = paymentFor(next.tokens, next.bonus, card)!;
      for (const c of [...COLORS, 'gold'] as const) next.tokens[c] -= pay[c];
      next.bonus[card.color]++;
      next.points += card.points;
      next.cards++;
      next.reserved = next.reserved.filter((c) => c.id !== card.id);
      next.gone.add(card.id);
      // A noble house that now qualifies joins at the end of the turn.
      const noble = ctx.nobles.find((n) => COLORS.every((c) => next.bonus[c] >= n.req[c]));
      if (noble) next.points += noble.points;
      break;
    }
    case 'reserve': {
      const card = ctx.board.find((c) => c.id === action.cardId)!;
      next.reserved.push(card);
      next.gone.add(card.id);
      if (ctx.state.bank.gold > 0) next.tokens.gold++;
      if (tokenTotal(next.tokens) > MAX_TOKENS) {
        const drop = COLORS.filter((c) => next.tokens[c] > 0).sort((a, b) => ctx.demand[a] - ctx.demand[b])[0];
        if (drop) next.tokens[drop]--;
      }
      break;
    }
    default:
      break;
  }
  return next;
}

// ---- Evaluation -------------------------------------------------------------------

function demandOf(board: Card[], reserved: Card[], bonus: Gems): Gems {
  const d = emptyTokens() as unknown as Gems;
  for (const card of [...board, ...reserved]) {
    const weight = 1 + card.points * 0.5;
    for (const c of COLORS) d[c] += Math.max(0, card.cost[c] - bonus[c]) * weight;
  }
  return d;
}

/** Resources still missing for `card`, after discounts, held resources and gold. */
function missing(s: Snap, card: Card): number {
  let short = 0;
  for (const c of COLORS) short += Math.max(0, card.cost[c] - s.bonus[c] - s.tokens[c]);
  return Math.max(0, short - s.tokens.gold);
}

/** What owning one more discount of `color` is worth: engine early, noble progress always. */
function discountWorth(ctx: Ctx, s: Snap, color: Color): number {
  let worth = 1.6 * ctx.early + 0.25;
  for (const n of ctx.nobles) if (n.req[color] > s.bonus[color]) worth += 1.1;
  const totalDemand = COLORS.reduce((a, c) => a + ctx.demand[c], 0) || 1;
  worth += 2.2 * ctx.early * (ctx.demand[color] / totalDemand) * COLORS.length;
  return worth;
}

function evaluate(ctx: Ctx, s: Snap, me: PlayerState): number {
  let v = s.points * W.points * ctx.urgency;
  if (s.points >= WIN_POINTS) v += 40;

  // Noble houses: reward closing the gap, more so near the end.
  for (const n of ctx.nobles) {
    let need = 0;
    let total = 0;
    for (const c of COLORS) {
      need += Math.max(0, n.req[c] - s.bonus[c]);
      total += n.req[c];
    }
    const progress = 1 - need / total;
    v += W.nobles * progress * progress * (need <= 2 ? 1.4 : 1);
  }

  // The best few cards on offer, valued by what they give and how soon they are within reach.
  const offers = [...ctx.board.filter((c) => !s.gone.has(c.id)), ...s.reserved].map((card) => {
    const turns = Math.ceil(missing(s, card) / 2.6);
    const worth = card.points * W.points * ctx.urgency + discountWorth(ctx, s, card.color);
    return worth / Math.pow(turns + 1, 1.25);
  });
  offers.sort((a, b) => b - a);
  v += (offers[0] ?? 0) * W.offer1 + (offers[1] ?? 0) * W.offer2 + (offers[2] ?? 0) * W.offer3;

  // Discounts already owned keep paying off.
  for (const c of COLORS) v += s.bonus[c] * (W.ownedBase + W.ownedEarly * ctx.early);

  // Resources in hand, gold being the most flexible; reserved cards tie up a slot.
  v += tokenTotal(s.tokens) * W.tokens + s.tokens.gold * W.gold;
  v -= Math.max(0, s.reserved.length - me.reserved.length) * W.reservePenalty;
  return v;
}

/** Reserving a valuable card an opponent could buy next turn denies it to them. */
function blockBonus(ctx: Ctx, me: PlayerState, action: Action): number {
  if (action.type !== 'reserve') return 0;
  const card = ctx.board.find((c) => c.id === action.cardId);
  if (!card || card.points < 3) return 0;
  const threatened = ctx.state.players.some((p) => p.id !== me.id && paymentFor(p.tokens, bonuses(p), card));
  return threatened ? card.points * 1.2 * ctx.urgency : 0;
}
