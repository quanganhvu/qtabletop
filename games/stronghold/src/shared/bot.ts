// A simple greedy Splendor bot. It only looks at public information plus its
// own reserved cards (never the deck order), and always returns a legal action
// for the current phase.

import {
  COLORS, MAX_RESERVED, MAX_TOKENS, bonuses, emptyTokens, meetsNoble, paymentFor, tokenTotal,
  type Action, type Card, type Color, type Gems, type GameState, type PlayerState, type TokenColor, type Tokens,
} from './game';


export function chooseBotAction(state: GameState, botId: string, rng: () => number = Math.random): Action {
  const me = state.players.find((p) => p.id === botId);
  if (!me) throw new Error('Bot is not in this game');
  const bonus = bonuses(me);

  if (state.phase === 'noble') {
    // Any eligible noble is worth the same 3 points.
    const noble = state.nobles.find((n) => meetsNoble(bonus, n))!;
    return { type: 'noble', nobleId: noble.id };
  }

  const target = pickTarget(state, me, bonus);

  if (state.phase === 'discard') return { type: 'discard', tokens: chooseDiscard(state, me, bonus, target) };

  // 1. Buy the most valuable card we can afford, preferring not to burn gold.
  const affordable = candidates(state, me).filter((c) => paymentFor(me.tokens, bonus, c));
  if (affordable.length) {
    const best = maxBy(affordable, (c) => cardValue(state, me, bonus, c) - paymentFor(me.tokens, bonus, c)!.gold * 0.5);
    return { type: 'buy', cardId: best.id };
  }

  const canReserve = me.reserved.length < MAX_RESERVED;
  const onBoard = boardCards(state);

  // 2. Reserve for a gold crown when it is the smart play.
  if (canReserve) {
    const reservePick = smartReserve(state, me, bonus, target, onBoard);
    if (reservePick) return { type: 'reserve', cardId: reservePick.id };
  }

  // 3. Collect gems toward the target card, unless that would just mean discarding.
  const take = chooseTake(state, me, bonus, target, rng);
  const room = MAX_TOKENS - tokenTotal(me.tokens);
  if (take && (take.colors.length <= room || !canReserve)) return take;

  // 4. Hands full: reserve the target (or the best card on the board) for a gold.
  if (canReserve) {
    const pick = target && onBoard.includes(target) ? target : onBoard.length ? maxBy(onBoard, (c) => cardValue(state, me, bonus, c)) : null;
    if (pick) return { type: 'reserve', cardId: pick.id };
  }
  return take ?? { type: 'pass' };
}

/**
 * When to reserve instead of taking resources. Simulated games showed reserving
 * just to finish a card early is a losing trade (three resources usually do the
 * same job), so the bot reserves only when it clearly pays:
 * - the target is one resource short and that resource is gone from the
 *   treasury, so only a gold crown can complete it;
 * - an opponent could buy a valuable card next turn that we cannot, so we take it first.
 */
function smartReserve(state: GameState, me: PlayerState, bonus: Gems, target: Card | null, onBoard: Card[]): Card | null {
  if (target && onBoard.includes(target) && state.bank.gold > 0) {
    const { total, need } = shortfall(me, bonus, target);
    const onlyGoldHelps = COLORS.some((c) => need[c] > 0 && state.bank[c] === 0);
    if (total === 1 && onlyGoldHelps) return target;
  }
  const opponents = state.players.filter((p) => p.id !== me.id);
  const threats = onBoard.filter((c) => c.points >= 3 && opponents.some((p) => paymentFor(p.tokens, bonuses(p), c)));
  if (threats.length) {
    const worst = maxBy(threats, (c) => c.points * 10 - shortfall(me, bonus, c).total);
    if (worst.points >= 4 || shortfall(me, bonus, worst).total <= 4) return worst;
  }
  return null;
}

function boardCards(state: GameState): Card[] {
  return [3, 2, 1].flatMap((l) => state.board[l as 1 | 2 | 3]).filter((c): c is Card => !!c);
}

