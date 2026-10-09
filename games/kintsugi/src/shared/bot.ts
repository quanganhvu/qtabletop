// Bots. A bot tries every legal move on a copy of the game and judges what its
// side of the table would then be worth: points already scored, the tiles its
// full work rows will set at the end of the round (and the lines they join),
// half-built rows weighed by how likely they are to fill, progress towards the
// end-game bonuses, and the broken tiles on its floor. The strongest bots also
// look one move ahead: what the next player could make of what is left.
// Bots see only public information, never the order of the bag.

import {
  BONUS, SIZE, floorPenalty, legalMoves, tilesAt, placementPoints, take, wallColumn,
  type Action, type Color, type GameState,
} from './game';

export interface BotStyle {
  /** Chance of settling for one of the next-best moves instead of the best. */
  noise: number;
  /** How many of the best moves a noisy pick chooses from. */
  spread: number;
  /** Weigh what the next player can do with what's left. */
  lookahead: boolean;
}

export function chooseBotAction(state: GameState, botId: string, rng: () => number, style: BotStyle): Action {
  const me = state.players.findIndex((p) => p.id === botId);
  if (me === -1 || me !== state.current) throw new Error('Not this bot’s turn');
  const next = (me + 1) % state.players.length;

  const scored = legalMoves(state, me).map((action) => {
    const after = simulate(state, action);
    let value = worth(after, me) - worth(state, me);
    if (style.lookahead && hasTiles(after)) {
      after.current = next;
      const base = worth(after, next);
      let best = 0;
      for (const reply of legalMoves(after, next)) best = Math.max(best, worth(simulate(after, reply), next) - base);
      value -= 0.45 * best;
    }
    return { action, value };
  });
  scored.sort((a, b) => b.value - a.value);
  if (style.noise > 0 && rng() < style.noise) {
    return scored[Math.floor(rng() * Math.min(style.spread, scored.length))].action;
  }
  const best = scored.filter((s) => s.value >= scored[0].value - 1e-9);
  return best[Math.floor(rng() * best.length)].action;
}

const hasTiles = (g: GameState) => g.center.length > 0 || g.kilns.some((k) => k.length > 0);

/** A throwaway copy of the game with the move made. */
function simulate(g: GameState, action: Action): GameState {
  const copy: GameState = {
    ...g,
    kilns: g.kilns.map((k) => [...k]),
    center: [...g.center],
    lid: [],
    players: g.players.map((p) => ({ ...p, lines: p.lines.map((l) => ({ ...l })), floor: [...p.floor] })),
    log: [],
    events: [],
  };
  take(copy, action);
  return copy;
}

/** What player `p`'s side of the table is worth, as points, if the round were to end soon. */
export function worth(g: GameState, p: number): number {
  const me = g.players[p];
  const wall = me.wall.map((row) => [...row]);
  let value = me.score;

  // Full rows set their tiles at the end of the round, top to bottom.
  me.lines.forEach((line, r) => {
    if (!line.color || line.count < r + 1) return;
    const c = wallColumn(r, line.color);
    wall[r][c] = true;
    value += placementPoints(wall, r, c) + bonusProgress(wall, r, c, line.color);
  });

  // Half-built rows: worth something if they are likely to fill, a burden if not.
  const offered = new Map<Color, number>();
  for (const src of [...g.kilns.map((_, i) => i), 'center' as const]) {
    for (const c of tilesAt(g, src)) offered.set(c, (offered.get(c) ?? 0) + 1);
  }
  me.lines.forEach((line, r) => {
    if (!line.color || line.count >= r + 1) return;
    const need = r + 1 - line.count;
    const c = wallColumn(r, line.color);
    const chance = (offered.get(line.color) ?? 0) >= need ? 0.55 : 0.3;
    wall[r][c] = true;
    const gain = placementPoints(wall, r, c) + bonusProgress(wall, r, c, line.color);
    wall[r][c] = false;
    value += chance * gain - 0.25 * need;
  });

  value -= floorPenalty(me.floor.length);
  // Starting the next round is worth a little.
  if (me.floor.includes('first')) value += 0.6;
  return value;
}

/** How much nearer the end-game bonuses a tile at (r, c) brings the wall (already set in `wall`). */
function bonusProgress(wall: boolean[][], r: number, c: number, color: Color): number {
  const curve = (n: number) => (n / SIZE) ** 2;
  const rowN = wall[r].filter(Boolean).length;
  const colN = wall.filter((row) => row[c]).length;
  const colorN = wall.filter((row, i) => row[wallColumn(i, color)]).length;
  return 0.6 * (
    BONUS.row * (curve(rowN) - curve(rowN - 1))
    + BONUS.column * (curve(colN) - curve(colN - 1))
    + BONUS.color * (curve(colorN) - curve(colorN - 1))
  );
}
