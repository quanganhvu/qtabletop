// Pure rules engine for a Le Havre-style harbour game, shared by the server
// (authoritative) and the client (which simulates moves for previews). The
// server mutates a GameState only through applyAction(); clients receive a
// copy via viewFor() that hides the supply chits nobody has sailed to yet.

import {
  BASIC, FOOD_GOODS, FUEL_GOODS, GOODS, OFFER_GOODS, SHIP_VALUE, UPGRADE_OF,
  autoFood, autoFuel, compact, emptyGoods, energyIn, foodIn, hasAll, isGood,
  type Bag, type BasicGood, type Good, type Goods, type OfferGood,
} from './goods';
import {
  BUILDINGS, LOAN_AMOUNT, LOAN_PENALTY, LOAN_REPAY, SHIP_ENERGY, SHIP_INFO, START_GOODS, START_OFFERS,
  SUPPLY_CHITS, TURNS_PER_ROUND, building, roundCards,
  type BuildingDef, type Icon, type RoundCard, type ShipKind, type SupplyChit,
} from './data';
import { GOOD_NAMES } from './theme';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
export const TOWN = 'town';

export class RuleError extends Error {}

export interface Ship {
  id: string;
  kind: ShipKind;
}

export interface PlayerState {
  id: string;
  name: string;
  goods: Goods;
  loans: number;
  ships: Ship[];
  /** The building this player's person stands in (persons stay put until they move). */
  at: string | null;
}

export type Phase = 'turn' | 'feed' | 'final' | 'over';

export interface Wealth {
  francs: number;
  buildings: number;
  bonus: number;
  ships: number;
  loans: number;
  total: number;
}

export interface Results {
  ranking: ({ id: string; name: string } & Wealth)[];
  winners: string[];
}

export type GameEvent = { seq: number; playerId: string } & (
  | { kind: 'supply'; goods: OfferGood[]; interest: boolean }
  | { kind: 'take'; good: OfferGood; amount: number }
  | { kind: 'use'; buildingId: string; gained: Bag; spent: Bag; built: string[]; ship: ShipKind | null }
  | { kind: 'buyBuilding'; buildingId: string; price: number }
  | { kind: 'sellBuilding'; buildingId: string; price: number }
  | { kind: 'buyShip'; ship: ShipKind; price: number }
  | { kind: 'sellShip'; ship: ShipKind; price: number }
  | { kind: 'loan' }
  | { kind: 'repay' }
  | { kind: 'pass' }
  | { kind: 'fed'; paid: Bag; loans: number }
  | { kind: 'roundEnd'; round: number; food: number; harvest: boolean }
  | { kind: 'townBuilds'; buildingId: string }
  | { kind: 'final' }
);

type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'seq'> : never) : never;

export interface GameState {
  players: PlayerState[];
  offers: Record<OfferGood, number>;
  /** Supply chits in sailing order. In a client view, unrevealed chits have id '?'. */
  chits: { id: string; revealed: boolean }[];
  /** Turns started this round (1–7); the ship sits on chit `step - 1`. */
  step: number;
  round: number;
  rounds: RoundCard[];
  /** Building proposals: three stacks, top card first. */
  stacks: string[][];
  /** Every built building and who owns it: a player id or TOWN. */
  owner: Record<string, string>;
  /** Ships the town has for sale (or for building at a wharf). */
  harbour: Ship[];
  current: number;
  /** Global turn counter, for keying UI state. */
  turn: number;
  phase: Phase;
  /** The current player has taken this turn's main action. */
  mainDone: boolean;
  /** Food still owed per player while feeding at the end of a round. */
  feeding: Record<string, number>;
  /** Final actions left after the last round. */
  finalLeft: number;
  results: Results | null;
  log: string[];
  events: GameEvent[];
  seq: number;
}

/** What clients receive: the state with unrevealed supply chits masked. */
export type GameView = GameState;

