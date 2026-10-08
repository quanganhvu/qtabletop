import { useEffect, useRef, useState } from 'react';
import type { GameEvent, GameView } from '../shared/game';
import type { Arms } from '../shared/heraldry';
import { FEATURE_NAMES, POINTS_NAME } from '../shared/theme';
import { Crest, Meeple, TileFace, cx } from './pieces';
import { chipSound, sparkleSound, tileSound, turnChime } from './sfx';

type Announced = Extract<GameEvent, { kind: 'score' | 'discard' | 'final' }>;

/** Something to show, and for how long (decided when it's queued). */
export type Shown = { id: string; ms: number } & ({ kind: 'event'; event: Announced } | { kind: 'turn'; playerId: string });
type Pending = Shown extends infer S ? (S extends Shown ? Omit<S, 'ms'> : never) : never;

const EVENT_MS = 1900;
const TURN_MS = 1200;

/**
 * Turns game updates into a queue of things to show: scores, set-aside tiles,
 * then whose turn it is. Tile placements are shown on the board itself. When
 * several things happen at once, the queue plays faster so it never falls behind.
 */
export function useAnnouncements(game: GameView, you: string | null): Shown | null {
  const [queue, setQueue] = useState<Shown[]>([]);
  const enqueue = (items: Pending[]) =>
    setQueue((q) => [...q, ...items.map((it, i) => {
      const base = it.kind === 'turn' ? TURN_MS : EVENT_MS;
      return { ...it, ms: q.length + i > 1 ? base * 0.6 : base } as Shown;
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
      .filter((e): e is Announced & { seq: number } => e.seq > seen.current!.seq && e.kind !== 'place')
      .map((e) => ({ id: `e${e.seq}`, kind: 'event', event: e }));
    if (game.turn !== seen.current.turn && game.phase !== 'over') {
      items.push({ id: `t${game.turn}`, kind: 'turn', playerId: game.players[game.current].id });
    }
    seen.current = { seq: lastSeq, turn: game.turn };
    if (items.length) enqueue(items);
  }, [game, you]);

  // A "whose turn" banner is pointless once that turn is over, so skip it.
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

/** Wooden knocks for laid tiles and followers, as they happen. */
export function useEventSounds(game: GameView) {
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const lastSeq = game.events.at(-1)?.seq ?? 0;
    if (seen.current === null) {
      seen.current = lastSeq;
      return;
    }
    const fresh = game.events.filter((e) => e.seq > seen.current!);
    seen.current = lastSeq;
    const placed = fresh.find((e) => e.kind === 'place');
    if (placed) {
      tileSound();
      if (placed.kind === 'place' && placed.meeple !== null) setTimeout(chipSound, 140);
    }
  }, [game]);
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
    if (item?.kind === 'event' && item.event.kind === 'score') sparkleSound();
  }, [item?.id]); // once per banner
  if (!item) return null;

  const playerId = item.kind === 'turn' ? item.playerId : item.event.playerId;
  const seatOf = (id: string) => game.players.findIndex((p) => p.id === id);
  const nameOf = (id: string) => (id === you ? 'You' : game.players.find((p) => p.id === id)?.name ?? 'Someone');

  if (item.kind === 'turn') {
    const mine = playerId === you;
    return (
      <div className="announcer" key={item.id}>
        <div className={cx('ann-card turn', mine && 'mine')} style={{ animationDuration: `${item.ms}ms` }}>
          {mine
            ? <div className="ann-title">Your turn!</div>
            : <div className="ann-title"><span className="ann-who"><Crest arms={armsOf(playerId)} size={34} />{nameOf(playerId)}'s</span><span className="ann-sub">turn</span></div>}
        </div>
      </div>
    );
  }

  const e = item.event;
  let body;
  switch (e.kind) {
    case 'score': {
      const names = e.winners.map(nameOf);
      const what = FEATURE_NAMES[e.feature];
      const verb = e.feature === 'field' ? 'harvested a farm'
        : e.final ? `held an unfinished ${what.name}`
        : `finished ${/^[aeiou]/.test(what.name) ? 'an' : 'a'} ${what.name}`;
      body = (
        <>
          <div className="ann-title">
            <span className="ann-who">
              {e.winners.map((id) => <Meeple key={id} seat={seatOf(id)} size={34} lying={e.feature === 'field'} />)}
              {names.join(' & ')}
            </span>
            <span className="ann-sub">{verb}</span>
          </div>
          <div className="ann-points">+{e.points} <small>{POINTS_NAME}</small></div>
        </>
      );
      break;
    }
    case 'discard':
      body = (
        <div className="ann-row">
          <TileFace tile={e.tile} size={64} />
          <div className="ann-sub">This tile fits nowhere and is set aside.</div>
        </div>
      );
      break;
    case 'final':
      body = (
        <>
          <div className="ann-title">The last tile is laid</div>
          <div className="ann-sub">Unfinished roads, cities and abbeys score, then the farms.</div>
        </>
      );
      break;
  }
  return (
    <div className="announcer" key={item.id}>
      <div className={cx('ann-card', e.kind)} style={{ animationDuration: `${item.ms}ms` }}>{body}</div>
    </div>
  );
}
