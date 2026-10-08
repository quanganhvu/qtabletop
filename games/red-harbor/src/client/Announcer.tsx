import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameEvent, GameView } from '../shared/game';
import { SHIP_INFO, building } from '../shared/data';
import type { Flag } from '../shared/flags';
import { BagView, BuildingCard, FlagIcon, GoodCount, ShipCard, cx } from './pieces';
import { FRANC } from '../shared/theme';
import { cardSound, chipSound, turnChime } from './sfx';

/** Something to show, and for how long (decided when it's queued). */
export type Shown = { id: string; ms: number } & ({ kind: 'event'; event: GameEvent } | { kind: 'turn'; playerId: string });
type Pending = Shown extends infer S ? (S extends Shown ? Omit<S, 'ms'> : never) : never;

const EVENT_MS = 2000;
const TURN_MS = 1300;

/** Events worth a banner; the rest only reach the log. */
const SHOWN = new Set<GameEvent['kind']>(['take', 'use', 'buyBuilding', 'sellBuilding', 'buyShip', 'sellShip', 'townBuilds', 'roundEnd', 'final']);

/**
 * Turns game updates into a queue of things to show: what each player just
 * did, then whose turn it is. When moves pile up (several bots in a row),
 * the queue plays faster so it never falls behind.
 */
export function useAnnouncements(game: GameView, you: string | null): Shown | null {
  const [queue, setQueue] = useState<Shown[]>([]);
  const enqueue = (items: Pending[]) =>
    setQueue((q) => [...q, ...items.map((it, i) => {
      const base = it.kind === 'turn' ? TURN_MS : EVENT_MS;
      return { ...it, ms: q.length + i > 1 ? base / 2 : base } as Shown;
    })]);
  const seen = useRef<{ seq: number; turn: number } | null>(null);

  useEffect(() => {
    const lastSeq = game.events.at(-1)?.seq ?? 0;
    const turnBanner = (): Pending[] => (game.phase === 'turn' || game.phase === 'final')
      ? [{ id: `t${game.turn}`, kind: 'turn', playerId: game.players[game.current].id }]
      : [];
    if (!seen.current) {
      // First render (or page refresh): don't replay history, just say whose turn it is.
      seen.current = { seq: lastSeq, turn: game.turn };
      enqueue(turnBanner());
      return;
    }
    const fresh = game.events.filter((e) => e.seq > seen.current!.seq);
    // Your own clicks don't need a banner, except for things that happen to everyone.
    const items: Pending[] = fresh
      .filter((e) => SHOWN.has(e.kind) && (e.playerId !== you || e.kind === 'roundEnd' || e.kind === 'townBuilds' || e.kind === 'final'))
      .map((e) => ({ id: `e${e.seq}`, kind: 'event', event: e }));
    for (const e of fresh) {
      if (e.kind === 'take' || e.kind === 'buyShip' || e.kind === 'sellShip' || e.kind === 'buyBuilding' || e.kind === 'sellBuilding') chipSound();
      else if (e.kind === 'use' || e.kind === 'townBuilds') cardSound();
    }
    if (game.turn !== seen.current.turn) items.push(...turnBanner());
    seen.current = { seq: lastSeq, turn: game.turn };
    if (items.length) enqueue(items);
  }, [game, you]);

  // A "whose turn" banner is pointless once that turn is over, so skip it.
  const currentId = game.phase === 'turn' || game.phase === 'final' ? game.players[game.current].id : null;
  const stale = (item: Shown) => item.kind === 'turn' && item.playerId !== currentId;
  const head = queue[0] ?? null;
  useEffect(() => {
    if (!head) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), stale(head) ? 0 : head.ms);
    return () => clearTimeout(timer);
  }, [head, currentId]);

  return head && !stale(head) ? head : null;
}