export interface UseChoice {
  /** convert: how many; joinery: wood spent; ironworks: 1 to buy the 4th iron. */
  n?: number;
  /** Energy payment. Omitted: the cheapest fuel is picked automatically. */
  fuel?: Bag;
  /** build: proposal building ids, in order. */
  build?: string[];
  /** wharf: the harbour ship to build. */
  shipId?: string;
  /** market: goods picked; shipping: cargo; office: goods given. */
  goods?: Bag;
  /** office: the good received. */
  target?: Good;
  /** shipping: how many ships to send out. */
  ships?: number;
}

export type Action =
  | { type: 'take'; good: OfferGood }
  | { type: 'use'; buildingId: string; choice?: UseChoice }
  | { type: 'buyBuilding'; buildingId: string }
  | { type: 'sellBuilding'; buildingId: string }
  | { type: 'buyShip'; shipId: string }
  | { type: 'sellShip'; shipId: string }
  | { type: 'loan' }
  | { type: 'repay' }
  | { type: 'endTurn' }
  | { type: 'feed'; payment: Bag };

// ---- Setup ----------------------------------------------------------------

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createGame(players: { id: string; name: string }[], rng: () => number = Math.random): GameState {
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new RuleError(`The game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);

  const proposals = BUILDINGS.filter((b) => !b.start).sort((a, b) => a.num - b.num);
  const stacks: string[][] = [[], [], []];
  proposals.forEach((b, i) => stacks[i % 3].push(b.id));

  const offers = Object.fromEntries(OFFER_GOODS.map((g) => [g, START_OFFERS[g] ?? 0])) as Record<OfferGood, number>;

  const state: GameState = {
    players: players.map((p) => ({ id: p.id, name: p.name, goods: { ...emptyGoods(), ...START_GOODS }, loans: 0, ships: [], at: null })),
    offers,
    chits: shuffle(SUPPLY_CHITS.map((c) => ({ id: c.id, revealed: false })), rng),
    step: 0,
    round: 1,
    rounds: roundCards(n),
    stacks,
    owner: Object.fromEntries(BUILDINGS.filter((b) => b.start).map((b) => [b.id, TOWN])),
    harbour: [],
    current: 0,
    turn: 1,
    phase: 'turn',
    mainDone: false,
    feeding: {},
    finalLeft: 0,
    results: null,
    log: [`The colony charter is signed. ${players[0].name} goes first.`],
    events: [],
    seq: 0,
  };
  startTurn(state);
  return state;
}

// ---- Derived values -------------------------------------------------------

export const chitInfo = (id: string): SupplyChit | undefined => SUPPLY_CHITS.find((c) => c.id === id);
export const roundCard = (state: GameState): RoundCard => state.rounds[Math.min(state.round, state.rounds.length) - 1];

export function buildingsOf(state: GameState, ownerId: string): string[] {
  return Object.keys(state.owner).filter((id) => state.owner[id] === ownerId).sort((a, b) => building(a).num - building(b).num);
}

export function iconCounts(state: GameState, playerId: string): Record<Icon, number> {
  const counts: Record<Icon, number> = { craft: 0, industry: 0, fishing: 0 };
  for (const id of buildingsOf(state, playerId)) for (const icon of building(id).icons) counts[icon]++;
  return counts;
}

export const shipFood = (p: PlayerState): number => p.ships.reduce((s, ship) => s + SHIP_INFO[ship.kind].food, 0);

/** Food still needed at the end of this round, after ships. */
export const foodDemand = (state: GameState, p: PlayerState): number => Math.max(0, roundCard(state).food - shipFood(p));

export const stackTops = (state: GameState): string[] => state.stacks.map((s) => s[0]).filter(Boolean);

export const occupants = (state: GameState, buildingId: string): PlayerState[] => state.players.filter((p) => p.at === buildingId);

export const marketLimit = (state: GameState, playerId: string): number =>
  Math.min(4, 2 + Math.floor(iconCounts(state, playerId).craft / 2));

export function buildCost(def: BuildingDef, woodDiscount = 0): Bag {
  const cost = { ...def.cost };
  if (cost.wood) cost.wood = Math.max(0, cost.wood - woodDiscount);
  return compact(cost);
}

/** The entry fee this player owes to use a building; null when free (their own building). */
export function entryFee(state: GameState, playerId: string, buildingId: string): { food?: number; franc?: number } | null {
  const def = building(buildingId);
  if (state.owner[buildingId] === playerId) return null;
  return def.fee;
}

/** Why a player may not enter a building right now, or null if they may. */
export function cannotEnter(state: GameState, playerId: string, buildingId: string): string | null {
  const def = building(buildingId);
  if (!def || !(buildingId in state.owner)) return 'That building has not been built';
  if (def.use.kind === 'none' || !def.fee) return 'That building cannot be entered';
  if (state.phase !== 'final') {
    const p = state.players.find((x) => x.id === playerId);
    if (p?.at === buildingId) return 'Your engineer is already there: move to another building';
    if (occupants(state, buildingId).some((o) => o.id !== playerId)) return 'Someone is working there';
  }
  const p = state.players.find((x) => x.id === playerId)!;
  const fee = entryFee(state, playerId, buildingId);
  if (fee?.franc && p.goods.franc < fee.franc) return `The entry fee is ${fee.franc} credit${fee.franc > 1 ? 's' : ''}`;
  if (fee?.food && !autoFood(p.goods, fee.food)) return `The entry fee is ${fee.food} food`;
  return null;
}

export function wealth(state: GameState, p: PlayerState): Wealth {
  const ids = buildingsOf(state, p.id);
  const icons = iconCounts(state, p.id);
  const buildings = ids.reduce((s, id) => s + building(id).value, 0);
  const bonus = ids.reduce((s, id) => {
    const b = building(id).bonus;
    return s + (b ? b.amount * icons[b.per] : 0);
  }, 0);
  const ships = p.ships.reduce((s, ship) => s + SHIP_INFO[ship.kind].value, 0);
  const loans = p.loans * LOAN_PENALTY;
  return { francs: p.goods.franc, buildings, bonus, ships, loans, total: p.goods.franc + buildings + bonus + ships - loans };
}

// ---- Actions --------------------------------------------------------------

type Handler = (state: GameState, player: PlayerState, action: any) => void;

const EXTRAS = { buyBuilding, sellBuilding, buyShip, sellShip, loan, repay };

const HANDLERS: Record<Exclude<Phase, 'over'>, Record<string, Handler>> = {
  turn: { take, use, endTurn: finishTurn, ...EXTRAS },
  final: { use, endTurn: finishTurn, ...EXTRAS },
  feed: { feed, loan, repay },
};

/**
 * Validates and applies an action. Throws RuleError if the move is illegal, in
 * which case the state is left untouched (moves are applied to a draft first).
 */
export function applyAction(state: GameState, playerId: string, action: Action): void {
  if (!action || typeof action.type !== 'string') throw new RuleError('Invalid action');
  if (state.phase === 'over') throw new RuleError('The game is over');

  const handlers = HANDLERS[state.phase];
  if (!Object.hasOwn(handlers, action.type)) throw new RuleError("You can't do that right now");

  let index: number;
  if (state.phase === 'feed') {
    index = state.players.findIndex((p) => p.id === playerId);
    if (index === -1 || !(state.feeding[playerId] > 0)) throw new RuleError('You have already fed your people');
  } else {
    index = state.current;
    if (state.players[index].id !== playerId) throw new RuleError('It is not your turn');
  }

  const draft = structuredClone(state);
  handlers[action.type](draft, draft.players[index], action);
  Object.assign(state, draft);
}

function take(state: GameState, p: PlayerState, { good }: { good: unknown }) {
  if (state.mainDone) throw new RuleError('You have already taken your action this turn');
  if (!(OFFER_GOODS as readonly unknown[]).includes(good)) throw new RuleError('Invalid landing pad');
  const g = good as OfferGood;
  const amount = state.offers[g];
  if (!amount) throw new RuleError('That landing pad is empty');
  p.goods[g] += amount;
  state.offers[g] = 0;
  state.mainDone = true;
  addLog(state, `${p.name} took ${amount} ${goodName(g, amount)}.`);
  addEvent(state, { playerId: p.id, kind: 'take', good: g, amount });
}

function use(state: GameState, p: PlayerState, { buildingId, choice }: { buildingId: unknown; choice?: unknown }) {
  if (state.mainDone) throw new RuleError('You have already taken your action this turn');
  if (typeof buildingId !== 'string' || !building(buildingId)) throw new RuleError('Unknown building');
  const reason = cannotEnter(state, p.id, buildingId);
  if (reason) throw new RuleError(reason);
  const c = (choice && typeof choice === 'object' ? choice : {}) as UseChoice;
  const def = building(buildingId);
  const before = { ...p.goods };

  // Entry fee, paid to the owner (or to the general supply for the town).
  const fee = entryFee(state, p.id, buildingId);
  if (fee) {
    const pay: Bag = fee.franc ? { franc: fee.franc } : autoFood(p.goods, fee.food ?? 0) ?? {};
    spend(p, pay);
    const owner = state.players.find((x) => x.id === state.owner[buildingId]);
    if (owner) addGoods(owner, pay);
  }
  p.at = buildingId;

  const result = runBuilding(state, p, def, c);
  state.mainDone = true;

  const gained: Bag = {};
  const spent: Bag = {};
  for (const g of GOODS) {
    const d = p.goods[g] - before[g];
    if (d > 0) gained[g] = d;
    if (d < 0) spent[g] = -d;
  }
  addLog(state, `${p.name} used the ${def.name}${result.text ? `: ${result.text}` : ''}.`);
  addEvent(state, { playerId: p.id, kind: 'use', buildingId, gained, spent, built: result.built ?? [], ship: result.ship ?? null });
}

function runBuilding(state: GameState, p: PlayerState, def: BuildingDef, c: UseChoice): { text?: string; built?: string[]; ship?: ShipKind } {
  const u = def.use;
  switch (u.kind) {
    case 'none':
      throw new RuleError('That building cannot be entered');

    case 'gain': {
      const bag = compact(u.gain({ icons: iconCounts(state, p.id), ships: p.ships.length, offers: state.offers }));
      addGoods(p, bag);
      return { text: bagText(bag) || 'nothing to take' };
    }

    case 'convert': {
      const n = count(c.n, 'amount');
      if (n < 1) throw new RuleError(`Choose how much ${goodName(u.from, 2)} to use`);
      if (u.max !== null && n > u.max) throw new RuleError(`At most ${u.max} at a time`);
      if (p.goods[u.from] < n) throw new RuleError(`You don't have ${n} ${goodName(u.from, n)}`);
      spend(p, { [u.from]: n });
      if (u.energy) payEnergy(p, u.energy.per === 'all' ? u.energy.amount : Math.ceil(n / u.energy.per) * u.energy.amount, c.fuel);
      const bag: Bag = { [u.to]: n };
      if (u.francs) bag.franc = Math.floor(n / u.francs.per) * u.francs.amount;
      if (u.extra) bag[u.extra.good] = (bag[u.extra.good] ?? 0) + Math.floor(n / u.extra.per);
      addGoods(p, compact(bag));
      return { text: bagText(compact(bag)) };
    }

    case 'build': {
      const ids = c.build;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > u.count || new Set(ids).size !== ids.length) {
        throw new RuleError(u.count === 1 ? 'Choose a building to build' : 'Choose 1 or 2 buildings to build');
      }
      for (const id of ids) {
        if (typeof id !== 'string' || !stackTops(state).includes(id)) throw new RuleError('You can only build the top blueprint of a stack');
        const cost = buildCost(building(id), u.woodDiscount);
        if (!hasAll(p.goods, cost)) throw new RuleError(`You lack the materials for the ${building(id).name}`);
        spend(p, cost);
        takeProposal(state, id);
        state.owner[id] = p.id;
      }
      return { text: `built the ${ids.map((id) => building(id).name).join(' and the ')}`, built: ids };
    }

    case 'wharf': {
      const ship = state.harbour.find((s) => s.id === c.shipId);
      if (!ship) throw new RuleError('Choose a rocket from the spaceport');
      if (ship.kind === 'luxury' && !u.luxury) throw new RuleError('Only the Orbital Shipyard can assemble a starliner');
      const materials = SHIP_INFO[ship.kind].materials;
      if (!hasAll(p.goods, materials)) throw new RuleError(`You lack the materials: ${bagText(materials)}`);
      spend(p, materials);
      payEnergy(p, SHIP_ENERGY, c.fuel);
      state.harbour = state.harbour.filter((s) => s !== ship);
      p.ships.push(ship);
      return { text: `assembled a ${SHIP_INFO[ship.kind].name.toLowerCase()}`, ship: ship.kind };
    }

    case 'shipping': {
      const fleet = p.ships.map((s) => SHIP_INFO[s.kind].capacity).filter((cap) => cap > 0).sort((a, b) => b - a);
      if (!fleet.length) throw new RuleError('You need a rocket that can carry cargo');
      const k = count(c.ships, 'ships');
      if (k < 1 || k > fleet.length) throw new RuleError(`Launch between 1 and ${fleet.length} rockets`);
      const capacity = fleet.slice(0, k).reduce((a, b) => a + b, 0);
      const cargo = cleanBag(c.goods, (g) => g !== 'franc', 'cargo');
      const load = Object.values(cargo).reduce<number>((a, b) => a + (b ?? 0), 0);
      if (load < 1) throw new RuleError('Load some cargo');
      if (load > capacity) throw new RuleError(`Your rockets carry at most ${capacity} goods`);
      if (!hasAll(p.goods, cargo)) throw new RuleError("You don't have that cargo");
      spend(p, cargo);
      payEnergy(p, SHIP_ENERGY * k, c.fuel);
      const francs = Object.entries(cargo).reduce((s, [g, n]) => s + SHIP_VALUE[g as Good] * (n ?? 0), 0);
      p.goods.franc += francs;
      return { text: `exported ${bagText(cargo)} for ${francs} credits` };
    }

    case 'market': {
      const limit = marketLimit(state, p.id);
      const picks = cleanBag(c.goods, (g) => (BASIC as readonly Good[]).includes(g), 'goods');
      const kinds = Object.keys(picks);
      if (Object.values(picks).some((n) => n !== 1)) throw new RuleError('Take 1 of each good you pick');
      if (kinds.length < 1 || kinds.length > limit) throw new RuleError(`Pick 1 to ${limit} different basic goods`);
      addGoods(p, picks);
      return { text: bagText(picks) };
    }

    case 'joinery': {
      const n = count(c.n, 'amount');
      if (n < 1 || n > 3) throw new RuleError('Use 1, 2 or 3 biomass');
      if (p.goods.wood < n) throw new RuleError("You don't have enough biomass");
      spend(p, { wood: n });
      p.goods.franc += 2 * n + 1;
      return { text: `${n} biomass into ${2 * n + 1} credits` };
    }

    case 'ironworks': {
      const extra = c.n === 1;
      if (extra) payEnergy(p, 6, c.fuel);
      p.goods.iron += extra ? 4 : 3;
      return { text: `${extra ? 4 : 3} iron ore` };
    }

    case 'office': {
      const target = c.target;
      const give = cleanBag(c.goods, (g) => g !== 'franc', 'goods');
      const total = Object.values(give).reduce<number>((a, b) => a + (b ?? 0), 0);
      if (target === 'steel') {
        if (total !== 4) throw new RuleError('Trade exactly 4 goods for 1 steel');
      } else if (target === 'charcoal' || target === 'bricks' || target === 'leather') {
        if (total !== 1) throw new RuleError(`Trade exactly 1 good for 1 ${goodName(target)}`);
      } else {
        throw new RuleError('Choose steel, biofuel, blocks or composite');
      }
      if (!hasAll(p.goods, give)) throw new RuleError("You don't have those goods");
      spend(p, give);
      p.goods[target] += 1;
      return { text: `${bagText(give)} for 1 ${goodName(target)}` };
    }

    case 'court': {
      if (p.loans > 0) {
        p.loans--;
        return { text: 'a loan was forgiven' };
      }
      p.goods.franc += 3;
      return { text: '3 credits' };
    }
  }
}

