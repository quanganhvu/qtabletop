// Skyline bot. It only looks at public information plus its own tiles (never the bag or
// other hands), and always returns a legal action for the current phase.
//
// It plays by looking one step ahead: each playable tile is tried on a copy of the game and
// scored by how much richer it leaves the bot compared with its opponents.

import {
  CHAINS, MAX_BUY, SAFE_SIZE, actorIndex, applyAction, bonusesFor, canDeclareEnd, chainSizes, priceFor, tileStatus,
  type Action, type Chain, type GameState, type PlayerState, type Shares,
} from './game';

/** `noise`: chance of settling for a lesser move; 1 plays almost at random. */
export function chooseBotAction(state: GameState, botId: string, rng: () => number = Math.random, noise = 0): Action {
  const me = state.players[actorIndex(state)];
  if (me.id !== botId) throw new Error("Not this bot's turn");
  const sloppy = rng() < noise;

  switch (state.phase) {
    case 'place': {
      const tiles = me.tiles.filter((t) => tileStatus(state.board, t) === 'ok');
      const scored = tiles.map((tile) => ({ tile, score: scorePlacement(state, me.id, tile) })).sort((a, b) => b.score - a.score);
      const pick = sloppy ? scored[Math.floor(rng() * scored.length)] : scored[0];
      return { type: 'place', tile: pick.tile };
    }
    case 'found': {
      // The founder share is worth most in a pricey chain.
      const options = state.pending!.options;
      return { type: 'found', chain: sloppy ? options[Math.floor(rng() * options.length)] : bestFounding(options) };
    }
    case 'survivor':
      return { type: 'survivor', chain: bestSurvivor(state, me) };
    case 'merge':
      return disposal(state, me, sloppy);
    case 'buy':
      return chooseBuy(state, me, sloppy, rng);
    default:
      throw new Error('The game is over');
  }
}

function bestFounding(options: Chain[]): Chain {
  return options.reduce((a, b) => (priceFor(b, 2) > priceFor(a, 2) ? b : a));
}

/** Keep alive the chain we own the most of. */
function bestSurvivor(state: GameState, me: PlayerState): Chain {
  return state.pending!.options.reduce((a, b) => (me.shares[b] > me.shares[a] ? b : a));
}

function disposal(state: GameState, me: PlayerState, sloppy: boolean): Action {
  const m = state.merger!;
  const defunct = m.defuncts[0];
  const held = me.shares[defunct];
  const sizes = chainSizes(state.board);
  const defunctPrice = priceFor(defunct, sizes[defunct]);
  const merged = sizes[m.survivor] + m.defuncts.reduce((n, c) => n + sizes[c], 0) + 1;
  const survivorPrice = priceFor(m.survivor, merged);
  let trade = 0;
  if (!sloppy && survivorPrice > defunctPrice * 1.6) trade = Math.min(Math.floor(held / 2), state.bank[m.survivor]) * 2;
  return { type: 'dispose', sell: held - trade, trade };
}

/** Rough worth: cash, shares at today's price, and a share of the bonuses you'd collect if chains merged now. */
function worth(state: GameState, p: PlayerState): number {
  const sizes = chainSizes(state.board);
  let total = p.cash;
  for (const c of CHAINS) {
    if (!sizes[c]) continue;
    const price = priceFor(c, sizes[c]);
    total += p.shares[c] * price;
    const bonus = bonusesFor(state.players, c, price).find((b) => b.id === p.id)?.amount ?? 0;
    // Safe chains won't merge, so their bonus only arrives at the end of the game.
    total += bonus * (sizes[c] >= SAFE_SIZE ? 0.4 : 0.6);
  }
  return total;
}

function standing(state: GameState, botId: string): number {
  const me = state.players.find((p) => p.id === botId)!;
  const others = state.players.filter((p) => p.id !== botId).map((p) => worth(state, p));
  return worth(state, me) - Math.max(...others) * 0.5 - (others.reduce((a, b) => a + b, 0) / others.length) * 0.5;
}

/** Plays the tile on a copy of the game, resolving any choices simply, and scores the result. */
function scorePlacement(state: GameState, botId: string, tile: number): number {
  const sim = structuredClone(state);
  try {
    applyAction(sim, botId, { type: 'place', tile });
    for (let guard = 0; guard < 50 && sim.phase !== 'buy' && sim.phase !== 'place' && sim.phase !== 'over'; guard++) {
      const actor = sim.players[actorIndex(sim)];
      if (sim.phase === 'found') applyAction(sim, actor.id, { type: 'found', chain: bestFounding(sim.pending!.options) });
      else if (sim.phase === 'survivor') applyAction(sim, actor.id, { type: 'survivor', chain: bestSurvivor(sim, actor) });
      else applyAction(sim, actor.id, disposal(sim, actor, false));
    }
  } catch {
    return -Infinity;
  }
  return standing(sim, botId);
}

function chooseBuy(state: GameState, me: PlayerState, sloppy: boolean, rng: () => number): Action {
  if (canDeclareEnd(state.board) && wouldWin(state, me.id)) return { type: 'buy', shares: {}, end: true };

  const sizes = chainSizes(state.board);
  const shares = { ...me.shares };
  const bank = { ...state.bank };
  const order: Partial<Shares> = {};
  let cash = me.cash;
  // Keep a little cash for later turns, more so early on.
  const reserve = state.turn < state.players.length * 4 ? 400 : 0;

  for (let i = 0; i < MAX_BUY; i++) {
    let best: Chain | null = null;
    let bestScore = 0;
    for (const c of CHAINS) {
      const price = priceFor(c, sizes[c]);
      if (!sizes[c] || !bank[c] || price > cash - reserve) continue;
      const score = sloppy ? rng() : buyScore(state, me.id, shares, c, price, sizes[c]);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) break;
    const price = priceFor(best, sizes[best]);
    shares[best]++;
    bank[best]--;
    cash -= price;
    order[best] = (order[best] ?? 0) + 1;
  }
  return { type: 'buy', shares: order };
}

/** How much one more share in `chain` improves our bonus position, against what it costs. */
function buyScore(state: GameState, botId: string, shares: Shares, chain: Chain, price: number, size: number): number {
  const holders = state.players.map((p) => (p.id === botId ? { id: p.id, shares } : p));
  const bonusNow = bonusesFor(holders, chain, price).find((b) => b.id === botId)?.amount ?? 0;
  const after = holders.map((p) => (p.id === botId ? { id: p.id, shares: { ...shares, [chain]: shares[chain] + 1 } } : p));
  const bonusAfter = bonusesFor(after, chain, price).find((b) => b.id === botId)?.amount ?? 0;
  // Bonuses only pay out if someone else's shares don't overtake ours first, so discount them.
  const gain = (bonusAfter - bonusNow) * 0.35;
  // Small chains still have room to grow, which lifts the price.
  const growth = size < SAFE_SIZE ? 80 : 20;
  return gain + growth - price * 0.12;
}

function wouldWin(state: GameState, botId: string): boolean {
  const sim = structuredClone(state);
  applyAction(sim, botId, { type: 'buy', shares: {}, end: true });
  return sim.results!.winners.includes(botId);
}
