import type { CSSProperties, ReactNode } from 'react';
import { MATERIALS, type Bag, type Good } from '../shared/goods';
import { SHIP_INFO, building, type ShipKind } from '../shared/data';
import { goodName } from '../shared/game';
import { FLAG_HEX, type Flag } from '../shared/flags';
import { FRANC } from '../shared/theme';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

/** A number trimmed to its digit height, so it sits centered in a badge. */
export const Num = ({ children }: { children: ReactNode }) => <span className="num">{children}</span>;

// ---- Goods ----------------------------------------------------------------

/** One blade of the radiation trefoil, rotated three times for uranium. */
const BLADE = 'M13.5 9.4L17 3.34A10 10 0 0 0 7 3.34L10.5 9.4A3 3 0 0 1 13.5 9.4z';

/** Pictograms on a 24×24 grid, drawn in currentColor; `var(--tile)` cuts details out. */
const GLYPHS: Record<Exclude<Good, 'franc'>, string> = {
  fish: '<path d="M8 21c-3-4 1-7-1-11s1-6 2-7c1 3-1 5 1 9s1 7-2 9z"/><path d="M15.5 21c-2-3 2-6 0-9s1-5 2-6c1 2-1 4 1 7s1 6-3 8z"/>',
  smokedFish: '<rect x="3" y="7" width="18" height="11" rx="3.5"/><circle cx="8" cy="12" r="1.3" fill="var(--tile)"/><circle cx="12" cy="14" r="1.3" fill="var(--tile)"/><circle cx="16" cy="11.5" r="1.3" fill="var(--tile)"/>',
  wood: '<path d="M4 20C4 9 11 4 21 3c0 10-5 17-16 17z"/><path d="M5 19L15 9" stroke="var(--tile)" stroke-width="1.4"/>',
  charcoal: '<path d="M12 2c3 5 7 8.5 7 13a7 7 0 0 1-14 0c0-4.5 4-8 7-13z"/><path d="M9 15a3 3 0 0 0 3 3" fill="none" stroke="var(--tile)" stroke-width="1.5" stroke-linecap="round"/>',
  clay: '<path d="M2 19c2-6 5-9 8-9 2 0 3 1 4 2 1-1 2-1.5 3-1.5 3 0 4.5 3.5 5 8.5z"/><circle cx="7" cy="16" r="1.1" fill="var(--tile)"/><circle cx="15" cy="15.5" r="1.1" fill="var(--tile)"/><circle cx="11" cy="13" r=".9" fill="var(--tile)"/>',
  bricks: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 12l9-5M12 12L3 7M12 12v10" stroke="var(--tile)" stroke-width="1.3" fill="none"/>',
  iron: '<path d="M4 16l3-8 6-3 6 5-2 8-8 1z"/><path d="M9 10l3-1 2 3" fill="none" stroke="var(--tile)" stroke-width="1.3"/>',
  steel: '<path d="M4 4h16v3.5h-6v9h6V20H4v-3.5h6v-9H4z"/>',
  grain: '<path d="M11.3 22V8h1.4v14z"/><ellipse cx="12" cy="5" rx="1.6" ry="2.6"/><ellipse cx="9" cy="9" rx="1.5" ry="2.5" transform="rotate(-35 9 9)"/><ellipse cx="15" cy="9" rx="1.5" ry="2.5" transform="rotate(35 15 9)"/><ellipse cx="9" cy="14" rx="1.5" ry="2.5" transform="rotate(-35 9 14)"/><ellipse cx="15" cy="14" rx="1.5" ry="2.5" transform="rotate(35 15 14)"/>',
  bread: '<path d="M2 12h20a10 8 0 0 1-20 0z"/><path d="M7 9c0-2 2-2 2-4M12 9c0-2 2-2 2-4M17 9c0-2 2-2 2-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  cattle: '<ellipse cx="12" cy="14.5" rx="5.5" ry="6.5"/><circle cx="12" cy="6.5" r="2.8"/><path d="M6.5 11L2.5 9M6.5 14.5H2M7 18.5L3 20.5M17.5 11l4-2M17.5 14.5H22M17 18.5l4 2M10.5 4L9 1.5M13.5 4L15 1.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M12 9v12" stroke="var(--tile)" stroke-width="1.2"/>',
  meat: '<rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-30 12 12)"/><path d="M9.5 7.5l5 9" stroke="var(--tile)" stroke-width="1.5"/>',
  coal: `<path d="${BLADE}"/><path d="${BLADE}" transform="rotate(120 12 12)"/><path d="${BLADE}" transform="rotate(240 12 12)"/><circle cx="12" cy="12" r="1.8"/>`,
  coke: '<rect x="4.5" y="3" width="4" height="18" rx="2"/><rect x="10" y="3" width="4" height="18" rx="2"/><rect x="15.5" y="3" width="4" height="18" rx="2"/><path d="M4 8h16" stroke="var(--tile)" stroke-width="1.3"/>',
  hides: '<path d="M12 3c5 0 8 4 8 9s-3 9-8 9-8-4-8-9 3-9 8-9z"/><path d="M4.5 9h15M4 13.5h16M5.5 18h13" stroke="var(--tile)" stroke-width="1.3" fill="none"/>',
  leather: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><path d="M12 7l4.3 2.5v5L12 17l-4.3-2.5v-5z" fill="var(--tile)"/>',
};

