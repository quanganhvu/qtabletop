// Card data for the game: buildings, ships, round cards and supply chits.
// Everything numeric lives here so the game can be balanced in one place.

import type { Bag, Good, OfferGood } from './goods';

export type Icon = 'craft' | 'industry' | 'fishing';

/** What a building lets the person who enters it do. The engine implements each kind. */
export type Use =
  /** Not enterable (its worth is its value and end-of-game bonus). */
  | { kind: 'none' }
  /** Receive goods; `gain` works them out from what the user owns. */
  | { kind: 'gain'; gain: (ctx: GainContext) => Bag }
  /**
   * Turn up to `max` of `from` into `to`. Energy: `amount` per `per` units (rounded up),
   * or a flat `amount` when per is 'all'. Optional francs and by-products per units.
   */
  | {
      kind: 'convert'; from: Good; to: Good; max: number | null;
      energy?: { amount: number; per: number | 'all' };
      francs?: { amount: number; per: number };
      extra?: { good: Good; per: number };
    }
  /** Build `count` buildings from the proposal stacks, paying `woodDiscount` fewer wood each. */
  | { kind: 'build'; count: 1 | 2; woodDiscount?: number }
  /** Build a ship from the harbour, paying materials and 3 energy. */
  | { kind: 'wharf'; luxury: boolean }
  /** Ship goods for francs. */
  | { kind: 'shipping' }
  /** Pick different basic goods. */
  | { kind: 'market' }
  /** Turn 1–3 wood into francs. */
  | { kind: 'joinery' }
  /** 3 iron, +1 for 6 energy. */
  | { kind: 'ironworks' }
  /** Trade goods for steel or an upgraded good. */
  | { kind: 'office' }
  /** Have a loan forgiven. */
  | { kind: 'court' };

export interface GainContext {
  icons: Record<Icon, number>;
  ships: number;
  offers: Record<OfferGood, number>;
}

export interface BuildingDef {
  id: string;
  /** Proposal order; the town always builds the lowest number on offer. */
  num: number;
  name: string;
  /** Building materials needed to build it. */
  cost: Bag;
  /** Worth at the end of the game; also its purchase price (sold for half). */
  value: number;
  /** Paid by anyone but the owner on entering. Null: cannot be entered. */
  fee: { food?: number; franc?: number } | null;
  icons: Icon[];
  /** Starting buildings belong to the town for the whole game. */
  start?: boolean;
  text: string;
  use: Use;
  bonus?: { text: string; per: Icon; amount: number };
}

const gain = (fn: (ctx: GainContext) => Bag): Use => ({ kind: 'gain', gain: fn });

