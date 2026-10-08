// Harbour bots. Every candidate move is tried on a copy of the state with the
// real rules engine, then the resulting position is scored, so a bot can only
// ever play legal moves. The score is the bot's end-game wealth plus a
// valuation of goods (worth less as the end approaches) and a food outlook.

import {
  BASIC, GOODS, OFFER_GOODS, SHIP_VALUE, autoFuel, bestFood, foodIn,
  type Bag, type Good,
} from './goods';
import { SHIP_ENERGY, SHIP_INFO, TURNS_PER_ROUND, building } from './data';
import {
  applyAction, buildingsOf, cannotEnter, foodDemand, marketLimit, stackTops, wealth,
  type Action, type GameState, type PlayerState, type UseChoice,
} from './game';

/** What a bot thinks each good is worth while the game is young. */
const WORTH: Record<Good, number> = {
  franc: 1,
  fish: 1, wood: 1.4, clay: 1.3, iron: 2.5, grain: 1, cattle: 2.2, coal: 2.5, hides: 1.6,
  smokedFish: 2.3, charcoal: 2.4, bricks: 2.7, steel: 8.5, bread: 2.6, meat: 3, coke: 6.5, leather: 4.2,
};

/** Rounds of play left, counting the current round's remaining turns. */
function roundsLeft(state: GameState): number {
  if (state.phase === 'final') return 0;
  return state.rounds.length - state.round + (TURNS_PER_ROUND - state.step) / TURNS_PER_ROUND;
}

export function evaluate(state: GameState, playerId: string): number {
  const p = state.players.find((x) => x.id === playerId)!;
  const w = wealth(state, p);
  if (state.phase === 'over') return w.total;
  const left = roundsLeft(state);
  // Goods only count at the end once turned into francs, so their worth fades out.
  const goodsWeight = Math.max(0.05, Math.min(1, left / 4));
  let goods = 0;
  for (const g of GOODS) if (g !== 'franc') goods += p.goods[g] * Math.max(WORTH[g] * goodsWeight, SHIP_VALUE[g] * 0.25);

  // Food outlook: what this round's feeding will cost beyond what's in hand.
  let food = 0;
  if (state.phase === 'turn' || state.phase === 'feed') {
    const due = state.phase === 'feed' ? (state.feeding[p.id] ?? 0) : foodDemand(state, p);
    const short = Math.max(0, due - foodIn(p.goods));
    food -= short * (0.9 + state.step / TURNS_PER_ROUND);
  }
  // Ships keep feeding the crew every round to come.
  const shipFoodValue = p.ships.reduce((s, ship) => s + SHIP_INFO[ship.kind].food, 0) * Math.min(left, 6) * 0.35;
  // Owning buildings saves entry fees and earns them from others.
  const usable = buildingsOf(state, p.id).filter((id) => building(id).use.kind !== 'none').length;
  const engine = usable * Math.min(left, 5) * 0.45;

  return w.total + goods + food + shipFoodValue + engine;
}

// ---- Candidate moves ----------------------------------------------------------

function topWorth(p: PlayerState, kinds: readonly Good[], n: number): Bag {
  const picks = [...kinds].sort((a, b) => WORTH[b] - WORTH[a]).slice(0, n);
  return Object.fromEntries(picks.map((g) => [g, 1]));
}

function useChoices(state: GameState, p: PlayerState, id: string): UseChoice[] {
  const u = building(id).use;
  const have = p.goods;
  switch (u.kind) {
    case 'none':
      return [];
    case 'gain':
    case 'court':
      return [{}];
    case 'convert': {
      const max = Math.min(u.max ?? Infinity, have[u.from]);
      if (max < 1) return [];
      const ns = new Set([max, Math.ceil(max / 2), Math.min(max, 2)]);
      return [...ns].map((n) => ({ n }));
    }
    case 'build': {
      const tops = stackTops(state);
      const singles = tops.map((t) => ({ build: [t] }));
      if (u.count === 1) return singles;
      const pairs: UseChoice[] = [];
      for (const a of tops) {
        // The second building may be another top, or the one revealed under the first.
        const under = state.stacks.find((s) => s[0] === a)?.[1];
        for (const b of [...tops, under]) if (b && b !== a) pairs.push({ build: [a, b] });
      }
      return [...singles, ...pairs];
    }
    case 'wharf':
      return state.harbour.map((s) => ({ shipId: s.id }));
    case 'shipping': {
      const fleet = p.ships.map((s) => SHIP_INFO[s.kind].capacity).filter((c) => c > 0).sort((a, b) => b - a);
      const out: UseChoice[] = [];
      for (let k = 1; k <= fleet.length; k++) {
        const fuel = autoFuel(have, SHIP_ENERGY * k);
        if (!fuel) break;
        let room = fleet.slice(0, k).reduce((a, b) => a + b, 0);
        const cargo: Bag = {};
        const order = GOODS.filter((g) => g !== 'franc' && SHIP_VALUE[g] > 0).sort((a, b) => SHIP_VALUE[b] - SHIP_VALUE[a]);
        for (const g of order) {
          const n = Math.min(room, have[g] - (fuel[g] ?? 0));
          if (n > 0) {
            cargo[g] = n;
            room -= n;
          }
        }
        if (Object.keys(cargo).length) out.push({ ships: k, goods: cargo, fuel });
      }
      return out;
    }
    case 'market':
      return [{ goods: topWorth(p, BASIC, marketLimit(state, p.id)) }];
    case 'joinery':
      return have.wood >= 1 ? [{ n: Math.min(3, have.wood) }, { n: 1 }] : [];
    case 'ironworks':
      return autoFuel(have, 6) ? [{ n: 1 }, { n: 0 }] : [{ n: 0 }];
    case 'office': {
      const spare = GOODS.filter((g) => g !== 'franc' && have[g] > 0).sort((a, b) => WORTH[a] - WORTH[b]);
      const out: UseChoice[] = [];
      const give: Bag = {};
      let left = 4;
      for (const g of spare) {
        const n = Math.min(left, have[g]);
        give[g] = n;
        left -= n;
        if (!left) break;
      }
      if (!left) out.push({ target: 'steel', goods: give });
      if (spare.length) out.push({ target: 'bricks', goods: { [spare[0]]: 1 } }, { target: 'leather', goods: { [spare[0]]: 1 } });
      return out;
    }
  }
}

