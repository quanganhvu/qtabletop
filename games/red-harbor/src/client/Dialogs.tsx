import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BASIC, FOOD_GOODS, FUEL_GOODS, GOODS, SHIP_VALUE, autoFuel, bagTotal, bestFood, compact, energyIn, foodIn,
  type Bag, type Good,
} from '../shared/goods';
import { LOAN_AMOUNT, SHIP_ENERGY, SHIP_INFO, building } from '../shared/data';
import {
  RuleError, TOWN, applyAction, buildCost, cannotEnter, entryFee, goodName, marketLimit, stackTops,
  type Action, type GameView, type PlayerState, type UseChoice,
} from '../shared/game';
import type { Flag } from '../shared/flags';
import { BagView, BuildingCard, GoodIcon, Num, ShipCard, cx, feeText } from './pieces';
import { FRANC } from '../shared/theme';

/** Runs a move on a copy of the game with the real rules: the preview, or why it's not allowed. */
export function simulate(game: GameView, you: string, action: Action): { after: GameView | null; error: string | null } {
  const copy = structuredClone(game);
  try {
    applyAction(copy, you, action);
    return { after: copy, error: null };
  } catch (err) {
    return { after: null, error: err instanceof RuleError ? err.message : 'Not allowed' };
  }
}

function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className={cx('panel dialog', wide && 'wide')} onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost tiny close" onClick={onClose} aria-label="Close">✕</button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, min = 0, max, onChange, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; label?: ReactNode }) {
  return (
    <span className="stepper">
      {label}
      <button type="button" className="btn tiny" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Less">−</button>
      <span className="stepper-n"><Num>{value}</Num></span>
      <button type="button" className="btn tiny" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More">+</button>
    </span>
  );
}

/** Steppers for a bag of goods, one per good. */
function BagPicker({ goods, have, bag, onChange, max }: { goods: readonly Good[]; have: Record<Good, number>; bag: Bag; onChange: (b: Bag) => void; max?: number }) {
  const total = bagTotal(bag);
  return (
    <div className="bag-picker">
      {goods.map((g) => (
        <Stepper
          key={g}
          label={<GoodIcon good={g} size={22} />}
          value={bag[g] ?? 0}
          max={Math.min(have[g], (bag[g] ?? 0) + (max === undefined ? Infinity : max - total))}
          onChange={(n) => onChange(compact({ ...bag, [g]: n }))}
        />
      ))}
    </div>
  );
}

/** Pick the fuel for `need` energy. Null fuel means "cheapest automatically". */
function FuelPicker({ need, have, reserve, fuel, onChange }: { need: number; have: Record<Good, number>; reserve: Bag; fuel: Bag | null; onChange: (f: Bag | null) => void }) {
  if (need <= 0) return null;
  const free = { ...have };
  for (const [g, n] of Object.entries(reserve)) free[g as Good] -= n ?? 0;
  const shown = fuel ?? autoFuel(have, need, reserve) ?? {};
  const got = energyIn(shown);
  return (
    <div className="fuel">
      <div className="fuel-head">
        <span>Energy: <b className={got < need ? 'warn-text' : ''}>{got}</b> of {need}</span>
        {fuel ? <button type="button" className="btn tiny ghost" onClick={() => onChange(null)}>Cheapest</button> : <span className="muted small">cheapest picked for you</span>}
      </div>
      <BagPicker goods={FUEL_GOODS.filter((g) => free[g] > 0)} have={free} bag={shown} onChange={onChange} />
    </div>
  );
}

/** What a move would cost and earn, or why it can't be done. */
function Preview({ game, you, action }: { game: GameView; you: string; action: Action | null }) {
  if (!action) return <div className="preview muted">Make your choice above.</div>;
  const { after, error } = simulate(game, you, action);
  if (error || !after) return <div className="preview error">{error}</div>;
  const ev = after.events.at(-1);
  if (ev?.kind !== 'use') return null;
  return (
    <div className="preview">
      <div><span className="muted">Pay</span> <BagView bag={ev.spent} empty="nothing" /></div>
      <div><span className="muted">Get</span> <BagView bag={ev.gained} empty="nothing" />
        {ev.built.map((id) => <b key={id}> · {building(id).name}</b>)}
        {ev.ship && <b> · {SHIP_INFO[ev.ship].name}</b>}
      </div>
    </div>
  );
}

// ---- Building dialog ----------------------------------------------------------