function buyBuilding(state: GameState, p: PlayerState, { buildingId }: { buildingId: unknown }) {
  const def = typeof buildingId === 'string' ? building(buildingId) : undefined;
  if (!def) throw new RuleError('Unknown building');
  const fromTown = state.owner[def.id] === TOWN;
  const fromStack = stackTops(state).includes(def.id);
  if (def.start) throw new RuleError('The Colony Authority keeps its starting buildings');
  if (!fromTown && !fromStack) throw new RuleError('That building is not for sale');
  if (p.goods.franc < def.value) throw new RuleError(`The ${def.name} costs ${def.value} credits`);
  p.goods.franc -= def.value;
  if (fromStack) takeProposal(state, def.id);
  state.owner[def.id] = p.id;
  addLog(state, `${p.name} bought the ${def.name} for ${def.value} credits.`);
  addEvent(state, { playerId: p.id, kind: 'buyBuilding', buildingId: def.id, price: def.value });
}

function sellBuilding(state: GameState, p: PlayerState, { buildingId }: { buildingId: unknown }) {
  if (typeof buildingId !== 'string' || state.owner[buildingId] !== p.id) throw new RuleError("That building isn't yours");
  const def = building(buildingId);
  const price = Math.floor(def.value / 2);
  state.owner[buildingId] = TOWN;
  p.goods.franc += price;
  addLog(state, `${p.name} sold the ${def.name} to the colony for ${price} credits.`);
  addEvent(state, { playerId: p.id, kind: 'sellBuilding', buildingId, price });
}