export const BUILDINGS: BuildingDef[] = [
  // ---- Starting buildings: owned by the town for the whole game ----
  {
    id: 'firm1', num: 0, name: 'Construction Bay I', cost: {}, value: 4, fee: { food: 1 }, icons: [], start: true,
    text: 'Build 1 blueprint, paying its materials.', use: { kind: 'build', count: 1 },
  },
  {
    id: 'firm2', num: 0, name: 'Construction Bay II', cost: {}, value: 4, fee: { franc: 1 }, icons: [], start: true,
    text: 'Build 1 blueprint, paying its materials.', use: { kind: 'build', count: 1 },
  },
  {
    id: 'construction', num: 0, name: 'Fabrication Yard', cost: {}, value: 6, fee: { food: 2 }, icons: [], start: true,
    text: 'Build up to 2 blueprints, paying their materials.', use: { kind: 'build', count: 2 },
  },

  // ---- Proposals: dealt into three stacks by number ----
  {
    id: 'marketplace', num: 1, name: 'Trading Post', cost: { wood: 4 }, value: 6, fee: { food: 2 }, icons: [],
    text: 'Take 2 different raw resources, +1 more for every 2 workshop modules you own (at most 4).', use: { kind: 'market' },
  },
  {
    id: 'fishery', num: 2, name: 'Algae Vats', cost: { wood: 1, clay: 1 }, value: 10, fee: { food: 1 }, icons: ['fishing'],
    text: 'Take 3 algae, +1 for each farm module you own.',
    use: gain(({ icons }) => ({ fish: 3 + icons.fishing })),
  },
  {
    id: 'claymound', num: 3, name: 'Regolith Excavator', cost: { wood: 3 }, value: 2, fee: { food: 1 }, icons: ['craft'],
    text: 'Take 3 regolith, +1 for each workshop module you own.',
    use: gain(({ icons }) => ({ clay: 3 + icons.craft })),
  },
  {
    id: 'kiln', num: 4, name: 'Bioreactor', cost: { clay: 1 }, value: 8, fee: { food: 1 }, icons: ['industry'],
    text: 'Ferment any amount of biomass into biofuel.',
    use: { kind: 'convert', from: 'wood', to: 'charcoal', max: null },
  },
  {
    id: 'smokehouse', num: 5, name: 'Food Processor', cost: { wood: 2, clay: 1 }, value: 6, fee: { food: 1 }, icons: ['fishing'],
    text: 'Press up to 6 algae into algae cakes for 1 energy in total. +1 credit for every 2 cakes.',
    use: { kind: 'convert', from: 'fish', to: 'smokedFish', max: 6, energy: { amount: 1, per: 'all' }, francs: { amount: 1, per: 2 } },
  },
  {
    id: 'joinery', num: 6, name: 'Recycler', cost: { wood: 3 }, value: 8, fee: { franc: 1 }, icons: ['craft'],
    text: 'Recycle 1, 2 or 3 biomass into 3, 5 or 7 credits.', use: { kind: 'joinery' },
  },
  {
    id: 'hardware', num: 7, name: 'Supply Depot', cost: { wood: 3, clay: 1 }, value: 8, fee: { franc: 1 }, icons: ['craft'],
    text: 'Take 1 biomass, 1 block and 1 iron ore.',
    use: gain(() => ({ wood: 1, bricks: 1, iron: 1 })),
  },
  {
    id: 'wharf1', num: 8, name: 'Launch Pad', cost: { wood: 2, clay: 2 }, value: 14, fee: { food: 2 }, icons: ['industry'],
    text: 'Assemble a shuttle, freighter or heavy lifter from the spaceport: pay its materials and 3 energy.', use: { kind: 'wharf', luxury: false },
  },
  {
    id: 'abattoir', num: 9, name: 'Protein Plant', cost: { wood: 1, clay: 1, iron: 1 }, value: 8, fee: { franc: 2 }, icons: ['craft'],
    text: 'Process any number of insect colonies into protein. +1 chitin for every 2 colonies.',
    use: { kind: 'convert', from: 'cattle', to: 'meat', max: null, extra: { good: 'hides', per: 2 } },
  },
  {
    id: 'bakehouse', num: 10, name: 'Galley', cost: { clay: 2 }, value: 8, fee: { food: 1 }, icons: ['craft'],
    text: 'Cook any amount of crops into meals: 1 energy per 2 meals. +1 credit per 2 meals.',
    use: { kind: 'convert', from: 'grain', to: 'bread', max: null, energy: { amount: 1, per: 2 }, francs: { amount: 1, per: 2 } },
  },
  {
    id: 'sawmill', num: 11, name: '3D Printer', cost: { clay: 2, iron: 1 }, value: 14, fee: { food: 1 }, icons: ['craft'],
    text: 'Build 1 blueprint, paying 1 biomass less.', use: { kind: 'build', count: 1, woodDiscount: 1 },
  },
  {
    id: 'colliery', num: 12, name: 'Uranium Mine', cost: { wood: 1, clay: 3 }, value: 10, fee: { food: 2 }, icons: ['industry'],
    text: 'Take 3 uranium, +1 if you own 2 or more industry modules.',
    use: gain(({ icons }) => ({ coal: icons.industry >= 2 ? 4 : 3 })),
  },
  {
    id: 'brickworks', num: 13, name: 'Sintering Furnace', cost: { wood: 2, clay: 1, iron: 1 }, value: 14, fee: { food: 1 }, icons: ['industry'],
    text: 'Sinter up to 6 regolith into blocks: 1 energy per 2 blocks.',
    use: { kind: 'convert', from: 'clay', to: 'bricks', max: 6, energy: { amount: 1, per: 2 } },
  },
  {
    id: 'grocery', num: 14, name: 'Commissary', cost: { wood: 1, bricks: 1 }, value: 10, fee: { franc: 2 }, icons: [],
    text: 'Take 1 each of algae, algae cakes, crops, meals, insects and protein.',
    use: gain(() => ({ fish: 1, smokedFish: 1, grain: 1, bread: 1, cattle: 1, meat: 1 })),
  },
  {
    id: 'tannery', num: 15, name: 'Composite Works', cost: { wood: 1, bricks: 1 }, value: 12, fee: { food: 1 }, icons: ['craft'],
    text: 'Bind up to 4 chitin into composite. +1 credit per composite.',
    use: { kind: 'convert', from: 'hides', to: 'leather', max: 4, francs: { amount: 1, per: 1 } },
  },
  {
    id: 'blackmarket', num: 16, name: 'Smugglers\' Den', cost: { wood: 2, clay: 2 }, value: 2, fee: { franc: 1 }, icons: [],
    text: 'Take 1 of each resource whose landing pad holds fewer than 2 (credits excluded).',
    use: gain(({ offers }) => Object.fromEntries(
      (['fish', 'wood', 'clay', 'iron', 'grain', 'cattle'] as const).filter((g) => offers[g] < 2).map((g) => [g, 1]),
    )),
  },
  {
    id: 'office', num: 17, name: 'Exchange Office', cost: { wood: 4, clay: 1 }, value: 12, fee: { food: 1 }, icons: [],
    text: 'Trade any 4 resources for 1 steel, or any 1 resource for 1 biofuel, block or composite.', use: { kind: 'office' },
  },
  {
    id: 'ironworks', num: 18, name: 'Iron Mine', cost: { wood: 3, bricks: 2 }, value: 12, fee: { food: 3 }, icons: ['industry'],
    text: 'Take 3 iron ore. Pay 6 energy to take a 4th.', use: { kind: 'ironworks' },
  },
  {
    id: 'wharf2', num: 19, name: 'Launch Pad II', cost: { wood: 2, clay: 2 }, value: 14, fee: { food: 2 }, icons: ['industry'],
    text: 'Assemble a shuttle, freighter or heavy lifter from the spaceport: pay its materials and 3 energy.', use: { kind: 'wharf', luxury: false },
  },
  {
    id: 'arts', num: 20, name: 'Media Dome', cost: { wood: 1, clay: 4 }, value: 16, fee: { food: 1 }, icons: [],
    text: 'Broadcast to Earth: take 4 credits.', use: gain(() => ({ franc: 4 })),
  },
  {
    id: 'shipping', num: 21, name: 'Earth Export Line', cost: { wood: 3, bricks: 3 }, value: 10, fee: { food: 2 }, icons: [],
    text: 'Launch your rockets to Earth: 3 energy each. Each carries cargo up to its capacity, earning its credit value.',
    use: { kind: 'shipping' },
  },
  {
    id: 'steelmill', num: 22, name: 'Foundry', cost: { bricks: 2, iron: 2 }, value: 22, fee: { franc: 2 }, icons: ['industry'],
    text: 'Smelt any amount of iron ore into steel: 5 energy each.',
    use: { kind: 'convert', from: 'iron', to: 'steel', max: null, energy: { amount: 5, per: 1 } },
  },
  {
    id: 'court', num: 23, name: 'Colonial Court', cost: { wood: 3, clay: 2, bricks: 2 }, value: 16, fee: { franc: 1 }, icons: [],
    text: 'One of your loans is forgiven. Without a loan, take 3 credits instead.', use: { kind: 'court' },
  },
  {
    id: 'coking', num: 24, name: 'Enrichment Plant', cost: { bricks: 2, iron: 1 }, value: 18, fee: { food: 2 }, icons: ['industry'],
    text: 'Enrich any amount of uranium into fuel rods. +1 credit per rod.',
    use: { kind: 'convert', from: 'coal', to: 'coke', max: null, francs: { amount: 1, per: 1 } },
  },
  {
    id: 'townhall', num: 25, name: 'Colony Hall', cost: { wood: 4, bricks: 3 }, value: 6, fee: null, icons: [],
    text: 'Cannot be entered.', use: { kind: 'none' },
    bonus: { text: '+3 per workshop module you own', per: 'craft', amount: 3 },
  },
  {
    id: 'bank', num: 26, name: 'Bank of Tharsis', cost: { bricks: 4, steel: 1 }, value: 16, fee: null, icons: [],
    text: 'Cannot be entered.', use: { kind: 'none' },
    bonus: { text: '+3 per industry module you own', per: 'industry', amount: 3 },
  },
  {
    id: 'modwharf', num: 27, name: 'Orbital Shipyard', cost: { bricks: 2, steel: 2 }, value: 20, fee: { food: 3 }, icons: ['industry'],
    text: 'Assemble any rocket from the spaceport, including a starliner: pay its materials and 3 energy.',
    use: { kind: 'wharf', luxury: true },
  },
  {
    id: 'church', num: 28, name: 'Atmosphere Processor', cost: { wood: 5, bricks: 3, iron: 3 }, value: 26, fee: null, icons: [],
    text: 'Cannot be entered. The great terraforming engine: worth a fortune at the end.', use: { kind: 'none' },
  },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export const building = (id: string): BuildingDef => BUILDING_BY_ID[id];

// ---- Ships ----------------------------------------------------------------

export const SHIP_KINDS = ['wooden', 'iron', 'steel', 'luxury'] as const;
export type ShipKind = (typeof SHIP_KINDS)[number];

export const SHIP_INFO: Record<ShipKind, { name: string; value: number; food: number; capacity: number; materials: Bag }> = {
  wooden: { name: 'Shuttle', value: 14, food: 4, capacity: 4, materials: { wood: 5 } },
  iron: { name: 'Freighter', value: 20, food: 5, capacity: 5, materials: { iron: 4 } },
  steel: { name: 'Heavy lifter', value: 30, food: 7, capacity: 7, materials: { steel: 2 } },
  luxury: { name: 'Starliner', value: 38, food: 0, capacity: 0, materials: { steel: 3 } },
};

/** Energy to build a ship at a wharf, and to send one out from the Shipping Line. */
export const SHIP_ENERGY = 3;

// ---- Rounds ---------------------------------------------------------------

export interface RoundCard {
  round: number;
  /** Food each player must provide at the end of the round (before ships). */
  food: number;
  harvest: boolean;
  /** The town builds the lowest-numbered proposal at the end of the round. */
  townBuilds: boolean;
  /** The ship that docks in the harbour at the end of the round. */
  ship: ShipKind;
}

export const ROUNDS_FOR: Record<number, number> = { 2: 14, 3: 18, 4: 20, 5: 20 };
export const TURNS_PER_ROUND = 7;

const FOOD_CURVE = [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12];
/** Fewer players get more turns each per round, so they are expected to feed more. */
const FOOD_SCALE: Record<number, number> = { 2: 1.15, 3: 0.9, 4: 0.7, 5: 0.6 };

export function roundCards(players: number): RoundCard[] {
  const total = ROUNDS_FOR[players];
  return Array.from({ length: total }, (_, i) => {
    // Spread the 20-round schedule over however many rounds this game has.
    const k = Math.floor((i * FOOD_CURVE.length) / total);
    return {
      round: i + 1,
      food: Math.max(1, Math.round(FOOD_CURVE[k] * FOOD_SCALE[players])),
      harvest: k % 5 !== 4,
      townBuilds: k % 3 === 1,
      ship: k < 7 ? 'wooden' : k < 13 ? 'iron' : k < 18 ? 'steel' : 'luxury',
    };
  });
}

// ---- Supply ---------------------------------------------------------------

/** Each turn the ship sails onto the next chit, which adds 1 of each good shown; some also charge interest. */
export interface SupplyChit {
  id: string;
  goods: [OfferGood, OfferGood];
  interest: boolean;
}

export const SUPPLY_CHITS: SupplyChit[] = [
  { id: 'k1', goods: ['fish', 'franc'], interest: false },
  { id: 'k2', goods: ['fish', 'wood'], interest: false },
  { id: 'k3', goods: ['wood', 'clay'], interest: false },
  { id: 'k4', goods: ['wood', 'fish'], interest: false },
  { id: 'k5', goods: ['clay', 'iron'], interest: false },
  { id: 'k6', goods: ['grain', 'franc'], interest: false },
  { id: 'k7', goods: ['cattle', 'franc'], interest: true },
];

export const START_OFFERS: Partial<Record<OfferGood, number>> = { franc: 2, fish: 2, wood: 2, clay: 1 };
export const START_GOODS: Bag = { franc: 5, coal: 1 };

export const LOAN_AMOUNT = 4;
export const LOAN_REPAY = 5;
export const LOAN_PENALTY = 7;