function candidates(state: GameState, me: PlayerState): Card[] {
  return [...boardCards(state), ...me.reserved];
}

/** How much the bot wants a card: points, plus progress toward nobles and an early-game engine. */
function cardValue(state: GameState, me: PlayerState, bonus: Gems, card: Card): number {
  let value = card.points * 4;
  for (const noble of state.nobles) {
    if (noble.req[card.color] > bonus[card.color]) value += 1.5;
  }
  if (me.cards.length < 8) value += 1.5; // early on, any discount helps
  return value;
}

/** Gems still missing for a card, after bonuses, held gems and gold. */
function shortfall(me: PlayerState, bonus: Gems, card: Card): { total: number; need: Gems } {
  const need = {} as Gems;
  let total = 0;
  for (const c of COLORS) {
    need[c] = Math.max(0, card.cost[c] - bonus[c] - me.tokens[c]);
    total += need[c];
  }
  return { total: Math.max(0, total - me.tokens.gold), need };
}

function pickTarget(state: GameState, me: PlayerState, bonus: Gems): Card | null {
  const all = candidates(state, me);
  if (!all.length) return null;
  return maxBy(all, (c) => {
    const reservedBoost = me.reserved.includes(c) ? 1 : 0;
    return (cardValue(state, me, bonus, c) + 1 + reservedBoost) / Math.pow(shortfall(me, bonus, c).total + 1, 1.4);
  });
}

/** How much each color is wanted across all cards we might buy. */
function demand(state: GameState, me: PlayerState, bonus: Gems): Gems {
  const d = {} as Gems;
  for (const c of COLORS) d[c] = 0;
  for (const card of candidates(state, me)) {
    for (const c of COLORS) d[c] += Math.max(0, card.cost[c] - bonus[c]);
  }
  return d;
}

function chooseTake(state: GameState, me: PlayerState, bonus: Gems, target: Card | null, rng: () => number): Extract<Action, { type: 'take' }> | null {
  const available = COLORS.filter((c) => state.bank[c] > 0);
  if (!available.length) return null;
  const need = target ? shortfall(me, bonus, target).need : ({} as Partial<Gems>);
  const wanted = COLORS.filter((c) => (need[c] ?? 0) > 0);

  // Exactly one color missing and it needs 2+: grab a pair if the bank allows it.
  if (wanted.length === 1 && need[wanted[0]]! >= 2 && state.bank[wanted[0]] >= 4) {
    return { type: 'take', colors: [wanted[0], wanted[0]] };
  }

  const d = demand(state, me, bonus);
  const priority = (c: Color) => (need[c] ?? 0) * 10 + d[c] + rng() * 0.5;
  const colors = [...available].sort((a, b) => priority(b) - priority(a)).slice(0, Math.min(3, available.length));
  return { type: 'take', colors };
}

function chooseDiscard(state: GameState, me: PlayerState, bonus: Gems, target: Card | null): Partial<Tokens> {
  const discard = emptyTokens();
  const keepNeed = target ? target.cost : null;
  const d = demand(state, me, bonus);
  let excess = tokenTotal(me.tokens) - MAX_TOKENS;
  while (excess > 0) {
    const held = (c: TokenColor) => me.tokens[c] - discard[c];
    const usefulness = (c: TokenColor) => {
      if (c === 'gold') return 1000;
      const stillNeeded = keepNeed ? held(c) <= Math.max(0, keepNeed[c] - bonus[c]) : false;
      return (stillNeeded ? 100 : 0) + d[c];
    };
    const options = (['gold', ...COLORS] as TokenColor[]).filter((c) => held(c) > 0);
    const drop = options.reduce((a, b) => (usefulness(b) < usefulness(a) ? b : a));
    discard[drop]++;
    excess--;
  }
  return discard;
}

function maxBy<T>(items: T[], score: (item: T) => number): T {
  let best = items[0];
  let bestScore = score(best);
  for (const item of items.slice(1)) {
    const s = score(item);
    if (s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}
