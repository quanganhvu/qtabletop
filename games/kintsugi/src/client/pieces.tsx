import type { CSSProperties, ReactNode } from 'react';
import { FLOOR_PENALTIES, wallColor, type Color, type FloorItem, type PlayerState } from '../shared/game';
import type { Arms } from '../shared/heraldry';
import { GLAZES, TOKEN_NAME, colorName } from '../shared/theme';
import { kamonUrl } from './art/kamon';

export const Num = ({ children }: { children: ReactNode }) => <span className="num">{children}</span>;

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function Crest({ arms, size = 28, title }: { arms: Arms; size?: number; title?: string }) {
  return (
    <span
      className="crest"
      role="img"
      aria-label={title ?? 'Family crest'}
      title={title}
      style={{ width: size, height: size, backgroundImage: kamonUrl(arms) }}
    />
  );
}

/** The motif brushed on each glaze, so tiles read without color too. Drawn as strokes on a 24×24 grid. */
const MOTIFS: Record<string, ReactNode> = {
  // Seigaiha: overlapping waves
  wave: <><path d="M3 15a5 5 0 0 1 10 0M11 15a5 5 0 0 1 10 0" /><path d="M5.5 15a2.5 2.5 0 0 1 5 0M13.5 15a2.5 2.5 0 0 1 5 0" /><path d="M7 9.5a5 5 0 0 1 10 0" /><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0" /></>,
  // A folding fan
  fan: <><path d="M12 19L4.5 10.5A10.5 10.5 0 0 1 19.5 10.5Z" /><path d="M12 19L8.4 7.4M12 19V6.5M12 19l3.6-11.6" /></>,
  // Ume: a five-petalled plum blossom
  blossom: <><path d="M12 4.2a2.6 2.6 0 0 1 2.4 3.6 2.6 2.6 0 0 1 3.3 3.9 2.6 2.6 0 0 1-1.1 4.6 2.6 2.6 0 0 1-4.6 1.6 2.6 2.6 0 0 1-4.6-1.6 2.6 2.6 0 0 1-1.1-4.6 2.6 2.6 0 0 1 3.3-3.9A2.6 2.6 0 0 1 12 4.2z" /><circle cx="12" cy="12" r="1.6" /></>,
  // Ensō: a brushed circle, left open
  enso: <path d="M15.6 5.3A7.6 7.6 0 1 0 19.4 13.2" strokeWidth="2.6" />,
  // Bamboo: a stalk and two leaves
  bamboo: <><path d="M9 20.5V3.5" /><path d="M7.5 9h3M7.5 14.5h3" /><path d="M9.5 8.5c3-2.5 6.5-3 10-2-2.4 2.4-6 3.4-10 2zM9.5 13.5c3.2-1 6.6 0 9 2.5-3.2.8-6.6-.2-9-2.5z" /></>,
};

/** A glazed ceramic tile. `ghost`: the faint print on a board showing where a glaze belongs. */
export function Tile({ color, ghost, selected, dim, fresh, onClick, title, fly, style }: {
  color: Color;
  ghost?: boolean;
  selected?: boolean;
  dim?: boolean;
  fresh?: boolean;
  onClick?: () => void;
  title?: string;
  fly?: string;
  style?: CSSProperties;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={cx('tile', color, ghost && 'ghost', selected && 'selected', dim && 'dim', fresh && 'fresh', onClick && 'clickable')}
      onClick={onClick}
      title={title ?? (ghost ? undefined : colorName(color, true))}
      aria-label={title ?? colorName(color, true)}
      data-fly={fly}
      style={style}
    >
      <svg viewBox="0 0 24 24" className="motif" aria-hidden="true">{MOTIFS[GLAZES[color].motif]}</svg>
    </Tag>
  );
}

/** The first-player marker: the master's red seal, stamped with 始 ("begin"). */
export function Seal({ title = `${TOKEN_NAME[0].toUpperCase()}${TOKEN_NAME.slice(1)}: whoever takes it starts the next round (and loses 1 point)`, fly }: { title?: string; fly?: string }) {
  return (
    <span className="seal-token" title={title} data-fly={fly} role="img" aria-label="The master’s seal">
      <span aria-hidden="true">始</span>
    </span>
  );
}