export function BuildingDialog({ game, me, id, flagOf, nameOf, act, onClose }: {
  game: GameView;
  me: PlayerState | null;
  id: string;
  flagOf: (playerId: string) => Flag;
  nameOf: (playerId: string) => string;
  act: (a: Action) => void;
  onClose: () => void;
}) {
  const def = building(id);
  const owner = game.owner[id];
  const built = owner !== undefined;
  const myTurn = !!me && (game.phase === 'turn' || game.phase === 'final') && game.players[game.current].id === me.id;
  const isTop = stackTops(game).includes(id);
  const canBuy = myTurn && !def.start && (owner === TOWN || isTop);
  const canSell = myTurn && owner === me?.id;
  const why = me ? cannotEnter(game, me.id, id) : 'You are spectating';
  const canUse = myTurn && !game.mainDone && built && !why;
  const fee = me ? entryFee(game, me.id, id) : def.fee;
  const workers = game.players.filter((p) => p.at === id);
  const run = (a: Action) => {
    act(a);
    onClose();
  };

  return (
    <Modal title={def.name} onClose={onClose} wide={canUse}>
      <div className="dialog-cols">
        <div className="dialog-card">
          <BuildingCard id={id} ownerFlag={owner && owner !== TOWN ? flagOf(owner) : null} workers={workers.map((p) => ({ flag: flagOf(p.id), name: p.name }))} />
          <p className="muted small">
            {!built ? 'A blueprint: build it at a construction bay, or buy it.' : owner === TOWN ? 'Owned by the Colony Authority.' : `Owned by ${nameOf(owner)}.`}
            {workers.length > 0 && ` Working here: ${workers.map((p) => `${p.name}'s engineer`).join(' and ')}.`}
          </p>
          <div className="dialog-actions">
            {canBuy && <button className="btn" disabled={me!.goods.franc < def.value} onClick={() => run({ type: 'buyBuilding', buildingId: id })}>Buy for {def.value}{FRANC}</button>}
            {canSell && <button className="btn" onClick={() => confirm(`Sell the ${def.name} to the colony for ${Math.floor(def.value / 2)}${FRANC}?`) && run({ type: 'sellBuilding', buildingId: id })}>Sell for {Math.floor(def.value / 2)}{FRANC}</button>}
          </div>
          {myTurn && built && !canUse && def.use.kind !== 'none' && (
            <p className="muted small">{game.mainDone ? "You've already taken your action this turn." : why}</p>
          )}
        </div>
        {canUse && me && (
          <div className="dialog-use">
            <h3>Use it {fee ? <span className="muted">· entry {feeText(fee)}{owner !== TOWN ? ` to ${nameOf(owner)}` : ''}</span> : <span className="muted">· your building, free</span>}</h3>
            <UseForm game={game} me={me} id={id} onUse={(choice) => run({ type: 'use', buildingId: id, choice })} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function UseForm({ game, me, id, onUse }: { game: GameView; me: PlayerState; id: string; onUse: (c: UseChoice) => void }) {
  const u = building(id).use;
  const have = me.goods;
  const [n, setN] = useState(1);
  const [fuel, setFuel] = useState<Bag | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [goods, setGoods] = useState<Bag>({});
  const [ships, setShips] = useState(1);
  const [target, setTarget] = useState<Good>('steel');

  let choice: UseChoice | null = {};
  let form: ReactNode = null;
  let need = 0;
  let reserve: Bag = {};

  switch (u.kind) {
    case 'none':
      return null;
    case 'gain':
    case 'court':
      break;
    case 'convert': {
      const max = Math.min(u.max ?? Infinity, have[u.from]);
      const count = Math.min(n, max);
      if (u.energy && count > 0) need = u.energy.per === 'all' ? u.energy.amount : Math.ceil(count / u.energy.per) * u.energy.amount;
      reserve = { [u.from]: count };
      form = max > 0
        ? <Stepper label={<>{goodName(u.from, 2)} <GoodIcon good={u.from} size={22} /> → <GoodIcon good={u.to} size={22} /></>} value={count} min={1} max={max} onChange={setN} />
        : <p className="muted">You have no {goodName(u.from, 2)}.</p>;
      choice = max > 0 ? { n: count } : null;
      break;
    }
    case 'build': {
      // Choosing a top reveals the card under it as a candidate for the second build.
      const options = [...stackTops(game)];
      if (u.count === 2) {
        for (const pick of picks) {
          const under = game.stacks.find((s) => s[0] === pick)?.[1];
          if (under && !options.includes(under)) options.push(under);
        }
      }
      const toggle = (b: string) => setPicks((ps) => ps.includes(b) ? ps.filter((x) => x !== b) : [...ps, b].slice(-u.count));
      form = (
        <div className="choice-grid">
          {options.map((b) => {
            const cost = buildCost(building(b), u.woodDiscount);
            return (
              <BuildingCard key={b} id={b} size="small" selected={picks.includes(b)} onClick={() => toggle(b)}
                note={<>Pay <BagView bag={cost} size={14} /></>} />
            );
          })}
          {!options.length && <p className="muted">No blueprints left.</p>}
        </div>
      );
      choice = picks.length ? { build: picks } : null;
      break;
    }
    case 'wharf': {
      const pick = game.harbour.find((s) => s.id === picks[0]);
      need = pick ? SHIP_ENERGY : 0;
      reserve = pick ? SHIP_INFO[pick.kind].materials : {};
      form = game.harbour.length ? (
        <div className="choice-grid">
          {game.harbour.map((s) => (
            <ShipCard key={s.id} kind={s.kind} selected={picks[0] === s.id} onClick={() => setPicks([s.id])}
              note={<>Pay <BagView bag={SHIP_INFO[s.kind].materials} size={14} /> + {SHIP_ENERGY} energy</>} />
          ))}
        </div>
      ) : <p className="muted">No rockets at the spaceport yet: one lands at the end of each Sol cycle.</p>;
      choice = pick ? { shipId: pick.id } : null;
      break;
    }
    case 'shipping': {
      const fleet = me.ships.map((s) => SHIP_INFO[s.kind].capacity).filter((c) => c > 0).sort((a, b) => b - a);
      const k = Math.min(Math.max(1, ships), fleet.length);
      const capacity = fleet.slice(0, k).reduce((a, b) => a + b, 0);
      need = SHIP_ENERGY * k;
      reserve = goods;
      const cargoGoods = GOODS.filter((g) => g !== 'franc' && have[g] > 0);
      const francs = Object.entries(goods).reduce((s, [g, c]) => s + SHIP_VALUE[g as Good] * (c ?? 0), 0);
      form = fleet.length ? (
        <>
          <Stepper label="Rockets to launch" value={k} min={1} max={fleet.length} onChange={setShips} />
          <p className="small">Cargo: {bagTotal(goods)} of {capacity} · earns <b>{francs}{FRANC}</b></p>
          <BagPicker goods={cargoGoods} have={have} bag={goods} onChange={setGoods} max={capacity} />
          <p className="muted small">Credit values on Earth: {cargoGoods.map((g) => `${goodName(g)} ${SHIP_VALUE[g]}`).join(' · ')}</p>
        </>
      ) : <p className="muted">You need a rocket that can carry cargo.</p>;
      choice = fleet.length && bagTotal(goods) ? { ships: k, goods } : null;
      break;
    }
    case 'market': {
      const limit = marketLimit(game, me.id);
      const toggle = (g: string) => setPicks((ps) => ps.includes(g) ? ps.filter((x) => x !== g) : ps.length < limit ? [...ps, g] : ps);
      form = (
        <>
          <p className="small">Pick up to {limit} different goods.</p>
          <div className="good-toggles">
            {BASIC.map((g) => (
              <button key={g} type="button" className={cx('good-toggle', picks.includes(g) && 'on')} onClick={() => toggle(g)}>
                <GoodIcon good={g} size={30} /><span>{goodName(g)}</span>
              </button>
            ))}
          </div>
        </>
      );
      choice = picks.length ? { goods: Object.fromEntries(picks.map((g) => [g, 1])) } : null;
      break;
    }
    case 'joinery': {
      const max = Math.min(3, have.wood);
      const count = Math.min(n, max);
      form = max ? <Stepper label={<>Wood <GoodIcon good="wood" size={22} /></>} value={count} min={1} max={max} onChange={setN} /> : <p className="muted">You have no wood.</p>;
      choice = max ? { n: count } : null;
      break;
    }
    case 'ironworks': {
      const extra = n === 1 && !!autoFuel(have, 6);
      need = extra ? 6 : 0;
      form = (
        <label className="check">
          <input type="checkbox" checked={extra} disabled={!autoFuel(have, 6)} onChange={(e) => setN(e.target.checked ? 1 : 0)} />
          Pay 6 energy for a 4th iron
        </label>
      );
      choice = { n: extra ? 1 : 0 };
      break;
    }
    case 'office': {
      const needGive = target === 'steel' ? 4 : 1;
      form = (
        <>
          <div className="good-toggles">
            {(['steel', 'charcoal', 'bricks', 'leather'] as const).map((g) => (
              <button key={g} type="button" className={cx('good-toggle', target === g && 'on')} onClick={() => { setTarget(g); setGoods({}); }}>
                <GoodIcon good={g} size={30} /><span>{goodName(g)}</span>
              </button>
            ))}
          </div>
          <p className="small">Give {needGive} good{needGive > 1 ? 's' : ''} ({bagTotal(goods)} chosen):</p>
          <BagPicker goods={GOODS.filter((g) => g !== 'franc' && have[g] > 0)} have={have} bag={goods} onChange={setGoods} max={needGive} />
        </>
      );
      choice = bagTotal(goods) === needGive ? { target, goods } : null;
      break;
    }
  }

  if (choice && need > 0 && fuel) choice = { ...choice, fuel };
  const action: Action | null = choice ? { type: 'use', buildingId: id, choice } : null;
  const ok = action && !simulate(game, me.id, action).error;

  return (
    <div className="use-form">
      {form}
      <FuelPicker need={need} have={have} reserve={reserve} fuel={fuel} onChange={setFuel} />
      <Preview game={game} you={me.id} action={action} />
      <button className="btn primary wide" disabled={!ok} onClick={() => choice && onUse(choice)}>Use the {building(id).name}</button>
    </div>
  );
}

// ---- Ships ----------------------------------------------------------------

export function ShipDialog({ game, me, shipId, act, onClose }: { game: GameView; me: PlayerState | null; shipId: string; act: (a: Action) => void; onClose: () => void }) {
  const inHarbour = game.harbour.find((s) => s.id === shipId);
  const mine = me?.ships.find((s) => s.id === shipId);
  const ship = inHarbour ?? mine;
  if (!ship) return null;
  const info = SHIP_INFO[ship.kind];
  const myTurn = !!me && (game.phase === 'turn' || game.phase === 'final') && game.players[game.current].id === me.id;
  const run = (a: Action) => {
    act(a);
    onClose();
  };
  return (
    <Modal title={info.name} onClose={onClose}>
      <div className="dialog-card">
        <ShipCard kind={ship.kind} />
        <p className="small">Worth {info.value}{FRANC} at the end. Provides {info.food} food every Sol cycle{info.capacity ? ` and carries ${info.capacity} goods from the Earth Export Line` : ''}.</p>
        {inHarbour && <p className="muted small">Assemble it at a launch pad for <BagView bag={info.materials} size={14} /> and {SHIP_ENERGY} energy{ship.kind === 'luxury' ? ' (Orbital Shipyard only)' : ''}, or buy it outright.</p>}
        <div className="dialog-actions">
          {myTurn && inHarbour && <button className="btn" disabled={me!.goods.franc < info.value} onClick={() => run({ type: 'buyShip', shipId })}>Buy for {info.value}{FRANC}</button>}
          {myTurn && mine && <button className="btn" onClick={() => confirm(`Sell this rocket for ${Math.floor(info.value / 2)}${FRANC}?`) && run({ type: 'sellShip', shipId })}>Sell for {Math.floor(info.value / 2)}{FRANC}</button>}
        </div>
      </div>
    </Modal>
  );
}

// ---- Feeding --------------------------------------------------------------

export function FeedDialog({ me, due, act, onHide }: { me: PlayerState; due: number; act: (a: Action) => void; onHide: () => void }) {
  const initial = useMemo(() => bestFood(me.goods, due), [me.goods, due]);
  const [pay, setPay] = useState<Bag>(initial);
  const food = foodIn(pay);
  const short = Math.max(0, due - food);
  const loans = Math.ceil(short / LOAN_AMOUNT);
  return (
    <Modal title="Life support" onClose={onHide}>
      <p>The Sol cycle is over. Your colonists need <b>{due} food</b> beyond what your rockets bring.</p>
      <BagPicker goods={FOOD_GOODS.filter((g) => me.goods[g] > 0)} have={me.goods} bag={pay} onChange={setPay} />
      <div className="preview">
        <div>Food paid: <b>{food}</b> of {due}{food > due && <span className="muted"> ({food - due} wasted)</span>}</div>
        {loans > 0 && <div className="warn-text">The remaining {short} food will be paid with {loans} new loan{loans > 1 ? 's' : ''} (−7{FRANC} each at the end unless repaid).</div>}
      </div>
      <div className="dialog-actions">
        <button className="btn ghost" onClick={() => setPay(initial)}>Reset</button>
        <button className="btn primary" onClick={() => act({ type: 'feed', payment: pay })}>Pay {loans ? `and take ${loans} loan${loans > 1 ? 's' : ''}` : ''}</button>
      </div>
    </Modal>
  );
}