function buyShip(state: GameState, p: PlayerState, { shipId }: { shipId: unknown }) {
  const ship = state.harbour.find((s) => s.id === shipId);
  if (!ship) throw new RuleError('That rocket is not in the spaceport');
  const price = SHIP_INFO[ship.kind].value;
  if (p.goods.franc < price) throw new RuleError(`The ${SHIP_INFO[ship.kind].name.toLowerCase()} costs ${price} credits`);
  p.goods.franc -= price;
  state.harbour = state.harbour.filter((s) => s !== ship);
  p.ships.push(ship);
  addLog(state, `${p.name} bought a ${SHIP_INFO[ship.kind].name.toLowerCase()} for ${price} credits.`);
  addEvent(state, { playerId: p.id, kind: 'buyShip', ship: ship.kind, price });
}

function sellShip(state: GameState, p: PlayerState, { shipId }: { shipId: unknown }) {
  const ship = p.ships.find((s) => s.id === shipId);
  if (!ship) throw new RuleError("That rocket isn't yours");
  const price = Math.floor(SHIP_INFO[ship.kind].value / 2);
  p.ships = p.ships.filter((s) => s !== ship);
  state.harbour.push(ship);
  p.goods.franc += price;
  addLog(state, `${p.name} sold a ${SHIP_INFO[ship.kind].name.toLowerCase()} for ${price} credits.`);
  addEvent(state, { playerId: p.id, kind: 'sellShip', ship: ship.kind, price });
}