export function GoodIcon({ good, size }: { good: Good; size?: number }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.7 } : undefined;
  return (
    <span className={cx('good-icon', `g-${good}`)} style={style} title={goodName(good, 2)} aria-label={goodName(good, 2)} role="img">
      {good === 'franc'
        ? <span className="franc-glyph">{FRANC}</span>
        : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GLYPHS[good] }} />}
    </span>
  );
}

/** A goods tile with a count. */
export function GoodCount({ good, n, size, faded }: { good: Good; n: number; size?: number; faded?: boolean }) {
  return (
    <span className={cx('good-count', faded && !n && 'zero')}>
      <GoodIcon good={good} size={size} />
      <span className="gc-n"><Num>{n}</Num></span>
    </span>
  );
}

/** A bag of goods written as icons with counts. */
export function BagView({ bag, size = 18, empty = '—' }: { bag: Bag; size?: number; empty?: string }) {
  const entries = Object.entries(bag).filter(([, n]) => (n ?? 0) > 0) as [Good, number][];
  if (!entries.length) return <span className="muted">{empty}</span>;
  return (
    <span className="bag">
      {entries.map(([g, n]) => (
        <span key={g} className="bag-item"><Num>{n}</Num><GoodIcon good={g} size={size} /></span>
      ))}
    </span>
  );
}

/** Goods heaped on a landing pad: up to 9 tiles scattered like a real pile. */
export function TokenPile({ good, n, size = 30 }: { good: Good; n: number; size?: number }) {
  const shown = Math.min(n, 9);
  return (
    <span className="pile" style={{ '--tok': `${size}px` } as CSSProperties}>
      {Array.from({ length: shown }, (_, i) => {
        // Deterministic scatter, so the pile doesn't jump around between renders.
        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = (col - 1) * size * 0.55 + ((i * 37) % 7) - 3;
        const y = -row * size * 0.3 + ((i * 53) % 5) - 2;
        const r = ((i * 71) % 21) - 10;
        return (
          <span key={i} className="pile-tok" style={{ transform: `translate(${x}px, ${y}px) rotate(${r}deg)`, zIndex: i }}>
            <GoodIcon good={good} size={size} />
          </span>
        );
      })}
    </span>
  );
}

// ---- Flags ----------------------------------------------------------------

