import { useEffect, useRef, useState } from 'react';
import { CHAINS, chainSizes, priceFor, type Chain, type GameView } from '../shared/game';
import { CHAIN_INFO, money } from '../shared/theme';
import { chainStyle, cx } from './ui';

/** Each listed startup's share price over time: one point every time it changes. Empty when not listed. */
export type History = Record<Chain, number[]>;

const MAX_POINTS = 40;
const empty = (): History => Object.fromEntries(CHAINS.map((c) => [c, []])) as unknown as History;

function load(key: string): History {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (saved && CHAINS.every((c) => Array.isArray(saved[c]))) return saved;
  } catch {
    // fall through
  }
  return empty();
}

/**
 * Follows every startup's share price as the board changes. A price is recorded
 * when a startup is founded (its IPO) and every time it moves; an acquired
 * startup is delisted and starts afresh if it's founded again. Kept per tab, so
 * a page refresh doesn't wipe the charts.
 */
export function usePriceHistory(game: GameView, room: string): History {
  const key = `trescomas.prices.${room}`;
  const [history, setHistory] = useState<History>(() => load(key));
  const last = useRef(history);
  useEffect(() => {
    const sizes = chainSizes(game.board);
    const prev = last.current;
    let changed = false;
    const next = { ...prev };
    for (const c of CHAINS) {
      const listed = sizes[c] > 0;
      const series = prev[c];
      if (!listed) {
        if (series.length) { next[c] = []; changed = true; }
        continue;
      }
      const price = priceFor(c, sizes[c]);
      if (series.at(-1) !== price) {
        next[c] = [...series, price].slice(-MAX_POINTS);
        changed = true;
      }
    }
    if (!changed) return;
    last.current = next;
    setHistory(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {
      // storage unavailable: the charts just won't survive a refresh
    }
  }, [game.board, key]);
  return history;
}

/** The latest move of a price: up, down, or a fresh listing. */
export function move(series: number[]): { dir: 'up' | 'down' | 'ipo' | 'none'; delta: number; pct: number } {
  if (!series.length) return { dir: 'none', delta: 0, pct: 0 };
  if (series.length === 1) return { dir: 'ipo', delta: 0, pct: 0 };
  const [a, b] = series.slice(-2);
  return { dir: b > a ? 'up' : b < a ? 'down' : 'none', delta: b - a, pct: ((b - a) / a) * 100 };
}

/** A small line chart of a price series. */
export function Sparkline({ series, width = 64, height = 22 }: { series: number[]; width?: number; height?: number }) {
  if (series.length < 2) return <svg className="spark" width={width} height={height} aria-hidden="true"><path d={`M2 ${height / 2}H${width - 2}`} className="spark-flat" /></svg>;
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const x = (i: number) => 2 + (i / (series.length - 1)) * (width - 4);
  const y = (v: number) => (hi === lo ? height / 2 : height - 3 - ((v - lo) / (hi - lo)) * (height - 6));
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const up = series.at(-1)! >= series[0];
  return (
    <svg className={cx('spark', up ? 'up' : 'down')} width={width} height={height} aria-hidden="true">
      <path d={`${line}L${x(series.length - 1).toFixed(1)} ${height}L2 ${height}Z`} className="spark-fill" />
      <path d={line} className="spark-line" />
      <circle cx={x(series.length - 1)} cy={y(series.at(-1)!)} r="2" className="spark-dot" />
    </svg>
  );
}

/** A price-move badge: ▲ +$100, ▼ −$100, or IPO. */
export function Change({ series }: { series: number[] }) {
  const m = move(series);
  if (m.dir === 'ipo') return <span className="chg ipo">IPO</span>;
  if (m.dir === 'none') return <span className="chg flat">—</span>;
  return <span className={cx('chg', m.dir)}>{m.dir === 'up' ? '▲' : '▼'} {Math.abs(m.pct).toFixed(1)}%</span>;
}

/** The ticker tape across the top: every startup's symbol, price and latest move, scrolling. */
export function TickerTape({ game, history }: { game: GameView; history: History }) {
  const sizes = chainSizes(game.board);
  const items = CHAINS.map((c) => {
    const listed = sizes[c] > 0;
    return (
      <span key={c} className={cx('tape-item', !listed && 'unlisted')} style={chainStyle(c)}>
        <b className="tape-sym">{CHAIN_INFO[c].ticker}</b>
        {listed
          ? <><span className="tape-price">{money(priceFor(c, sizes[c]))}</span><Change series={history[c]} /></>
          : <span className="tape-off">not listed</span>}
      </span>
    );
  });
  return (
    <div className="tape" aria-label="Share prices">
      {/* Two copies side by side, so the scroll loops without a gap. */}
      <div className="tape-track">
        <div className="tape-run">{items}</div>
        <div className="tape-run" aria-hidden="true">{items}</div>
      </div>
    </div>
  );
}