function loan(state: GameState, p: PlayerState) {
  p.loans++;
  p.goods.franc += LOAN_AMOUNT;
  addLog(state, `${p.name} took a loan of ${LOAN_AMOUNT} credits.`);
  addEvent(state, { playerId: p.id, kind: 'loan' });
}

function repay(state: GameState, p: PlayerState) {
  if (!p.loans) throw new RuleError('You have no loans');
  if (p.goods.franc < LOAN_REPAY) throw new RuleError(`Repaying a loan costs ${LOAN_REPAY} credits`);
  p.loans--;
  p.goods.franc -= LOAN_REPAY;
  addLog(state, `${p.name} repaid a loan.`);
  addEvent(state, { playerId: p.id, kind: 'repay' });
}

function feed(state: GameState, p: PlayerState, { payment }: { payment: unknown }) {
  const due = state.feeding[p.id];
  const pay = cleanBag(payment, (g) => (FOOD_GOODS as readonly Good[]).includes(g), 'payment');
  if (!hasAll(p.goods, pay)) throw new RuleError("You don't have that much food");
  spend(p, pay);
  // Whatever the food doesn't cover is paid in francs from new loans.
  const short = Math.max(0, due - foodIn(pay));
  const loans = Math.ceil(short / LOAN_AMOUNT);
  if (loans) {
    p.loans += loans;
    p.goods.franc += loans * LOAN_AMOUNT - short;
  }
  delete state.feeding[p.id];
  addLog(state, `${p.name} kept their colonists alive${loans ? ` with ${loans} new loan${loans > 1 ? 's' : ''}` : ''}.`);
  addEvent(state, { playerId: p.id, kind: 'fed', paid: pay, loans });
  if (!Object.keys(state.feeding).length) afterFeeding(state);
}

