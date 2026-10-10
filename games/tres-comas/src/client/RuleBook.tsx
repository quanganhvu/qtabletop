import { useEffect } from 'react';
import { CHAINS, END_SIZE, HAND_SIZE, MAX_BUY, SAFE_SIZE, START_CASH, TIER, priceFor } from '../shared/game';
import { GAME_NAME, TIER_NAMES, chainName, money } from '../shared/theme';

const SIZE_BANDS: [string, number][] = [['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6–10', 6], ['11–20', 11], ['21–30', 21], ['31–40', 31], ['41+', 41]];

export function RuleBook({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const tiers = [0, 1, 2].map((t) => CHAINS.find((c) => TIER[c] === t)!);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal rulebook" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Rules">
        <div className="drawer-head"><h2>How to play {GAME_NAME}</h2><button className="btn tiny ghost" onClick={onClose}>✕</button></div>

        <p>Everyone starts with {money(START_CASH)} and {HAND_SIZE} tiles. The richest player at the end wins.</p>

        <h3>Your turn</h3>
        <ol>
          <li><strong>Play a tile</strong> on its matching square.</li>
          <li><strong>Buy up to {MAX_BUY} shares</strong> in any startups on the board.</li>
          <li>You draw back up to {HAND_SIZE} tiles automatically.</li>
        </ol>

        <h3>What a tile does</h3>
        <ul>
          <li><strong>Next to nothing:</strong> it just sits there.</li>
          <li><strong>Next to lone offices only:</strong> you <em>found</em> a startup, pick which one, and get a free founder's share. There are 7 startups; you can't found an 8th.</li>
          <li><strong>Next to one startup:</strong> it grows, along with any lone offices touching it.</li>
          <li><strong>Between two or more startups:</strong> an <em>acquisition</em>. The biggest one buys out the others (you pick if they're tied). Startups of {SAFE_SIZE}+ tiles are <em>too big to buy</em> and can't be taken over, so a tile joining two of them is dead and is replaced.</li>
        </ul>

        <h3>Mergers</h3>
        <p>
          For each chain that's taken over, the biggest shareholder gets the majority bonus (10× the share price) and the
          runner-up gets the minority bonus (5×). A sole holder gets both; ties split them. Then, starting with the player who
          merged, each holder chooses what to do with their shares: <strong>sell</strong> at the current price,
          <strong> trade</strong> 2 for 1 into the buyer, or <strong>keep</strong> them in case it's founded again.
        </p>

        <h3>Share prices</h3>
        <div className="price-table">
          <table>
            <thead><tr><th>Size</th>{tiers.map((c, t) => <th key={t}>{TIER_NAMES[t]}<div className="muted small">{CHAINS.filter((x) => TIER[x] === t).map(chainName).join(', ')}</div></th>)}</tr></thead>
            <tbody>
              {SIZE_BANDS.map(([label, size]) => (
                <tr key={label}><td>{label}</td>{tiers.map((c) => <td key={c}>{money(priceFor(c, size))}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>The end</h3>
        <p>
          On your turn you may declare the game over once a chain reaches {END_SIZE} tiles or every chain on the board is safe.
          Final bonuses are paid for every chain, all shares are sold, and the most cash wins.
        </p>
      </div>
    </div>
  );
}
