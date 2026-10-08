// Goods: the 8 basic goods, their 8 upgraded forms (the back of each goods
// tile in the real game), and francs. Pure data and small helpers.

export const BASIC = ['fish', 'wood', 'clay', 'iron', 'grain', 'cattle', 'coal', 'hides'] as const;
export const UPGRADED = ['smokedFish', 'charcoal', 'bricks', 'steel', 'bread', 'meat', 'coke', 'leather'] as const;
export const GOODS = ['franc', ...BASIC, ...UPGRADED] as const;

export type BasicGood = (typeof BASIC)[number];
export type Good = (typeof GOODS)[number];
export type Goods = Record<Good, number>;
export type Bag = Partial<Goods>;

/** The seven offer spaces on the harbour board, in board order. */
export const OFFER_GOODS = ['franc', 'fish', 'wood', 'clay', 'iron', 'grain', 'cattle'] as const;
export type OfferGood = (typeof OFFER_GOODS)[number];

export const UPGRADE_OF: Record<BasicGood, Good> = {
  fish: 'smokedFish', wood: 'charcoal', clay: 'bricks', iron: 'steel',
  grain: 'bread', cattle: 'meat', coal: 'coke', hides: 'leather',
};

/** Food each good provides (for feeding and food entry fees). */
export const FOOD: Partial<Record<Good, number>> = { franc: 1, fish: 1, smokedFish: 2, bread: 2, meat: 3 };
export const FOOD_GOODS = ['fish', 'smokedFish', 'bread', 'meat', 'franc'] as const satisfies readonly Good[];

/** Energy each good provides when burned. */
export const ENERGY: Partial<Record<Good, number>> = { wood: 1, charcoal: 3, coal: 3, coke: 10 };
export const FUEL_GOODS = ['wood', 'charcoal', 'coal', 'coke'] as const satisfies readonly Good[];

/** Francs a good earns when shipped from the Shipping Line. */
export const SHIP_VALUE: Record<Good, number> = {
  franc: 0,
  fish: 1, wood: 1, clay: 1, iron: 2, grain: 1, cattle: 3, coal: 3, hides: 2,
  smokedFish: 2, charcoal: 2, bricks: 2, steel: 8, bread: 3, meat: 2, coke: 5, leather: 4,
};

/** Building materials, in the order costs are printed. */
export const MATERIALS = ['wood', 'clay', 'bricks', 'iron', 'steel'] as const satisfies readonly Good[];

export const emptyGoods = (): Goods => Object.fromEntries(GOODS.map((g) => [g, 0])) as Goods;

export const isGood = (x: unknown): x is Good => typeof x === 'string' && (GOODS as readonly string[]).includes(x);

export const bagTotal = (bag: Bag): number => Object.values(bag).reduce<number>((a, b) => a + (b ?? 0), 0);

export const foodIn = (bag: Bag): number =>
  Object.entries(bag).reduce((sum, [g, n]) => sum + (FOOD[g as Good] ?? 0) * (n ?? 0), 0);

export const energyIn = (bag: Bag): number =>
  Object.entries(bag).reduce((sum, [g, n]) => sum + (ENERGY[g as Good] ?? 0) * (n ?? 0), 0);

export const hasAll = (have: Goods, need: Bag): boolean =>
  Object.entries(need).every(([g, n]) => have[g as Good] >= (n ?? 0));

/** Drops zero entries, for display and events. */
export const compact = (bag: Bag): Bag =>
  Object.fromEntries(Object.entries(bag).filter(([, n]) => (n ?? 0) > 0));

/** How much a player would rather not spend each good (rough franc worth), used to choose payments. */
const KEEP: Record<Good, number> = {
  franc: 1, fish: 1, wood: 1.5, clay: 1.4, iron: 3, grain: 1, cattle: 2, coal: 2.5, hides: 1.5,
  smokedFish: 2.2, charcoal: 2.6, bricks: 3, steel: 9, bread: 2.6, meat: 2.8, coke: 7, leather: 4,
};

/**
 * The cheapest way to pay `need` units of food or energy out of `have`, leaving
 * `reserve` untouched. Returns null if it can't be covered. Small brute force:
 * piles are bounded by need, so this stays fast.
 */
function cheapest(have: Goods, need: number, kinds: readonly Good[], per: Partial<Record<Good, number>>, reserve: Bag = {}): Bag | null {
  if (need <= 0) return {};
  const avail = kinds.map((g) => Math.max(0, have[g] - (reserve[g] ?? 0)));
  let bestCost = Infinity;
  let best: number[] | null = null;
  const pick: number[] = Array(kinds.length).fill(0);
  const search = (i: number, left: number, cost: number) => {
    if (cost >= bestCost) return;
    if (left <= 0) {
      const total = cost - left * 0.3; // a little waste is fine, but less is better
      if (total < bestCost) {
        bestCost = total;
        best = [...pick];
      }
      return;
    }
    if (i === kinds.length) return;
    const unit = per[kinds[i]]!;
    const max = Math.min(avail[i], Math.ceil(left / unit));
    for (let n = max; n >= 0; n--) {
      pick[i] = n;
      search(i + 1, left - n * unit, cost + n * KEEP[kinds[i]]);
    }
    pick[i] = 0;
  };
  search(0, need, 0);
  if (!best) return null;
  const chosen: number[] = best;
  const bag: Bag = {};
  kinds.forEach((g, k) => {
    if (chosen[k]) bag[g] = chosen[k];
  });
  return bag;
}

export const autoFood = (have: Goods, need: number, reserve?: Bag) => cheapest(have, need, FOOD_GOODS, FOOD, reserve);
export const autoFuel = (have: Goods, need: number, reserve?: Bag) => cheapest(have, need, FUEL_GOODS, ENERGY, reserve);

/** Food payment that may come up short; the remainder must be covered with loans. */
export function bestFood(have: Goods, need: number): Bag {
  const exact = autoFood(have, need);
  if (exact) return exact;
  const all: Bag = {};
  for (const g of FOOD_GOODS) if (have[g]) all[g] = have[g];
  return all;
}