export function mainCandidates(state: GameState, botId: string): Action[] {
  const p = state.players.find((x) => x.id === botId)!;
  const out: Action[] = [];
  if (state.phase === 'turn') {
    for (const g of OFFER_GOODS) if (state.offers[g] > 0) out.push({ type: 'take', good: g });
  }
  for (const id of Object.keys(state.owner)) {
    if (cannotEnter(state, botId, id)) continue;
    for (const choice of useChoices(state, p, id)) out.push({ type: 'use', buildingId: id, choice });
  }
  return out;
}

function tryAction(state: GameState, botId: string, action: Action): GameState | null {
  const sim = structuredClone(state);
  try {
    applyAction(sim, botId, action);
    return sim;
  } catch {
    return null;
  }
}

/** Francs worth keeping in hand: the food still due this round, plus a little. */
function reserve(state: GameState, p: PlayerState): number {
  const due = state.phase === 'turn' ? foodDemand(state, p) : 0;
  const otherFood = foodIn(p.goods) - p.goods.franc;
  return Math.max(0, due - otherFood) + 2;
}

/** Buying, selling and loans around the main action. Returns null when there's nothing worth doing. */
function extraAction(state: GameState, botId: string): Action | null {
  const p = state.players.find((x) => x.id === botId)!;
  const left = roundsLeft(state);
  const keep = reserve(state, p);
  const francs = p.goods.franc;

  // Loans cost 7 at the end but only 5 to repay now.
  if (p.loans > 0 && francs - 5 >= keep) return { type: 'repay' };
  if (state.phase === 'final' || left < 1) return null;

  // Ships feed the crew every round and keep their value.
  const ships = [...state.harbour].filter((s) => SHIP_INFO[s.kind].food > 0).sort((a, b) => SHIP_INFO[b.kind].food - SHIP_INFO[a.kind].food);
  for (const ship of ships) {
    if (francs - SHIP_INFO[ship.kind].value >= keep) return { type: 'buyShip', shipId: ship.id };
  }

  // Useful buildings are worth their price and then some.
  const forSale = [...Object.keys(state.owner).filter((id) => state.owner[id] === 'town'), ...stackTops(state)]
    .map(building)
    .filter((b) => !b.start && b.use.kind !== 'none' && b.value >= 6)
    .sort((a, b) => b.value - a.value);
  for (const b of forSale) {
    if (left > 3 && francs - b.value >= keep + 3) return { type: 'buyBuilding', buildingId: b.id };
  }
  return null;
}

/** Picks a move for a bot. `noise` (0–1) makes it sometimes settle for a lesser move. */
export function chooseBotAction(state: GameState, botId: string, rng: () => number = Math.random, noise = 0): Action {
  const p = state.players.find((x) => x.id === botId)!;

  if (state.phase === 'feed') {
    return { type: 'feed', payment: bestFood(p.goods, state.feeding[botId] ?? 0) };
  }

  if (!state.mainDone) {
    const scored: { action: Action; score: number }[] = [];
    for (const action of mainCandidates(state, botId)) {
      const after = tryAction(state, botId, action);
      if (after) scored.push({ action, score: evaluate(after, botId) });
    }
    if (scored.length) {
      scored.sort((a, b) => b.score - a.score);
      const pickFrom = noise > 0 && rng() < noise ? Math.min(scored.length, 4) : 1;
      return scored[Math.floor(rng() * pickFrom)].action;
    }
  }

  const extra = extraAction(state, botId);
  if (extra && tryAction(state, botId, extra)) return extra;
  return { type: 'endTurn' };
}