// ---- Turn flow ------------------------------------------------------------

/** The ship sails onto the next supply chit: goods arrive, and maybe interest is due. */
function startTurn(state: GameState) {
  state.step++;
  state.mainDone = false;
  state.phase = 'turn';
  const slot = state.chits[state.step - 1];
  slot.revealed = true;
  const chit = chitInfo(slot.id)!;
  for (const g of chit.goods) state.offers[g]++;
  const p = state.players[state.current];
  if (chit.interest) {
    for (const debtor of state.players.filter((x) => x.loans > 0)) {
      if (debtor.goods.franc < 1) {
        debtor.loans++;
        debtor.goods.franc += LOAN_AMOUNT;
      }
      debtor.goods.franc -= 1;
    }
  }
  addEvent(state, { playerId: p.id, kind: 'supply', goods: [...chit.goods], interest: chit.interest });
}

function finishTurn(state: GameState, p: PlayerState) {
  if (!state.mainDone) {
    addLog(state, `${p.name} passed.`);
    addEvent(state, { playerId: p.id, kind: 'pass' });
  }
  const next = (state.current + 1) % state.players.length;
  state.turn++;
  if (state.phase === 'final') {
    state.finalLeft--;
    if (state.finalLeft <= 0) return finishGame(state);
    state.current = next;
    state.mainDone = false;
    return;
  }
  if (state.step >= TURNS_PER_ROUND) return endRound(state);
  state.current = next;
  startTurn(state);
}

