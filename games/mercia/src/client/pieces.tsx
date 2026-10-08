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

/** The classic follower figure. */
const MEEPLE_PATH = 'M50 4a14 14 0 0 1 14 14c0 5-2 9-5 12l27 8c7 2 10 8 8 13-2 5-7 6-12 5l-13-3 14 32c2 5-1 10-6 10H62L50 77 38 95H23c-5 0-8-5-6-10l14-32-13 3c-5 1-10 0-12-5-2-5 1-11 8-13l27-8c-3-3-5-7-5-12A14 14 0 0 1 50 4z';

/** A follower in a seat's color. Farmers lie down in their meadow. */
export function Meeple({ seat, size = 22, lying, className, title }: { seat: number; size?: number; lying?: boolean; className?: string; title?: string }) {
  const c = SEAT_COLORS[seat % SEAT_COLORS.length];
  return (
    <svg
      className={cx('meeple', className)}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={lying ? { transform: 'rotate(-90deg)' } : undefined}
      role="img"
      aria-label={title ?? `${c.name} follower`}
    >
      {title && <title>{title}</title>}
      <path d={MEEPLE_PATH} fill="#000" opacity=".35" transform="translate(3 5)" />
      <path d={MEEPLE_PATH} fill={c.fill} stroke={c.edge} strokeWidth="5" strokeLinejoin="round" />
      <path d="M40 12a10 10 0 0 1 10-5" stroke="#fff" strokeOpacity=".45" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