function flagMark(flag: Flag): string {
  const m = FLAG_HEX[flag.mark];
  switch (flag.pattern) {
    case 'plain': return '';
    case 'band': return `<rect x="0" y="7" width="30" height="6" fill="${m}"/>`;
    case 'stripes': return `<rect y="0" width="30" height="4" fill="${m}"/><rect y="8" width="30" height="4" fill="${m}"/><rect y="16" width="30" height="4" fill="${m}"/>`;
    case 'pale': return `<rect x="10" width="10" height="20" fill="${m}"/>`;
    case 'diagonal': return `<path d="M0 20L30 0V20z" fill="${m}"/>`;
    case 'cross': return `<rect x="9" width="5" height="20" fill="${m}"/><rect y="7.5" width="30" height="5" fill="${m}"/>`;
    case 'saltire': return `<path d="M0 0L30 20M30 0L0 20" stroke="${m}" stroke-width="4"/>`;
    case 'border': return `<rect x="2.5" y="2.5" width="25" height="15" fill="none" stroke="${m}" stroke-width="4"/>`;
    case 'disc': return `<circle cx="15" cy="10" r="5.5" fill="${m}"/>`;
    case 'star': return `<path d="M15 3.5l1.9 4.2 4.6.5-3.4 3.1 1 4.5-4.1-2.4-4.1 2.4 1-4.5-3.4-3.1 4.6-.5z" fill="${m}"/>`;
    case 'quarters': return `<rect width="15" height="10" fill="${m}"/><rect x="15" y="10" width="15" height="10" fill="${m}"/>`;
    case 'chevron': return `<path d="M0 0L13 10L0 20z" fill="${m}"/>`;
  }
}

/** A colony corporation's flag. */
export function FlagIcon({ flag, size = 28, title }: { flag: Flag; size?: number; title?: string }) {
  const svg = `<rect width="30" height="20" fill="${FLAG_HEX[flag.field]}"/>${flagMark(flag)}<rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
  return (
    <span className="flag" role="img" aria-label={title ?? 'Corporation flag'} title={title} style={{ width: size, height: size * (2 / 3) }}>
      <svg viewBox="0 0 30 20" preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}

/** A player's engineer: their flag on a round token. */
export function Engineer({ flag, size = 28, title }: { flag: Flag; size?: number; title?: string }) {
  return (
    <span className="engineer" style={{ width: size, height: size, background: FLAG_HEX[flag.field], color: FLAG_HEX[flag.mark] }} title={title}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8" r="4.2" />
        <path d="M4 21c0-4.5 3.6-7.5 8-7.5s8 3 8 7.5z" />
      </svg>
    </span>
  );
}

// ---- Buildings and rockets --------------------------------------------------------

export const MODULE_ICON = { craft: '🔧', industry: '🏭', fishing: '🌱' } as const;
export const MODULE_NAME = { craft: 'workshop', industry: 'industry', fishing: 'farm' } as const;

export function feeText(fee: { food?: number; franc?: number } | null): string {
  if (!fee) return 'no entry';
  if (fee.franc) return `${fee.franc}${FRANC}`;
  return `${fee.food ?? 0} food`;
}

export function BuildingCard({ id, ownerFlag, workers = [], onClick, selected, highlight, size, note, dropTarget }: {
  id: string;
  ownerFlag?: Flag | null;
  /** Engineers standing in this building. */
  workers?: { flag: Flag; name: string }[];
  onClick?: () => void;
  selected?: boolean;
  highlight?: boolean;
  size?: 'small';
  note?: ReactNode;
  /** An engineer is being dragged and may be dropped here. */
  dropTarget?: boolean;
}) {
  const b = building(id);
  const kind = b.start ? 'start' : b.icons[0] ?? (b.use.kind === 'none' ? 'civic' : 'trade');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={cx('building', `k-${kind}`, size, onClick && 'clickable', selected && 'selected', highlight && 'usable', dropTarget && 'drop-target')}
      onClick={onClick}
      title={`${b.name}: ${b.text}`}
    >
      <div className="b-head">
        {b.num > 0 && <span className="b-num">{b.num}</span>}
        <span className="b-name">{b.name}</span>
        {b.icons.map((icon) => <span key={icon} className="b-icon" title={`${MODULE_NAME[icon]} module`}>{MODULE_ICON[icon]}</span>)}
        {ownerFlag && <FlagIcon flag={ownerFlag} size={18} />}
      </div>
      {size !== 'small' && <div className="b-text">{b.text}{b.bonus && <span className="b-bonus"> End: {b.bonus.text}.</span>}</div>}
      <div className="b-foot">
        <span className="b-cost" title="Building materials">
          {b.start ? <span className="muted">colony</span> : MATERIALS.filter((m) => b.cost[m]).map((m) => (
            <span key={m} className="bag-item"><Num>{b.cost[m]}</Num><GoodIcon good={m} size={14} /></span>
          ))}
        </span>
        <span className="b-fee" title="Entry fee">{feeText(b.fee)}</span>
        <span className="b-value" title="Value (price)">{b.value}{FRANC}</span>
      </div>
      {workers.length > 0 && (
        <div className="b-workers">
          {workers.map((w) => <Engineer key={w.name} flag={w.flag} size={24} title={`${w.name}'s engineer is working here`} />)}
        </div>
      )}
      {note && <div className="b-note">{note}</div>}
    </Tag>
  );
}

