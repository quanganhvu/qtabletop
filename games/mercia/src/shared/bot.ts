// Bots. A bot tries every legal placement of its tile, with and without a
// follower on each free feature, on a copy of the game. It scores each result
// by what every player would have if the game ended now plus what their
// unfinished features are likely to be worth, and keeps the move that leaves
// it furthest ahead. Bots see only public information: the board, the scores
// and the tile in hand, never the order of the deck.

import {
  allFeatures, farmCities, lay, legalSpots, majority, meepleOptions,
  type Action, type GameState,
} from './game';

export interface BotStyle {
  /** Chance of settling for one of the next-best moves instead of the best. */
  noise: number;
  /** How many of the best moves a noisy pick chooses from. */
  spread: number;
  /** Ignore rivals' gains: play only for its own score. */
  selfish: boolean;
}

export function chooseBotAction(state: GameState, botId: string, rng: () => number, style: BotStyle): Action {
  const me = state.players.findIndex((p) => p.id === botId);
  if (me === -1 || state.players[me].id !== state.players[state.current].id) throw new Error('Not this bot’s turn');
  const tile = state.tile!;
  const deckLeft = state.deck.length; // public: everyone sees how many tiles are left

  const scored: { action: Action; value: number }[] = [];
  for (const { x, y, rots } of legalSpots(state.board, tile)) {
    for (const rot of rots) {
      const spots: (number | null)[] = [null];
      if (state.players[me].meeples > 0) spots.push(...meepleOptions(state.board, tile, x, y, rot));
      for (const meeple of spots) {
        const action: Action = { type: 'place', x, y, rot, meeple };
        scored.push({ action, value: judge(simulate(state, action), me, deckLeft, style.selfish) });
      }
    }
  }
  scored.sort((a, b) => b.value - a.value);
  if (style.noise > 0 && rng() < style.noise) {
    return scored[Math.floor(rng() * Math.min(style.spread, scored.length))].action;
  }
  // Break exact ties at random so bots don't always build in the same direction.
  const best = scored.filter((s) => s.value >= scored[0].value - 1e-9);
  return best[Math.floor(rng() * best.length)].action;
}

/** A throwaway copy of the game with the move made. */
function simulate(g: GameState, action: Action): GameState {
  const copy: GameState = {
    ...g,
    board: { ...g.board },
    players: g.players.map((p) => ({ ...p, breakdown: { ...p.breakdown } })),
    log: [],
    events: [],
  };
  lay(copy, action);
  return copy;
}

/** How good a position is for player `me`. */
function judge(g: GameState, me: number, deckLeft: number, selfish: boolean): number {
  const worth = projected(g, deckLeft);
  if (selfish) return worth[me];
  const others = worth.filter((_, i) => i !== me);
  const best = Math.max(...others);
  const mean = others.reduce((a, b) => a + b, 0) / others.length;
  return worth[me] - 0.6 * best - 0.4 * mean;
}

/** Each player's score plus the expected value of their unfinished features and followers in hand. */
function projected(g: GameState, deckLeft: number): number[] {
  const n = g.players.length;
  // Turns left for each player, roughly: how much time there is to finish things.
  const turns = deckLeft / n;
  const soon = (need: number) => Math.max(0, Math.min(1, turns / Math.max(1, need)));
  const worth = g.players.map((p) => p.score);
  const { features, of } = allFeatures(g.board);

  const cityChance = (open: number) => Math.max(0.1, 0.9 - 0.18 * (open - 1)) * soon(open + 1);

  for (const feat of features) {
    if (!feat.meeples.length) continue;
    let value = 0;
    switch (feat.kind) {
      case 'road':
        value = feat.tiles.length + 0.6 * soon(feat.open * 2); // finishing it frees the follower
        break;
      case 'city': {
        const base = feat.tiles.length + feat.pennants;
        value = base * (1 + cityChance(feat.open)) + 1.5 * cityChance(feat.open);
        break;
      }
      case 'cloister': {
        const around = 8 - feat.open;
        value = 1 + around + feat.open * 0.85 * soon(feat.open * 1.5);
        break;
      }
      case 'field':
        for (const c of farmCities(g.board, feat, features, of)) {
          const city = features[c];
          value += city.open === 0 ? 3 : 3 * 0.75 * cityChance(city.open);
        }
        // A farmer never comes back: early on that costs more than the farm may bring.
        value *= 0.9;
        break;
    }
    for (const p of majority(feat)) worth[p] += value;
  }

  // Followers in hand are options on future points, worth less as the land fills up.
  for (let p = 0; p < n; p++) {
    const m = g.players[p].meeples;
    const handy = Math.min(m, 3) * 2.2 + Math.max(0, m - 3) * 0.6;
    worth[p] += handy * soon(6);
  }
  return worth;
}
