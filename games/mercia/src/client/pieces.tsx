import type { CSSProperties, ReactNode } from 'react';
import type { Arms } from '../shared/heraldry';
import { SEAT_COLORS } from '../shared/theme';
import { armsUrl } from './art/heraldry';
import { tileUrl } from './art/tiles';

export const Num = ({ children }: { children: ReactNode }) => <span className="num">{children}</span>;

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

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
 * A land tile, turned `rot` quarter turns clockwise (its buildings stay upright).
 * Fills its parent unless given a size. `animateTurn` gives a little spin when it turns.
 */
export function TileFace({ tile, rot = 0, size, className, style, animateTurn }: {
  tile: string; rot?: number; size?: number; className?: string; style?: CSSProperties; animateTurn?: boolean;
}) {
  return (
    <span
      key={animateTurn ? rot : undefined}
      className={cx('tile-face', animateTurn && 'turning', className)}
      style={{ backgroundImage: tileUrl(tile, rot), ...(size ? { width: size, height: size } : {}), ...style }}
    />
  );
}

/**
 * A follower: a swallow-tailed banner on a pole in a seat's color, planted on
 * whatever it claims. A farmer's banner leans over in its meadow.
 */
export function Banner({ seat, size = 22, leaning, className, title }: { seat: number; size?: number; leaning?: boolean; className?: string; title?: string }) {
  const c = SEAT_COLORS[seat % SEAT_COLORS.length];
  return (
    <svg
      className={cx('meeple', className)}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={leaning ? { transform: 'rotate(-28deg)' } : undefined}
      role="img"
      aria-label={title ?? `${c.name} banner`}
    >
      {title && <title>{title}</title>}
      <ellipse cx="36" cy="93" rx="17" ry="4.5" fill="#000" opacity=".35" />
      <path d="M38 16H90L77 34L90 52H38Z" fill="#000" opacity=".3" transform="translate(3 4)" />
      <rect x="29" y="10" width="7" height="82" rx="2" fill="#6b4a2a" stroke="#1e1610" strokeWidth="3.5" />
      <path d="M36 14H88L75 32L88 50H36Z" fill={c.fill} stroke={c.edge} strokeWidth="5" strokeLinejoin="round" />
      <path d="M36 21H74" stroke="#fff" strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" />
      <circle cx="56" cy="32" r="6.5" fill="#e8c66e" stroke={c.edge} strokeWidth="3" />
      <circle cx="32.5" cy="8.5" r="7" fill="#e8c66e" stroke="#1e1610" strokeWidth="3.5" />
    </svg>
  );
}
