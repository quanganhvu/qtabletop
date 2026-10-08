import { useEffect, useRef, useState } from 'react';
import type { Chain, GameEvent, GameView } from '../shared/game';
import { chainName, money } from '../shared/theme';
import { chainStyle } from './ui';

interface Takeover {
  seq: number;
  survivor: Chain;
  defunct: Chain;
  payouts: { name: string; amount: number }[];
}

const SHOW_MS = 3600;

/**
 * Announces each takeover over the board: which chain swallows which, and who was paid the bonuses.
 * A merger of three chains shows two banners in turn. Takeovers from before this page loaded aren't replayed.
 */
export function MergeBanner({ game }: { game: GameView }) {
  const seen = useRef(Math.max(0, ...game.events.map((e) => e.seq)));
  const [queue, setQueue] = useState<Takeover[]>([]);

  useEffect(() => {
    const fresh = game.events.filter((e) => e.seq > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((e) => e.seq));
    const takeovers = fresh.flatMap((e): Takeover[] => {
      if (e.kind !== 'bonus') return [];
      const merge = game.events.findLast((m): m is Extract<GameEvent, { kind: 'merge' }> => m.kind === 'merge' && m.seq < e.seq);
      if (!merge) return [];
      const payouts = e.payouts.map(({ id, amount }) => ({ name: game.players.find((p) => p.id === id)?.name ?? '?', amount }));
      return [{ seq: e.seq, survivor: merge.survivor, defunct: e.chain, payouts }];
    });
    if (takeovers.length) setQueue((q) => [...q, ...takeovers]);
  }, [game.events, game.players]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(id);
  }, [current]);

  if (!current) return null;
  const { survivor, defunct, payouts } = current;
  return (
    <div key={current.seq} className="merge-banner" role="status">
      <div className="mb-kicker">Merger</div>
      <div className="mb-title">
        <span className="mb-chain defunct" style={chainStyle(defunct)}>{chainName(defunct)}</span>
        <span className="mb-arrow" aria-label="into">➜</span>
        <span className="mb-chain" style={chainStyle(survivor)}>{chainName(survivor)}</span>
      </div>
      <div className="mb-pay">
        {payouts.length
          ? payouts.map((p) => <span key={p.name}>{p.name} <b>+{money(p.amount)}</b></span>)
          : <span>No one held {chainName(defunct)} shares</span>}
      </div>
    </div>
  );
}
