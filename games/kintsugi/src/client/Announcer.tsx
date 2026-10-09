import { useEffect, useRef, useState } from 'react';
import type { GameEvent, GameView } from '../shared/game';
import type { Arms } from '../shared/heraldry';
import { CENTER_NAME, POINTS_NAME, colorName, kilnName, rowName } from '../shared/theme';
import { Crest, Seal, Seam, Tile, cx } from './pieces';
import { breakSound, roundSound, setSound, takeSound, turnChime } from './sfx';

type Announced = GameEvent;

/** Something to show, and for how long (decided when it's queued). */
export type Shown = { id: string; ms: number } & ({ kind: 'event'; event: Announced } | { kind: 'turn'; playerId: string });
type Pending = Shown extends infer S ? (S extends Shown ? Omit<S, 'ms'> : never) : never;

const MS: Record<string, number> = { take: 1500, round: 5200, final: 3200, turn: 1300 };

/**
 * Turns game updates into a queue of things to show: what others took, the end
 * of each round, then whose turn it is. Your own takes aren't announced: you
 * just made them. When several things happen at once, the queue plays faster.
 */
export function useAnnouncements(game: GameView, you: string | null): Shown | null {
  const [queue, setQueue] = useState<Shown[]>([]);
  const enqueue = (items: Pending[]) =>
    setQueue((q) => [...q, ...items.map((it, i) => {
      const base = MS[it.kind === 'turn' ? 'turn' : it.event.kind];
      const hurry = q.length + i > 1 && !(it.kind === 'event' && it.event.kind !== 'take');
      return { ...it, ms: hurry ? base * 0.6 : base } as Shown;
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
      .filter((e) => e.seq > seen.current!.seq && !(e.kind === 'take' && e.playerId === you))
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

/** Clacks as tiles are taken (and a crack if some break), straight away for every take. */
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
    const taken = fresh.find((e) => e.kind === 'take');
    if (taken?.kind === 'take') {
      takeSound(taken.count);
      if (taken.overflow || taken.target === 'floor') setTimeout(breakSound, 260);
      else setTimeout(setSound, 300);
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
    if (item?.kind === 'event' && item.event.kind === 'round') roundSound();
  }, [item?.id]); // once per banner
  if (!item) return null;

  const nameOf = (id: string) => (id === you ? 'You' : game.players.find((p) => p.id === id)?.name ?? 'Someone');

  if (item.kind === 'turn') {
    // Your own turn is stamped onto your board instead (see TurnStamp).
    if (item.playerId === you) return null;
    return (
      <div className="announcer" key={item.id}>
        <div className="paper ann-card turn" style={{ animationDuration: `${item.ms}ms` }}>
          <div className="ann-title"><span className="ann-who"><Crest arms={armsOf(item.playerId)} size={30} />{nameOf(item.playerId)}'s</span><span className="ann-sub">turn</span></div>
        </div>
      </div>
    );
  }

  const e = item.event;
  let body;
  let center = false;
  switch (e.kind) {
    case 'take': {
      const from = e.source === 'center' ? CENTER_NAME : kilnName(e.source);
      body = (
        <>
          <div className="ann-title">
            <span className="ann-who"><Crest arms={armsOf(e.playerId)} size={30} />{nameOf(e.playerId)}</span>
            <span className="ann-sub">took from {from}</span>
          </div>
          <div className="ann-row">
            <span className="ann-tiles">{Array.from({ length: e.count }, (_, i) => <Tile key={i} color={e.color} style={{ animationDelay: `${i * 60}ms` }} />)}</span>
            {e.first && <Seal />}
            <span className="ann-sub">
              {e.target === 'floor'
                ? `${e.count} ${colorName(e.color)}, all to the floor`
                : `${e.count} ${colorName(e.color)} for ${rowName(e.target)}${e.overflow ? `, ${e.overflow} broken` : ''}`}
            </span>
          </div>
        </>
      );
      break;
    }
    case 'round':
      center = true;
      body = (
        <>
          <div className="ann-title">The walls are tiled</div>
          <div className="ann-sub">End of round {e.round}</div>
          <ul className="ann-scores">
            {e.scores.map((s) => {
              const gained = s.settings.reduce((a, x) => a + x.points, 0);
              return (
                <li key={s.playerId} className={cx(s.playerId === you && 'mine')}>
                  <span className="ann-score-who"><Crest arms={armsOf(s.playerId)} size={22} />{nameOf(s.playerId)}</span>
                  <span className="ann-set">{s.settings.map((x) => <Tile key={x.row} color={x.color} />)}</span>
                  <span className="ann-delta">
                    {gained > 0 && <span className="plus">+{gained}</span>}
                    {s.broken > 0 && <span className="minus">−{s.broken}</span>}
                    {!gained && !s.broken && <span className="muted">—</span>}
                  </span>
                  <b className="ann-total">{s.total}</b>
                </li>
              );
            })}
          </ul>
        </>
      );
      break;
    case 'final':
      center = true;
      body = (
        <>
          <div className="ann-title">A wall row is finished!</div>
          <div className="ann-sub">The last round is over. Bonuses for finished rows, columns and colors:</div>
          <ul className="ann-scores">
            {e.bonuses.map((b) => (
              <li key={b.playerId} className={cx(b.playerId === you && 'mine')}>
                <span className="ann-score-who"><Crest arms={armsOf(b.playerId)} size={22} />{nameOf(b.playerId)}</span>
                <span className="ann-delta"><span className="plus">+{b.rows + b.columns + b.colors}</span> <small className="muted">{POINTS_NAME}</small></span>
              </li>
            ))}
          </ul>
        </>
      );
      break;
  }
  return (
    <div className={cx('announcer', center && 'center')} key={item.id}>
      <div className={cx('paper ann-card', e.kind)} style={{ animationDuration: `${item.ms}ms` }}>{e.kind !== 'take' && <Seam />}{body}</div>
    </div>
  );
}

/** "Your turn", stamped onto your board in red like a seal, where you are about to play. */
export function TurnStamp({ item, you }: { item: Shown | null; you: string | null }) {
  if (item?.kind !== 'turn' || item.playerId !== you) return null;
  return (
    <div className="turn-stamp" key={item.id} style={{ animationDuration: `${item.ms}ms` }} aria-live="polite">
      <span>Your turn</span>
    </div>
  );
}