/** A thin gold seam, as if the paper had cracked and been mended with gold. */
export function Seam({ className }: { className?: string }) {
  return (
    <svg className={cx('seam', className)} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 31L14 26 21 30 33 19 41 22 52 12 60 15 71 6 80 9 100 1" />
      <path d="M33 19L36 9M60 15L66 24" />
    </svg>
  );
}

function FloorPiece({ item }: { item: FloorItem }) {
  return item === 'first' ? <Seal /> : <Tile color={item} />;
}

/**
 * A potter's board: work rows (stepped, filling towards the wall) beside the wall,
 * and the floor line of broken tiles beneath. With `onRow`/`onFloor`, the rows
 * that can take `color` light up and can be tapped.
 */
export function PlayerBoard({ player, color, validRows, onRow, onFloor, fresh, flyPrefix, compact }: {
  player: PlayerState;
  color?: Color | null;
  validRows?: number[];
  onRow?: (r: number) => void;
  onFloor?: () => void;
  /** Wall cells set this round, to make them glow. */
  fresh?: Set<string>;
  /** Prefix for fly targets; none when this board is a copy (e.g. a pop-up sheet). */
  flyPrefix?: string;
  compact?: boolean;
}) {
  const choosing = !!color && !!onRow;
  const FloorTag = choosing && onFloor ? 'button' : 'div';
  return (
    <div className={cx('pboard', compact && 'compact', choosing && 'choosing')}>
      <Seam />
      <div className="pb-main">
        <div className="lines">
          {player.lines.map((line, r) => {
            const valid = choosing && validRows!.includes(r);
            const Tag = valid ? 'button' : 'div';
            return (
              <Tag
                key={r}
                type={valid ? 'button' : undefined}
                className={cx('line', valid && 'valid', choosing && !valid && 'blocked')}
                onClick={valid ? () => onRow!(r) : undefined}
                aria-label={valid ? `Row ${r + 1}` : undefined}
                data-fly={flyPrefix && `${flyPrefix}-line-${r}`}
              >
                {Array.from({ length: r + 1 }, (_, i) => {
                  // Tiles fill from the right, next to the wall.
                  const filled = i >= r + 1 - line.count;
                  return filled && line.color ? <Tile key={i} color={line.color} /> : <span key={i} className="slot" />;
                })}
              </Tag>
            );
          })}
        </div>
        <div className="wall">
          {player.wall.map((row, r) => row.map((set, c) => (
            <Tile key={`${r}-${c}`} color={wallColor(r, c)} ghost={!set} fresh={set && fresh?.has(`${r},${c}`)} fly={flyPrefix && `${flyPrefix}-wall-${r}-${c}`} />
          )))}
        </div>
      </div>
      <FloorTag
        type={FloorTag === 'button' ? 'button' : undefined}
        className={cx('floor', FloorTag === 'button' && 'valid')}
        onClick={FloorTag === 'button' ? onFloor : undefined}
        aria-label={choosing ? 'Drop them on the floor' : 'Floor'}
        data-fly={flyPrefix && `${flyPrefix}-floor`}
      >
        {FLOOR_PENALTIES.map((pen, i) => (
          <span key={i} className="floor-slot">
            <span className="pen">−{pen}</span>
            {player.floor[i] ? <FloorPiece item={player.floor[i]} /> : <span className="slot" />}
          </span>
        ))}
      </FloorTag>
    </div>
  );
}

/** A wall in miniature: a 5×5 grid of dots, filled where tiles are set. */
export function MiniWall({ wall }: { wall: boolean[][] }) {
  return (
    <span className="mini-wall" aria-hidden="true">
      {wall.map((row, r) => row.map((set, c) => (
        <span key={`${r}-${c}`} className={cx('mw', wallColor(r, c), set && 'set')} />
      )))}
    </span>
  );
}
