import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { chainSizes, priceFor, type Chain, type Cell, type GameEvent, type GameView } from '../shared/game';
import { CHAIN_INFO, chainName, money } from '../shared/theme';
import { chainStyle, cx } from './ui';

interface Takeover {
  seq: number;
  survivor: Chain;
  defunct: Chain;
  /** How big the acquired startup was, and what its shares sold for. */
  size: number;
  price: number;
  payouts: { name: string; amount: number }[];
}

/** Shortest time a takeover stays up, so its whole story plays out. */
const MIN_MS = 6500;
/** How long it lingers once every shareholder has decided. */
const LINGER_MS = 2200;

/**
 * Plays each takeover in the middle of the screen, as a chain of effects: the
 * acquired startup is swallowed by its buyer, the bonuses are paid to its top
 * shareholders, and then each shareholder's decision (sell, trade or keep)
 * arrives live. A takeover of three startups shows two in turn. Takeovers from
 * before this page loaded aren't replayed.
 */
export function MergeBanner({ game, you }: { game: GameView; you: string | null }) {
  const seen = useRef(Math.max(0, ...game.events.map((e) => e.seq)));
  const prevBoard = useRef<readonly Cell[]>(game.board);
  const sizeBefore = useRef(new Map<Chain, number>());
  const [queue, setQueue] = useState<Takeover[]>([]);

  useEffect(() => {
    const fresh = game.events.filter((e) => e.seq > seen.current);
    // Remember how big each acquired startup was, from the board as it stood before this update.
    if (fresh.some((e) => e.kind === 'merge')) {
      const sizes = chainSizes(prevBoard.current);
      for (const e of fresh) if (e.kind === 'merge') for (const d of e.defuncts) sizeBefore.current.set(d, sizes[d]);
    }
    prevBoard.current = game.board;
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((e) => e.seq));
    const takeovers = fresh.flatMap((e): Takeover[] => {
      if (e.kind !== 'bonus') return [];
      const merge = game.events.findLast((m): m is Extract<GameEvent, { kind: 'merge' }> => m.kind === 'merge' && m.seq < e.seq);
      if (!merge) return [];
      const size = sizeBefore.current.get(e.chain) ?? 2;
      const payouts = e.payouts
        .map(({ id, amount }) => ({ name: id === you ? 'You' : game.players.find((p) => p.id === id)?.name ?? '?', amount }))
        .sort((a, b) => b.amount - a.amount);
      return [{ seq: e.seq, survivor: merge.survivor, defunct: e.chain, size, price: priceFor(e.chain, size), payouts }];
    });
    if (takeovers.length) setQueue((q) => [...q, ...takeovers]);
  }, [game.events, game.board, game.players, you]);

  const current = queue[0];
  // Is this startup's settling still going on?
  const settling = !!current && game.phase === 'merge' && game.merger?.defuncts[0] === current.defunct;
  const [shownAt, setShownAt] = useState(0);
  useEffect(() => {
    if (current) setShownAt(Date.now());
  }, [current?.seq]);
  useEffect(() => {
    if (!current || settling) return;
    const wait = Math.max(LINGER_MS, MIN_MS - (Date.now() - shownAt));
    const id = setTimeout(() => setQueue((q) => q.slice(1)), wait);
    return () => clearTimeout(id);
  }, [current, settling, shownAt]);

  if (!current) return null;
  const { survivor, defunct, size, price, payouts } = current;
  const grown = chainSizes(game.board)[survivor];
  const decisions = game.events.filter((e): e is Extract<GameEvent, { kind: 'dispose' }> => e.kind === 'dispose' && e.chain === defunct && e.seq > current.seq);
  const nameOf = (id: string) => (id === you ? 'You' : game.players.find((p) => p.id === id)?.name ?? '?');
  const deciding = settling && game.merger ? game.players[game.merger.decider] : null;
  const label = (i: number) => {
    const tied = payouts.length > 1 && payouts[0].amount === payouts[1].amount;
    if (tied && payouts.every((p) => p.amount === payouts[0].amount)) return 'Shared bonus';
    return i === 0 ? 'Majority bonus' : 'Minority bonus';
  };

  return (
    <div className="acq-overlay" role="dialog" aria-label={`${chainName(survivor)} acquires ${chainName(defunct)}`}>
      <div key={`fx${current.seq}`} className="acq-scenery" aria-hidden="true">
        <Candles />
        <NewsStrip className="top" text={`BREAKING · ${CHAIN_INFO[survivor].ticker} ACQUIRES ${CHAIN_INFO[defunct].ticker} · ${chainName(survivor).toUpperCase()} BUYS ${chainName(defunct).toUpperCase()} · DEAL CLOSED · `} />
        <NewsStrip className="bottom" text={`${CHAIN_INFO[survivor].ticker} ▲ ${money(priceFor(survivor, grown || 2))} · ${CHAIN_INFO[defunct].ticker} DELISTED · BONUSES PAID · ${payouts.map((x) => `${x.name.toUpperCase()} +${money(x.amount)}`).join(' · ')} · `} />
        <div className="acq-bills">{BILLS.map((bill, i) => <i key={i} style={{ '--x': `${bill.x}%`, '--d': `${bill.d}s`, '--t': `${bill.t}s`, '--r': `${bill.r}deg` } as CSSProperties}>$</i>)}</div>
      </div>
      <div key={current.seq} className="acq-card certificate">
        <span className="rosette tl" /><span className="rosette tr" /><span className="rosette bl" /><span className="rosette br" />
        <div className="acq-stamp" aria-hidden="true">Deal closed</div>
        <button className="acq-close btn tiny ghost" onClick={() => setQueue((q) => q.slice(1))} aria-label="Close">✕</button>
        <div className="acq-kicker">Acquisition</div>

        {/* 1. The buyer swallows the acquired startup. */}
        <div className="acq-stage">
          <div className="acq-co acquired" style={chainStyle(defunct)}>
            <span className="acq-logo" style={{ color: CHAIN_INFO[defunct].ink }}>{chainName(defunct)[0]}</span>
            <b>{chainName(defunct)}</b>
            <small>{size} offices · {CHAIN_INFO[defunct].pitch}</small>
          </div>
          <div className="acq-arrow" aria-hidden="true">➜</div>
          <div className="acq-co buyer" style={chainStyle(survivor)}>
            <span className="acq-logo" style={{ color: CHAIN_INFO[survivor].ink }}>{chainName(survivor)[0]}</span>
            <b>{chainName(survivor)}</b>
            <small><span className="acq-grow">now {grown} offices</span></small>
            <span className="acq-burst" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg` } as CSSProperties} />)}</span>
          </div>
        </div>
        <h2 className="acq-headline"><span style={{ color: CHAIN_INFO[survivor].color }}>{chainName(survivor)}</span> acquires <span style={{ color: CHAIN_INFO[defunct].color }}>{chainName(defunct)}</span></h2>

        {/* 2. Bonuses to the acquired startup's top shareholders. */}
        <div className="acq-step s2">
          <div className="acq-step-title"><span className="acq-n">1</span>Bonuses to {chainName(defunct)}'s top shareholders</div>
          {payouts.length ? (
            <ul className="acq-payouts">
              {payouts.map((p, i) => (
                <li key={p.name} style={{ '--i': i } as CSSProperties}>
                  <span className="acq-who">{p.name}</span>
                  <span className="acq-kind">{label(i)}</span>
                  <b className="acq-amount">+{money(p.amount)}</b>
                  <span className="acq-coins" aria-hidden="true"><i /><i /><i /></span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No one held {chainName(defunct)} shares, so no bonus is paid.</p>}
        </div>

        {/* 3. Every shareholder decides: sell, trade or keep. */}
        <div className="acq-step s3">
          <div className="acq-step-title"><span className="acq-n">2</span>{chainName(defunct)} shareholders decide</div>
          <div className="acq-options">
            <span><b>Sell</b> at {money(price)} each</span>
            <span><b>Trade</b> 2 → 1 {chainName(survivor)}</span>
            <span><b>Keep</b> for a comeback</span>
          </div>
          <ul className="acq-decisions">
            {decisions.map((d) => (
              <li key={d.seq} className="acq-decision">
                <b>{nameOf(d.playerId)}</b>
                {[d.sold && `sold ${d.sold}`, d.traded && `traded ${d.traded} for ${d.traded / 2} ${chainName(survivor)}`, d.kept && `kept ${d.kept}`].filter(Boolean).join(', ') || 'had none'}
              </li>
            ))}
            {deciding && <li className={cx('acq-decision', 'waiting')}><b>{deciding.id === you ? 'You' : deciding.name}</b>{deciding.id === you ? 'decide below…' : 'is deciding…'}</li>}
            {!settling && <li className="acq-decision done">All settled.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Dollar bills drifting down behind the dialog: where each starts, when, how fast and its tilt. */
const BILLS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 37) % 100,
  d: ((i * 7) % 10) / 4 + 0.6,
  t: 4 + ((i * 13) % 7) * 0.6,
  r: ((i * 53) % 60) - 30,
}));

/** A rising candlestick chart, drawn in behind the dialog. */
function Candles() {
  const n = 26;
  let v = 70;
  const candles = Array.from({ length: n }, (_, i) => {
    const open = v;
    const step = ((i * 47) % 13) - 4 + (i > n * 0.6 ? 3 : 1);
    v = Math.max(8, Math.min(92, v - step));
    const close = v;
    const hi = Math.min(open, close) - 3 - ((i * 11) % 5);
    const lo = Math.max(open, close) + 2 + ((i * 7) % 4);
    return { x: 4 + (i * 92) / (n - 1), open, close, hi, lo, up: close < open };
  });
  return (
    <svg className="acq-candles" viewBox="0 0 100 100" preserveAspectRatio="none">
      {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid" />)}
      {candles.map((k, i) => (
        <g key={i} className={k.up ? 'up' : 'down'} style={{ '--i': i } as CSSProperties}>
          <line x1={k.x} x2={k.x} y1={k.hi} y2={k.lo} />
          <rect x={k.x - 1.2} width="2.4" y={Math.min(k.open, k.close)} height={Math.max(1, Math.abs(k.open - k.close))} />
        </g>
      ))}
      <polyline className="trend" points={candles.map((k) => `${k.x},${k.close}`).join(' ')} />
    </svg>
  );
}

/** A scrolling news strip. */
function NewsStrip({ text, className }: { text: string; className: string }) {
  return (
    <div className={`acq-news ${className}`}>
      <div className="acq-news-track"><span>{text.repeat(4)}</span><span>{text.repeat(4)}</span></div>
    </div>
  );
}
