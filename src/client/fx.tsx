import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { COLORS, TOKEN_COLORS, type GameView, type Level, type TokenColor } from '../shared/game';
import { CardView, NobleView } from './pieces';
import { cardSound, chipSound, sparkleSound } from './sfx';

// Pieces carry a `data-fly` key (e.g. "bank-red", "slot-2-1", "tok-<player>-red").
// Before each game update we remember where every key was on screen; after the
// update, each event becomes a "flight" from its old spot to its new one.

interface Box { x: number; y: number; w: number; h: number }

interface Flight {
  id: number;
  from: Box;
  to: Box;
  node: ReactNode;
  delay: number;
  duration: number;
  arc: number;
  sound?: () => void;
  onLand?: () => void;
}

interface Burst { id: number; x: number; y: number; colors: string[]; count: number }

const CHIP = 42;
/** Global pace for flying pieces: raise to slow everything down. */
const PACE = 1.15;
let nextId = 1;

function measureAll(): Map<string, Box> {
  const boxes = new Map<string, Box>();
  document.querySelectorAll<HTMLElement>('[data-fly]').forEach((el) => {
    const r = el.getBoundingClientRect();
    boxes.set(el.dataset.fly!, { x: r.left, y: r.top, w: r.width, h: r.height });
  });
  return boxes;
}

const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const square = (b: Box, size: number): Box => {
  const c = center(b);
  return { x: c.x - size / 2, y: c.y - size / 2, w: size, h: size };
};

export function useFx(game: GameView) {
  const boxes = useRef(new Map<string, Box>());
  const prev = useRef<GameView | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  // Cards being dealt stay invisible until their flight from the deck lands.
  const [incoming, setIncoming] = useState<Set<string>>(new Set());

  // Keep positions fresh when the page scrolls or resizes between updates.
  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => (boxes.current = measureAll()));
    };
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
      cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {
    const before = boxes.current;
    const now = measureAll();
    const old = prev.current;
    prev.current = game;
    boxes.current = now;
    if (!old || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lastSeq = old.events.at(-1)?.seq ?? 0;
    const events = game.events.filter((e) => e.seq > lastSeq);
    if (!events.length) return;

    const at = (key: string, source = now) => source.get(key) ?? before.get(key) ?? now.get(key);
    const newFlights: Flight[] = [];
    const newBursts: Burst[] = [];
    const deal: string[] = [];
    let step = 0;

    const fly = (fromKey: string | Box | undefined, toKey: string | Box | undefined, node: ReactNode, opts: Partial<Flight> & { chip?: boolean } = {}) => {
      const from = typeof fromKey === 'string' ? at(fromKey, before) : fromKey;
      const to = typeof toKey === 'string' ? at(toKey) : toKey;
      if (!from || !to) return;
      newFlights.push({
        id: nextId++,
        from: opts.chip ? square(from, CHIP) : from,
        to: opts.chip ? square(to, Math.max(18, Math.min(to.w, to.h, CHIP))) : to,
        node,
        delay: opts.delay ?? 0,
        duration: opts.duration ?? 700,
        arc: opts.arc ?? 90,
        sound: opts.sound,
        onLand: opts.onLand,
      });
    };
    const burstAt = (key: string, colors: string[], count = 18) => {
      const box = at(key);
      if (!box) return;
      const c = center(box);
      newBursts.push({ id: nextId++, x: c.x, y: c.y, colors, count });
    };
    const chipNode = (c: TokenColor) => <div className={`fly-chip ${c}`} />;
    const slotOf = (board: GameView['board'], id: string) => {
      for (const level of [1, 2, 3] as Level[]) {
        const i = board[level].findIndex((c) => c?.id === id);
        if (i !== -1) return `slot-${level}-${i}`;
      }
      return null;
    };

    for (const e of events) {
      const pid = e.playerId;
      const base = step * 380;
      step++;
      switch (e.kind) {
        case 'take':
          e.colors.forEach((c, i) =>
            fly(`bank-${c}`, `tok-${pid}-${c}`, chipNode(c), { chip: true, delay: base + i * 110, sound: chipSound }));
          break;
        case 'discard':
          TOKEN_COLORS.flatMap((c) => Array<TokenColor>(e.tokens[c] ?? 0).fill(c)).forEach((c, i) =>
            fly(`tok-${pid}-${c}`, `bank-${c}`, chipNode(c), { chip: true, delay: base + i * 90, sound: chipSound }));
          break;
        case 'reserve': {
          const from = e.fromDeck ? `deck-${e.card.level}` : slotOf(old.board, (e.card as { id: string }).id);
          fly(from ?? undefined, `reserve-${pid}`, <CardView card={e.card} />, { delay: base, duration: 800, sound: cardSound });
          if (e.gold) fly('bank-gold', `tok-${pid}-gold`, chipNode('gold'), { chip: true, delay: base + 250, sound: chipSound });
          break;
        }
        case 'buy': {
          const from = slotOf(old.board, e.card.id) ?? `card-${e.card.id}`;
          const fromBox = at(from, before) ?? at(`reserve-${pid}`, before);
          // Payment: whatever left the buyer's hand goes back to the bank.
          const was = old.players.find((p) => p.id === pid)?.tokens;
          const is = game.players.find((p) => p.id === pid)?.tokens;
          let n = 0;
          if (was && is) {
            for (const c of TOKEN_COLORS) {
              for (let k = 0; k < was[c] - is[c]; k++) {
                fly(`tok-${pid}-${c}`, `bank-${c}`, chipNode(c), { chip: true, delay: base + n++ * 70, duration: 600, sound: n === 1 ? chipSound : undefined });
              }
            }
          }
          fly(fromBox, `bonus-${pid}-${e.card.color}`, <CardView card={e.card} />, {
            delay: base + 120, duration: 850, arc: 140, sound: cardSound,
            onLand: e.card.points > 0 ? () => sparkleSound() : undefined,
          });
          if (e.card.points > 0) burstAt(`bonus-${pid}-${e.card.color}`, ['#ffe08a', '#fff', `var(--${e.card.color})`]);
          break;
        }
        case 'noble':
          fly(`noble-${e.noble.id}`, `points-${pid}`, <NobleView noble={e.noble} />, {
            delay: base + 300, duration: 1000, arc: 160, sound: sparkleSound,
          });
          burstAt(`points-${pid}`, ['#ffe08a', '#f3c64d', '#fff'], 28);
          break;
        default:
          step--;
      }
    }

    // Newly revealed board cards get dealt from their deck.
    for (const level of [1, 2, 3] as Level[]) {
      game.board[level].forEach((card, i) => {
        const before = old.board[level][i];
        if (!card || card.id === before?.id) return;
        deal.push(card.id);
        fly(`deck-${level}`, `slot-${level}-${i}`, <CardView card={{ blind: true, level }} />, {
          delay: step * 380 + 200, duration: 650, arc: 40, sound: cardSound,
          onLand: () => setIncoming((s) => {
            const next = new Set(s);
            next.delete(card.id);
            return next;
          }),
        });
      });
    }

    if (newFlights.length) setFlights((f) => [...f, ...newFlights]);
    if (newBursts.length) {
      // Bursts go off as their pieces arrive.
      setTimeout(() => setBursts((b) => [...b, ...newBursts]), 700 * PACE);
    }
    if (deal.length) setIncoming((s) => new Set([...s, ...deal]));
  }, [game]);

  const land = (f: Flight) => {
    f.onLand?.();
    setFlights((all) => all.filter((x) => x.id !== f.id));
  };
  const clearBurst = (id: number) => setBursts((all) => all.filter((b) => b.id !== id));

  return { incoming, layer: <FxLayer flights={flights} bursts={bursts} onLand={land} onBurstDone={clearBurst} /> };
}