/** A rocket, flying right. Each class has its own silhouette. */
export function RocketArt({ kind }: { kind: ShipKind }) {
  return (
    <svg className="rocket-art" viewBox="0 0 64 28" aria-hidden="true">
      <path className="flame" d="M8 11.5L1 14l7 2.5z" />
      {kind === 'wooden' && <>
        <path d="M8 10h34c8 0 14 2 18 4-4 2-10 4-18 4H8z" fill="currentColor" />
        <path d="M20 10l8-8h6l-4 8zM20 18l8 8h6l-4-8z" fill="currentColor" opacity=".75" />
      </>}
      {kind === 'iron' && <>
        <path d="M8 9h38l14 5-14 5H8z" fill="currentColor" />
        <rect x="14" y="5" width="12" height="4" rx="1" fill="currentColor" opacity=".7" />
        <rect x="28" y="5" width="12" height="4" rx="1" fill="currentColor" opacity=".7" />
        <rect x="14" y="19" width="12" height="4" rx="1" fill="currentColor" opacity=".7" />
        <rect x="28" y="19" width="12" height="4" rx="1" fill="currentColor" opacity=".7" />
      </>}
      {kind === 'steel' && <>
        <path d="M8 9h40c6 0 10 2 12 5-2 3-6 5-12 5H8z" fill="currentColor" />
        <path d="M8 3h22c3 0 5 1 6 2-1 1-3 2-6 2H8zM8 21h22c3 0 5 1 6 2-1 1-3 2-6 2H8z" fill="currentColor" opacity=".7" />
      </>}
      {kind === 'luxury' && <>
        <path d="M8 8h36c8 0 14 3 16 6-2 3-8 6-16 6H8z" fill="currentColor" />
        <path d="M10 8l6-6h8l-3 6zM10 20l6 6h8l-3-6z" fill="currentColor" opacity=".7" />
      </>}
      <g className="windows">
        {(kind === 'luxury' ? [18, 23, 28, 33, 38, 43] : [40]).map((x) => <circle key={x} cx={x} cy="14" r="1.6" />)}
      </g>
    </svg>
  );
}

export function ShipCard({ kind, onClick, selected, note, size }: { kind: ShipKind; onClick?: () => void; selected?: boolean; note?: ReactNode; size?: 'small' }) {
  const s = SHIP_INFO[kind];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={cx('ship', `s-${kind}`, size, onClick && 'clickable', selected && 'selected')} onClick={onClick}
      title={`${s.name}: worth ${s.value}${FRANC}, supplies ${s.food} food each cycle, carries ${s.capacity}`}>
      <RocketArt kind={kind} />
      <div className="ship-name">{s.name}</div>
      {size !== 'small' && (
        <div className="ship-stats">
          <span title="Value">{s.value}{FRANC}</span>
          <span title="Food each Sol cycle">{s.food} food</span>
          {s.capacity > 0 && <span title="Export capacity">📦{s.capacity}</span>}
        </div>
      )}
      {note && <div className="b-note">{note}</div>}
    </Tag>
  );
}
