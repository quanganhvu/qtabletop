import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { COLORS, isHidden, type Card, type HiddenCard, type Level, type Noble, type TokenColor } from '../shared/game';
import { POINTS_SYMBOL, TIER_NAMES, houseName, place, resource } from '../shared/theme';
import { armsUrl, crestUrl } from './art/heraldry';
import type { Arms } from '../shared/heraldry';
import { ResourceIcon } from './art/icons';
import { sceneUrl } from './art/scenes';

export { ResourceIcon };

/** A number trimmed to its digit height, so it sits dead center in a circle or badge. */
export const Num = ({ children }: { children: ReactNode }) => <span className="num">{children}</span>;

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' } as const;

interface Clickable {
  onClick?: () => void;
  selected?: boolean;
  highlight?: boolean;
  /** Position key used by the animation layer (see fx.tsx). */
  fly?: string;
}

function BackEmblem({ level, plural }: { level: Level; plural?: boolean }) {
  return (
    <span className="back-emblem">
      <span className="roman">{ROMAN[level]}</span>
      <span className="back-name">{TIER_NAMES[level]}{plural ? 's' : ''}</span>
    </span>
  );
}

export function CardView({ card, size, onClick, selected, highlight, fly, hidden }: { card: Card | HiddenCard | null; size?: 'mini' | 'small'; hidden?: boolean } & Clickable) {
  if (!card) return <div className="card empty" data-fly={fly} />;
  if (isHidden(card)) {
    return (
      <div className={cx('card back', `lvl${card.level}`, size)} title={`Secret tier ${card.level} card`} data-fly={fly}>
        <BackEmblem level={card.level} />
      </div>
    );
  }
  const name = place(card.level, card.color);
  return (
    <div
      className={cx('card face', card.color, size, onClick && 'clickable', selected && 'selected', highlight && 'affordable', hidden && 'incoming')}
      style={{ '--art': sceneUrl(card.level, card.color) } as CSSProperties}
      onClick={onClick}
      data-fly={fly}
      role={onClick ? 'button' : undefined}
      title={`${name}: a permanent ${resource(card.color)} discount${card.points ? `, ${card.points} renown` : ''}`}
    >
      <div className="card-art" />
      <div className="card-head">
        <span className="card-pts">{card.points || ''}</span>
        <span className={cx('card-bonus', card.color)}><ResourceIcon color={card.color} /></span>
      </div>
      <div className="card-cost">
        {COLORS.filter((c) => card.cost[c] > 0).map((c) => (
          <span key={c} className={cx('pip', c)} title={`${card.cost[c]} ${resource(c, card.cost[c])}`}><Num>{card.cost[c]}</Num></span>
        ))}
      </div>
    </div>
  );
}

export function DeckView({ level, count, onClick, selected, fly }: { level: Level; count: number } & Clickable) {
  return (
    <div
      data-fly={fly}
      className={cx('card back deck', `lvl${level}`, !count && 'depleted', onClick && 'clickable', selected && 'selected')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      title={`${TIER_NAMES[level]} deck: ${count} left. Click to reserve the top card secretly.`}
    >
      <BackEmblem level={level} plural />
      <span className="deck-count"><Num>{count}</Num></span>
    </div>
  );
}

export function NobleView({ noble, onClick, highlight, size, fly }: { noble: Noble; size?: 'mini' } & Clickable) {
  return (
    <div
      className={cx('noble', size, onClick && 'clickable', highlight && 'eligible')}
      style={{ '--crest': crestUrl(noble.id) } as CSSProperties}
      onClick={onClick}
      title={`${houseName(noble.id)}: pledges ${noble.points} renown once your holdings impress them`}
      data-fly={fly}
    >
      <span className="noble-pts">{noble.points}<i>{POINTS_SYMBOL}</i></span>
      <div className="noble-req">
        {COLORS.filter((c) => noble.req[c] > 0).map((c) => (
          <span key={c} className={cx('req', c)} title={`${noble.req[c]} ${resource(c)} holdings`}><Num>{noble.req[c]}</Num></span>
        ))}
      </div>
    </div>
  );
}

/** A small single token with a number on it. */
export function Chip({ color, count, onClick, faded, fly }: { color: TokenColor; count?: number; onClick?: () => void; faded?: boolean; fly?: string }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className={cx('chip', color, faded && 'zero', onClick && 'clickable')} onClick={onClick} title={resource(color)} data-fly={fly}>
      {count !== undefined && <Num>{count}</Num>}
    </Tag>
  );
}

