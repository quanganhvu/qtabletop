import { useEffect, useRef, useState } from 'react';
import type { GameEvent, GameView } from '../shared/game';
import { ROLES, VILLAGE } from '../shared/theme';
import { MOON, SUN } from './art/roles';
import { RoleEmblem, cx } from './pieces';
import { DeathFx } from './DeathFx';
import type { Cause } from '../shared/game';
import { covenWinSound, dawnSound, deathSound, nightSound, villageWinSound } from './sfx';

/** Something to show, and for how long (decided when it's queued). */
export type Shown = { id: string; ms: number; event: GameEvent };

const MS: Record<GameEvent['kind'], number> = { nightfall: 4200, dawn: 6200, lynch: 5600, shot: 5200, over: 4200 };

/**
 * Turns game updates into a queue of big moments to show over the village:
 * nightfall, the dawn's dead, the hanging, the Hunter's shot, the end. When
 * several arrive together the queue plays a little faster.
 */
export function useAnnouncements(game: GameView): Shown | null {
  const [queue, setQueue] = useState<Shown[]>([]);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    const lastSeq = game.events.at(-1)?.seq ?? 0;
    if (seen.current === null) {
      // First render (or a page refresh): don't replay history.
      seen.current = lastSeq;
      return;
    }
    const fresh = game.events.filter((e) => e.seq > seen.current!);
    seen.current = lastSeq;
    if (fresh.length) {
      setQueue((q) => [...q, ...fresh.map((e, i) => ({ id: `e${e.seq}`, event: e, ms: q.length + i > 0 ? MS[e.kind] * 0.9 : MS[e.kind] }))]);
    }
  }, [game]);

  const head = queue[0] ?? null;
  useEffect(() => {
    if (!head) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), head.ms);
    return () => clearTimeout(timer);
  }, [head]);
  return head;
}

export function Announcer({ item, game }: { item: Shown | null; game: GameView }) {
  useEffect(() => {
    if (!item) return;
    const e = item.event;
    if (e.kind === 'nightfall') nightSound();
    else if (e.kind === 'dawn') (e.deaths.length ? deathSound : dawnSound)();
    else if (e.kind === 'lynch' && e.id) deathSound();
    else if (e.kind === 'shot') deathSound();
    else if (e.kind === 'over') (e.winner === 'village' ? villageWinSound : covenWinSound)();
  }, [item?.id]);
  if (!item) return null;

  const name = (id: string) => (id === game.you ? 'You' : game.players.find((p) => p.id === id)?.name ?? 'Someone');
  const e = item.event;
  let sky: string | null = null;
  let title: string;
  let body: React.ReactNode = null;

  switch (e.kind) {
    case 'nightfall':
      sky = MOON;
      title = `Night ${e.day}`;
      body = <p className="ann-sub">{game.myRole === 'coven' ? 'The coven gathers. Choose who to curse.' : `${VILLAGE} bars its doors. Something whispers in the dark…`}</p>;
      break;
    case 'dawn':
      sky = SUN;
      title = `Dawn of day ${e.day}`;
      body = e.deaths.length ? (
        <div className="ann-dead">
          {e.deaths.map((d) => (
            <div key={d.id} className="ann-death">
              <RoleEmblem role={d.role} size={56} />
              <div>
                <b>{name(d.id)}</b> {d.id === game.you ? 'were' : 'was'} found dead
                {d.cause === 'poison' ? ', poisoned' : d.cause === 'curse' ? ', cursed' : ''}.
                <span className="ann-role">{d.id === game.you ? 'You were' : 'They were'} {ROLES[d.role].a}.</span>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="ann-sub">Everyone wakes. No one died in the night.</p>;
      break;
    case 'lynch':
      title = e.id ? 'The village has spoken' : 'No verdict';
      body = e.id && e.role ? (
        <div className="ann-death">
          <RoleEmblem role={e.role} size={56} />
          <div>
            <b>{name(e.id)}</b> {e.id === game.you ? 'were' : 'was'} hanged.
            <span className={cx('ann-role', e.role === 'coven' && 'wolf')}>{e.role === 'coven' ? 'A witch! One fewer curse in the dark.' : `An innocent: ${ROLES[e.role].a}.`}</span>
          </div>
        </div>
      ) : <p className="ann-sub">The votes were split, and no one was hanged.</p>;
      break;
    case 'shot':
      title = 'The Hunter’s last arrow';
      body = (
        <div className="ann-death">
          <RoleEmblem role={e.role} size={56} />
          <div>
            <b>{name(e.by)}</b> shot <b>{name(e.id)}</b>.
            <span className={cx('ann-role', e.role === 'coven' && 'wolf')}>{e.id === game.you ? 'You were' : 'They were'} {ROLES[e.role].a}.</span>
          </div>
        </div>
      );
      break;
    case 'over':
      sky = e.winner === 'village' ? SUN : MOON;
      title = e.winner === 'village' ? 'The village is saved!' : 'The coven has won';
      break;
  }

  // Deaths get a full-screen moment of horror behind the card.
  const cause: Cause | null = e.kind === 'dawn' ? e.deaths[0]?.cause ?? null : e.kind === 'lynch' ? (e.id ? 'lynch' : null) : e.kind === 'shot' ? 'hunter' : null;

  return (
    <div className="announcer" key={item.id}>
      {cause && <DeathFx cause={cause} ms={item.ms} />}
      <div className={cx('ann-card', e.kind)} style={{ animationDuration: `${item.ms}ms` }}>
        {sky && <span className="ann-sky" style={{ backgroundImage: sky }} />}
        <div className="ann-title">{title}</div>
        {body}
      </div>
    </div>
  );
}