function endRound(state: GameState) {
  const card = roundCard(state);
  if (card.harvest) {
    for (const p of state.players) {
      if (p.goods.grain >= 1) p.goods.grain++;
      if (p.goods.cattle >= 2) p.goods.cattle++;
    }
  }
  addLog(state, `Sol cycle ${card.round} ends${card.harvest ? ' with a greenhouse yield' : ''}. Every colony needs ${card.food} food.`);
  addEvent(state, { playerId: state.players[state.current].id, kind: 'roundEnd', round: card.round, food: card.food, harvest: card.harvest });
  state.feeding = {};
  for (const p of state.players) {
    const due = foodDemand(state, p);
    if (due > 0) state.feeding[p.id] = due;
  }
  state.phase = 'feed';
  if (!Object.keys(state.feeding).length) afterFeeding(state);
}

function afterFeeding(state: GameState) {
  const card = roundCard(state);
  if (card.townBuilds) {
    const tops = stackTops(state);
    if (tops.length) {
      const id = tops.reduce((a, b) => (building(a).num <= building(b).num ? a : b));
      takeProposal(state, id);
      state.owner[id] = TOWN;
      addLog(state, `The Colony Authority built the ${building(id).name}.`);
      addEvent(state, { playerId: state.players[state.current].id, kind: 'townBuilds', buildingId: id });
    }
  }
  state.harbour.push({ id: `ship${card.round}`, kind: card.ship });
  addLog(state, `A ${SHIP_INFO[card.ship].name.toLowerCase()} landed at the spaceport.`);

  const next = (state.current + 1) % state.players.length;
  state.current = next;
  if (state.round >= state.rounds.length) {
    state.phase = 'final';
    state.finalLeft = state.players.length;
    state.mainDone = false;
    addLog(state, 'The last Sol cycle is over. Everyone takes one final action, even in an occupied building.');
    addEvent(state, { playerId: state.players[next].id, kind: 'final' });
    return;
  }
  state.round++;
  state.step = 0;
  startTurn(state);
}