export function Announcer({ item, game, you, flagOf }: {
  item: Shown | null;
  game: GameView;
  you: string | null;
  flagOf: (playerId: string) => Flag;
}) {
  const mineTurn = item?.kind === 'turn' && item.playerId === you;
  useEffect(() => {
    if (mineTurn) turnChime();
  }, [item?.id]); // chime once per "Your turn" banner
  if (!item) return null;
  const playerId = item.kind === 'turn' ? item.playerId : item.event.playerId;
  const realName = game.players.find((p) => p.id === playerId)?.name ?? 'Someone';
  const name = playerId === you && item.kind === 'event' ? 'You' : realName;
  const who = (suffix = '') => (
    <span className="ann-who">
      <FlagIcon flag={flagOf(playerId)} size={40} />
      {name}{suffix}
    </span>
  );

  if (item.kind === 'turn') {
    return (
      <div className="announcer" key={item.id}>
        <div className={cx('ann-card turn', mineTurn && 'mine')} style={{ animationDuration: `${item.ms}ms` }}>
          {mineTurn
            ? <div className="ann-title">{game.phase === 'final' ? 'Your final action!' : 'Your turn!'}</div>
            : <div className="ann-title">{who("'s")}<span className="ann-sub">{game.phase === 'final' ? 'final action' : 'turn'}</span></div>}
        </div>
      </div>
    );
  }

  const e = item.event;
  let title: ReactNode = null;
  let body: ReactNode = null;
  switch (e.kind) {
    case 'take':
      title = <>{who()}<span className="ann-sub">took</span></>;
      body = <div className="ann-row"><GoodCount good={e.good} n={e.amount} size={56} /></div>;
      break;
    case 'use':
      title = <>{who()}<span className="ann-sub">used the {building(e.buildingId).name}</span></>;
      body = (
        <div className="ann-row">
          <div className="ann-building"><BuildingCard id={e.buildingId} /></div>
          <div className="ann-trade">
            {Object.keys(e.spent).length > 0 && <div><span className="muted">paid</span> <BagView bag={e.spent} size={24} /></div>}
            {Object.keys(e.gained).length > 0 && <div><span className="muted">got</span> <BagView bag={e.gained} size={24} /></div>}
            {e.built.map((id) => <div key={id}><span className="muted">built</span> <b>{building(id).name}</b></div>)}
            {e.ship && <div><span className="muted">assembled a</span> <b>{SHIP_INFO[e.ship].name.toLowerCase()}</b></div>}
          </div>
        </div>
      );
      break;
    case 'buyBuilding':
    case 'sellBuilding':
      title = <>{who()}<span className="ann-sub">{e.kind === 'buyBuilding' ? 'bought' : 'sold'} the {building(e.buildingId).name} for {e.price}{FRANC}</span></>;
      body = <div className="ann-row"><div className="ann-building"><BuildingCard id={e.buildingId} /></div></div>;
      break;
    case 'buyShip':
    case 'sellShip':
      title = <>{who()}<span className="ann-sub">{e.kind === 'buyShip' ? 'bought' : 'sold'} a {SHIP_INFO[e.ship].name.toLowerCase()} for {e.price}{FRANC}</span></>;
      body = <div className="ann-row"><ShipCard kind={e.ship} /></div>;
      break;
    case 'townBuilds':
      title = <span className="ann-sub">The Colony Authority built the {building(e.buildingId).name}</span>;
      body = <div className="ann-row"><div className="ann-building"><BuildingCard id={e.buildingId} /></div></div>;
      break;
    case 'roundEnd':
      title = <span className="ann-sub">Sol cycle {e.round} is over</span>;
      body = <div className="ann-final">{e.harvest ? 'Greenhouse yield! ' : ''}Every colony must supply {e.food} food.</div>;
      break;
    case 'final':
      title = <span className="ann-sub">The last cycle has ended</span>;
      body = <div className="ann-final">Everyone takes one final action, in any module.</div>;
      break;
    default:
      return null;
  }

  return (
    <div className="announcer" key={item.id}>
      <div className={cx('ann-card', e.kind)} style={{ animationDuration: `${item.ms}ms` }}>
        <div className="ann-title">{title}</div>
        {body}
      </div>
    </div>
  );
}