/** A stack of coins: it grows with the count and the top coin bears the resource's emblem. */
export function ChipStack({ color, count, showCount = true, size = 56, maxLayers = 7, onClick, picked, dim, title, fly, children }: {
  color: TokenColor;
  count: number;
  showCount?: boolean;
  size?: number;
  maxLayers?: number;
  onClick?: () => void;
  picked?: boolean;
  dim?: boolean;
  title?: string;
  fly?: string;
  children?: ReactNode;
}) {
  const layers = Math.max(1, Math.min(count, maxLayers));
  const step = Math.max(2, Math.round(size / 16));
  const style = { '--size': `${size}px`, '--step': `${step}px`, height: size + (layers - 1) * step } as CSSProperties;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={cx('stack', color, count === 0 && 'empty', onClick && 'clickable', picked && 'picked', dim && 'dim')}
      style={style}
      onClick={onClick}
      title={title ?? resource(color, 2)}
      type={onClick ? 'button' : undefined}
      data-fly={fly}
    >
      {Array.from({ length: layers - 1 }, (_, i) => (
        <span key={i} className="chip-layer" style={{ bottom: i * step }} />
      ))}
      <span className="chip-top" style={{ bottom: (layers - 1) * step }}>
        <ResourceIcon color={color} />
        {showCount && <span key={count} className="chip-count pop"><Num>{count}</Num></span>}
      </span>
      {children}
    </Tag>
  );
}

/** A player's coat of arms. */
export function Crest({ arms, size = 28, title }: { arms: Arms; size?: number; title?: string }) {
  return (
    <span
      className="crest"
      role="img"
      aria-label={title ?? 'Coat of arms'}
      title={title}
      style={{ width: size, height: size * 1.1, backgroundImage: armsUrl(arms) }}
    />
  );
}

/**
 * A small reserved card that shows the full card on hover or focus, so its price
 * and renown can be read. Without `onClick`, a tap toggles the full view (phones).
 * With `onClick` (your own reserved cards), a tap selects the card, and the full
 * view stays open while it is `selected`.
 */
export function CardPeek({ card, fly, size = 'mini', onClick, selected, highlight }: {
  card: Card;
  fly?: string;
  size?: 'mini' | 'small';
  onClick?: () => void;
  selected?: boolean;
  highlight?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [hovered, setHovered] = useState(false);
  const show = () => { if (ref.current) setBox(ref.current.getBoundingClientRect()); setHovered(true); };
  const hide = () => setHovered(false);
  const open = hovered || !!selected;
  useEffect(() => {
    if (selected && ref.current) setBox(ref.current.getBoundingClientRect());
  }, [selected]);
  const W = 150;
  const H = W * 1.4 + 26;
  const left = box ? (box.right + 12 + W < innerWidth ? box.right + 12 : Math.max(8, box.left - W - 12)) : 0;
  const top = box ? Math.max(8, Math.min(box.top + box.height / 2 - H / 2, innerHeight - H - 8)) : 0;
  return (
    <span
      ref={ref}
      className={cx('peek', size)}
      tabIndex={0}
      role="button"
      aria-label={`Reserved: ${place(card.level, card.color)}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={onClick ?? (() => (hovered ? hide() : show()))}
    >
      <CardView card={card} size={size} fly={fly} selected={selected} highlight={highlight} />
      {open && box && createPortal(
        <div className="peek-pop" style={{ left, top, width: W }}>
          <CardView card={card} />
          <div className="peek-name">{place(card.level, card.color)}</div>
        </div>,
        document.body,
      )}
    </span>
  );
}