function finishGame(state: GameState) {
  state.phase = 'over';
  const ranking = state.players
    .map((p) => ({ id: p.id, name: p.name, ...wealth(state, p) }))
    .sort((a, b) => b.total - a.total);
  const best = ranking[0].total;
  const winners = ranking.filter((r) => r.total === best);
  state.results = { ranking, winners: winners.map((w) => w.id) };
  addLog(state, `Game over! ${winners.map((w) => w.name).join(' & ')} win${winners.length > 1 ? '' : 's'} with ${best} credits of wealth.`);
}

// ---- Helpers --------------------------------------------------------------

function count(x: unknown, what: string): number {
  if (x === undefined) return 0;
  if (!Number.isInteger(x) || (x as number) < 0) throw new RuleError(`Invalid ${what}`);
  return x as number;
}

/** Validates a client-sent bag of goods: known goods, non-negative integers, allowed kinds only. */
function cleanBag(x: unknown, allowed: (g: Good) => boolean, what: string): Bag {
  if (x === undefined || x === null) return {};
  if (typeof x !== 'object') throw new RuleError(`Invalid ${what}`);
  const bag: Bag = {};
  for (const [g, n] of Object.entries(x as Record<string, unknown>)) {
    if (!isGood(g) || !allowed(g) || !Number.isInteger(n) || (n as number) < 0) throw new RuleError(`Invalid ${what}`);
    if ((n as number) > 0) bag[g] = n as number;
  }
  return bag;
}

function spend(p: PlayerState, bag: Bag) {
  if (!hasAll(p.goods, bag)) throw new RuleError("You don't have enough goods");
  for (const [g, n] of Object.entries(bag)) p.goods[g as Good] -= n ?? 0;
}

function addGoods(p: PlayerState, bag: Bag) {
  for (const [g, n] of Object.entries(bag)) p.goods[g as Good] += n ?? 0;
}

/** Burns fuel for `need` energy: the player's chosen fuel, or the cheapest available. */
function payEnergy(p: PlayerState, need: number, fuel: unknown) {
  if (need <= 0) return;
  let bag: Bag;
  if (fuel === undefined) {
    const auto = autoFuel(p.goods, need);
    if (!auto) throw new RuleError(`You need ${need} energy`);
    bag = auto;
  } else {
    bag = cleanBag(fuel, (g) => (FUEL_GOODS as readonly Good[]).includes(g), 'fuel');
    if (energyIn(bag) < need) throw new RuleError(`That fuel gives only ${energyIn(bag)} of the ${need} energy needed`);
  }
  if (!hasAll(p.goods, bag)) throw new RuleError(`You need ${need} energy`);
  spend(p, bag);
}

function takeProposal(state: GameState, id: string) {
  for (const stack of state.stacks) {
    if (stack[0] === id) {
      stack.shift();
      return;
    }
  }
  throw new RuleError('That blueprint is not on top of a stack');
}

export const goodName = (g: Good, n = 1) => GOOD_NAMES[g][n === 1 ? 0 : 1];
export const bagText = (bag: Bag) => Object.entries(compact(bag)).map(([g, n]) => `${n} ${goodName(g as Good, n)}`).join(', ');
export const upgradeOf = (g: BasicGood) => UPGRADE_OF[g];

function addLog(state: GameState, msg: string) {
  state.log.push(msg);
  if (state.log.length > 120) state.log.shift();
}

function addEvent(state: GameState, event: NewEvent) {
  state.seq++;
  state.events.push({ ...event, seq: state.seq } as GameEvent);
  if (state.events.length > 40) state.events.shift();
}

// ---- Views ----------------------------------------------------------------

/** Everything in this game is public except supply chits the ship hasn't reached. */
export function viewFor(state: GameState): GameView {
  return {
    ...state,
    chits: state.chits.map((c) => (c.revealed ? c : { id: '?', revealed: false })),
    log: state.log.slice(-60),
  };
}
