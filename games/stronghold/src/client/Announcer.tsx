import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TOKEN_COLORS, isHidden, type GameEvent, type GameView, type TokenColor } from '../shared/game';
import { CardView, ChipStack, Crest, NobleView, cx } from './pieces';
import type { Arms } from '../shared/heraldry';
import { POINTS_SYMBOL, houseName, place } from '../shared/theme';
import { turnChime } from './sfx';

/** Something to show, and for how long (decided when it's queued). */
export type Shown = { id: string; ms: number } & ({ kind: 'event'; event: GameEvent } | { kind: 'turn'; playerId: string });
type Pending = Shown extends infer S ? (S extends Shown ? Omit<S, 'ms'> : never) : never;

const EVENT_MS = 2100;
const TURN_MS = 1400;

/**
 * Turns game updates into a queue of things to show: what each player just
 * did, then whose turn it is. Each is shown for a moment; when moves pile up
 * (several bots in a row), the queue plays faster so it never falls behind.
 */
export function useAnnouncements(game: GameView, you: string | null): Shown | null {
  const [queue, setQueue] = useState<Shown[]>([]);
  // When moves pile up (several bots in a row), play them back at double speed.
  const enqueue = (items: Pending[]) =>
    setQueue((q) => [...q, ...items.map((it, i) => {
      const base = it.kind === 'turn' ? TURN_MS : EVENT_MS;
      return { ...it, ms: q.length + i > 1 ? base / 2 : base } as Shown;
    })]);
  const seen = useRef<{ seq: number; turn: number } | null>(null);

  useEffect(() => {
    const lastSeq = game.events.at(-1)?.seq ?? 0;
    if (!seen.current) {
      // First render (or page refresh): don't replay history, just say whose turn it is.
      seen.current = { seq: lastSeq, turn: game.turn };
      if (game.phase !== 'over') enqueue([{ id: `t${game.turn}`, kind: 'turn', playerId: game.players[game.current].id }]);
      return;
    }
    const items: Pending[] = game.events
      .filter((e) => e.seq > seen.current!.seq)
      .map((e) => ({ id: `e${e.seq}`, kind: 'event', event: e }));
    if (game.turn !== seen.current.turn && game.phase !== 'over') {
      items.push({ id: `t${game.turn}`, kind: 'turn', playerId: game.players[game.current].id });
    }
    seen.current = { seq: lastSeq, turn: game.turn };
    if (items.length) enqueue(items);
  }, [game, you]);

  // A "whose turn" banner is pointless once that turn is over (e.g. you already moved), so skip it.
  const currentId = game.phase === 'over' ? null : game.players[game.current].id;
  const stale = (item: Shown) => item.kind === 'turn' && item.playerId !== currentId;
  const head = queue[0] ?? null;
  useEffect(() => {
    if (!head) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), stale(head) ? 0 : head.ms);
    return () => clearTimeout(timer);
  }, [head, currentId]);

  return head && !stale(head) ? head : null;
}

export function Announcer({ item, game, you, armsOf }: {
  item: Shown | null;
  game: GameView;
  you: string | null;
  armsOf: (playerId: string) => Arms;
}) {
  const mineTurn = item?.kind === 'turn' && item.playerId === you;
  useEffect(() => {
    if (mineTurn) turnChime();
  }, [item?.id]); // chime once per "Your turn" banner
  if (!item) return null;
  const playerId = item.kind === 'turn' ? item.playerId : item.event.playerId;
  const realName = game.players.find((p) => p.id === playerId)?.name ?? 'Someone';
  const isYou = playerId === you;
  // Your own moves read "You took…"; the avatar still shows your initial.
  const name = isYou && item.kind === 'event' ? 'You' : realName;
  const who = (suffix = '') => (
    <span className="ann-who">
      <Crest arms={armsOf(playerId)} size={46} />
      {name}{suffix}
    </span>
  );

  if (item.kind === 'turn') {
    const mine = playerId === you;
    return (
      <div className="announcer" key={item.id} style={{ animationDuration: `${item.ms}ms` }}>
        <div className={cx('ann-card turn', mine && 'mine')} style={{ animationDuration: `${item.ms}ms` }}>
          {mine ? <div className="ann-title">Your turn!</div> : <div className="ann-title">{who("'s")}<span className="ann-sub">turn</span></div>}
        </div>
      </div>
    );
  }

  const e = item.event;
  let verb: string;
  let body: ReactNode = null;
  switch (e.kind) {
    case 'take':
      verb = 'took';
      body = <div className="ann-chips">{e.colors.map((c, i) => <ChipStack key={i} color={c} count={1} showCount={false} size={84} />)}</div>;
      break;
    case 'buy':
      verb = `bought the ${place(e.card.level, e.card.color)}`;
      body = (
        <div className="ann-row">
          <div className="ann-cardslot"><CardView card={e.card} /></div>
          {e.card.points > 0 && <div className="ann-points">+{e.card.points}{POINTS_SYMBOL}</div>}
        </div>
      );
      break;
    case 'reserve':
      verb = isHidden(e.card) ? 'reserved a secret card' : `reserved the ${place(e.card.level, e.card.color)}`;
      body = (
        <div className="ann-row">
          <div className="ann-cardslot"><CardView card={e.card} /></div>
          {e.gold && <><span className="ann-plus">+</span><ChipStack color="gold" count={1} showCount={false} size={84} /></>}
        </div>
      );
      break;
    case 'discard': {
      const colors = TOKEN_COLORS.flatMap((c) => Array<TokenColor>(e.tokens[c] ?? 0).fill(c));
      verb = 'put back';
      body = <div className="ann-chips">{colors.map((c, i) => <ChipStack key={i} color={c} count={1} showCount={false} size={60} dim />)}</div>;
      break;
    }
    case 'noble':
      verb = `won the allegiance of ${houseName(e.noble.id)}`;
      body = (
        <div className="ann-row">
          <div className="ann-nobleslot"><NobleView noble={e.noble} /></div>
          <div className="ann-points">+3{POINTS_SYMBOL}</div>
        </div>
      );
      break;
    case 'pass':
      verb = 'passed';
      break;
    case 'finalRound':
      verb = `reached ${e.points} renown!`;
      body = <div className="ann-final">Final round: everyone else gets one last turn</div>;
      break;
  }

  return (
    <div className="announcer" key={item.id}>
      <div className={cx('ann-card', e.kind)} style={{ animationDuration: `${item.ms}ms` }}>
        <div className="ann-title">{who()}<span className="ann-sub">{verb}</span></div>
        {body}
      </div>
    </div>
  );
}