function FxLayer({ flights, bursts, onLand, onBurstDone }: {
  flights: Flight[];
  bursts: Burst[];
  onLand: (f: Flight) => void;
  onBurstDone: (id: number) => void;
}) {
  return (
    <div className="fx-layer" aria-hidden="true">
      {flights.map((f) => <FlightView key={f.id} flight={f} onLand={onLand} />)}
      {bursts.map((b) => <BurstView key={b.id} burst={b} onDone={onBurstDone} />)}
    </div>
  );
}

function FlightView({ flight: f, onLand }: { flight: Flight; onLand: (f: Flight) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    const a = center(f.from);
    const b = center(f.to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const scale = Math.max(0.15, f.to.w / f.from.w);
    const lift = -Math.min(f.arc, 30 + Math.hypot(dx, dy) * 0.2);
    const spin = (Math.random() - 0.5) * 16;
    const anim = el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 0, offset: 0 },
        { transform: 'translate(0, -6px) scale(1.12)', opacity: 1, offset: 0.1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(${(1 + scale) * 0.6}) rotate(${spin}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1, offset: 1 },
      ],
      { duration: f.duration * PACE, delay: f.delay * PACE, easing: 'cubic-bezier(0.45, 0.05, 0.3, 1)', fill: 'both' },
    );
    const sound = f.sound && setTimeout(f.sound, f.delay * PACE);
    anim.finished.then(() => onLand(f), () => {});
    return () => {
      if (sound) clearTimeout(sound);
      anim.cancel();
    };
  }, []); // runs once: a flight never changes after it starts
  return (
    <div ref={ref} className="flight" style={{ left: f.from.x, top: f.from.y, width: f.from.w, height: f.from.h }}>
      {f.node}
    </div>
  );
}

function BurstView({ burst, onDone }: { burst: Burst; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(burst.id), 1100);
    return () => clearTimeout(t);
  }, []);
  const [parts] = useState(() =>
    Array.from({ length: burst.count }, (_, i) => {
      const angle = (i / burst.count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 50 + Math.random() * 70;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 20,
        size: 5 + Math.random() * 7,
        color: burst.colors[i % burst.colors.length],
        delay: Math.random() * 120,
      };
    }));
  return (
    <div className="burst" style={{ left: burst.x, top: burst.y }}>
      {parts.map((p, i) => (
        <span
          key={i}
          className="spark"
          style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, width: p.size, height: p.size, background: p.color, color: p.color, animationDelay: `${p.delay}ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}

/** Gems raining down for the end-of-game screen. */
export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 70 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      duration: 2.6 + Math.random() * 2.4,
      size: 10 + Math.random() * 14,
      spin: (Math.random() - 0.5) * 720,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })));
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`confetto ${p.color}`}
          style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, '--spin': `${p.spin}deg` } as CSSProperties}
        />
      ))}
    </div>
  );
}
