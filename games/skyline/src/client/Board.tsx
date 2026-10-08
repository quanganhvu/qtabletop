import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { COLS, ROWS, ROW_LETTERS, chainSizes, tileLabel, tileStatus, type Cell, type Chain } from '../shared/game';
import { CHAIN_INFO, chainName } from '../shared/theme';
import { chainStyle, cx } from './ui';

const LOOSE_HEIGHT = 5;
/** Grid gap in px; levels of the same chain reach into it so they join into one building. */
const GAP = 4;

/** A chain's height grows with its size: a 2-tile chain is a low block, a 41-tile chain a skyscraper. */
const baseHeight = (size: number) => 16 + 44 * Math.sqrt(Math.min(Math.max(size - 2, 0), 39) / 39);

/** Stable per-tile jitter in [-1, 1], so the skyline is uneven but doesn't flicker between renders. */
const jitter = (t: number) => (((t * 2654435761) >>> 0) % 1000) / 500 - 1;

/** Per side, [north, east, south, west]. */
type Sides<T> = [T, T, T, T];
const all = <T,>(x: T): Sides<T> => [x, x, x, x];

/** One stacked box of a building. `set` is how far it steps in (% of the square) on sides with no neighbor to join. */
interface Level { h: number; set: Sides<number>; solo?: boolean }

interface Building {
  levels: Level[];
  /** Per level, which sides join a neighbor's level of the same chain. */
  joins: Sides<boolean>[];
  /** The tallest tower of its chain, which carries the crown. */
  core: boolean;
  /** Bayside's pitched roof. */
  gable: boolean;
}

interface Site {
  size: number;
  base: number;
  /** Distance from the chain's middle, in squares, and the furthest any of its tiles is. */
  d: number;
  maxD: number;
  core: boolean;
  j: number;
}

/** Each chain's architecture as a stack of levels: low motels, row houses, wedding cakes, pueblos... */
const PROFILES: Record<Chain, (s: Site) => { levels: Level[]; gable?: boolean }> = {
  // Neon motel: one low, sprawling storey.
  astra: ({ base, j }) => ({ levels: [{ h: 8 + 0.18 * base + 1.5 * j, set: all(2) }] }),
  // Red-brick inn: row houses with pitched roofs; the main house is flat, for the water tower.
  bayside: ({ base, d, core, j }) => ({
    levels: [{ h: 6 + 0.45 * base * Math.max(0.6, 1 - 0.1 * d) + 2 * j + (core ? 6 : 0), set: all(2) }],
    gable: !core,
  }),
  // Miami deco: a wedding cake, stepping in as it rises.
  coral: ({ base, d, core, j }) => {
    const h = base * (core ? 1.2 : Math.max(0.5, 1 - 0.13 * d) + 0.06 * j);
    const split = h > 38 ? [0.5, 0.3, 0.2] : h > 22 ? [0.62, 0.38] : [1];
    return { levels: split.map((f, k) => ({ h: h * f, set: all([2, 12, 22][k]) })) };
  },
  // Adobe pueblo: terraces stepping back towards the north-west, highest in the middle.
  dorado: ({ size, d, maxD, core, j }) => {
    const most = size < 5 ? 1 : size < 12 ? 2 : size < 25 ? 3 : 4;
    const n = core ? most : Math.max(1, Math.round(most * (1 - d / (maxD + 1))));
    return {
      levels: Array.from({ length: n }, (_, k) => ({
        h: 13 + 1.5 * j,
        set: (k ? [2, 30 + 14 * (k - 1), 30 + 14 * (k - 1), 2] : all(2)) as Sides<number>,
      })),
    };
  },
  // Beaux-arts stone: a wide podium, wings by the tower, and one stepped tower in the middle.
  empire: ({ size, base, d, core }) => {
    const podium = { h: 10 + 0.12 * base, set: all(2) };
    if (core) {
      return {
        levels: [podium, { h: base * 1.3, set: all(18) }, { h: base * 0.25, set: all(28) }, { h: base * 0.14, set: all(36) }],
      };
    }
    return { levels: size >= 8 && d <= 1.5 ? [podium, { h: base * 0.45, set: all(14) }] : [podium] };
  },
  // Glass towers: separate slabs rising from a shared plaza.
  fontaine: ({ base, core, j }) => ({
    levels: [{ h: 6, set: all(2) }, { h: base * (core ? 1.35 : 1.05) + 6 * j, set: all(12), solo: true }],
  }),
  // Diagrid spire: one needle that dwarfs a low, sloping base.
  grand: ({ base, d, core }) => {
    if (!core) return { levels: [{ h: base * Math.max(0.3, 0.8 - 0.2 * d), set: all(2) }] };
    const h = base * 2;
    return { levels: [0.4, 0.27, 0.18, 0.15].map((f, k) => ({ h: h * f, set: all([2, 14, 25, 34][k]) })) };
  },
};

/** Shapes every chain into a building in its own architecture. */
function buildings(board: readonly Cell[]): Map<number, Building> {
  const sizes = chainSizes(board);
  const byChain = new Map<Chain, number[]>();
  board.forEach((cell, t) => {
    if (cell && cell !== 'loose') byChain.set(cell, [...(byChain.get(cell) ?? []), t]);
  });
  const out = new Map<number, Building>();
  for (const [chain, tiles] of byChain) {
    const pos = (t: number) => [t % COLS, Math.floor(t / COLS)];
    const midX = tiles.reduce((s, t) => s + pos(t)[0], 0) / tiles.length;
    const midY = tiles.reduce((s, t) => s + pos(t)[1], 0) / tiles.length;
    const dist = (t: number) => Math.hypot(pos(t)[0] - midX, pos(t)[1] - midY);
    const core = tiles.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    const maxD = Math.max(...tiles.map(dist));
    const base = baseHeight(sizes[chain]);
    for (const t of tiles) {
      const shape = PROFILES[chain]({ size: sizes[chain], base, d: dist(t), maxD, core: t === core, j: jitter(t) });
      out.set(t, { levels: shape.levels, joins: [], core: t === core, gable: !!shape.gable });
    }
  }
  // A level joins a neighbor of the same chain that has a level at the same height.
  for (const [t, b] of out) {
    const r = Math.floor(t / COLS);
    const c = t % COLS;
    const around = [r > 0 ? t - COLS : null, c < COLS - 1 ? t + 1 : null, r < ROWS - 1 ? t + COLS : null, c > 0 ? t - 1 : null];
    b.joins = b.levels.map((level, k) =>
      around.map((n) => {
        const other = n === null || board[n] !== board[t] ? undefined : out.get(n)?.levels[k];
        return !!other && !level.solo && !other.solo;
      }) as Sides<boolean>,
    );
  }
  return out;
}

/** A box: four walls and a roof, with anything extra (crown, gable, label) on the roof. */
function Faces({ roof, children }: { roof?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <span className="face back" />
      <span className="face left" />
      <span className="face right" />
      <span className="face front" />
      <span className="face top">{roof}</span>
      {children}
    </>
  );
}

/** An open merger: the tile that set it off, the chain(s) that may survive, and the chains going under. */
export interface Merging { tile: number; acquirers: Chain[]; doomed: Chain[] }

const NO_TAKEOVER = { cells: new Set<number>(), origin: null as number | null };

export interface View { yaw: number; tilt: number }
export const DEFAULT_VIEW: View = { yaw: 0, tilt: 38 };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * The board as a 3D table you can orbit by dragging. Each occupied square is a box made of a roof
 * and four walls; the walls ignore the pointer, so tall towers never block clicks behind them.
 */
export function Board({ board, myTiles, placing, lastTile, hoverTile, merging, flat, onPlace, onHover }: {
  board: Cell[];
  myTiles: Set<number>;
  placing: boolean;
  lastTile: number | null;
  hoverTile: number | null;
  merging: Merging | null;
  flat: boolean;
  onPlace: (t: number) => void;
  onHover: (t: number | null) => void;
}) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; start: View; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const shapes = buildings(board);

  // When a chain is taken over, its squares are rebuilt in the survivor's style, in a wave from the merger tile.
  const prevBoard = useRef(board);
  const [takeover, setTakeover] = useState(NO_TAKEOVER);
  useEffect(() => {
    const prev = prevBoard.current;
    prevBoard.current = board;
    const cells = new Set<number>();
    board.forEach((cell, t) => {
      const was = prev[t];
      if (cell && cell !== 'loose' && was && was !== 'loose' && was !== cell) cells.add(t);
    });
    if (cells.size) setTakeover({ cells, origin: lastTile });
  }, [board, lastTile]);
  useEffect(() => {
    if (!takeover.cells.size) return;
    const id = setTimeout(() => setTakeover(NO_TAKEOVER), 3000);
    return () => clearTimeout(id);
  }, [takeover]);
  const waveDelay = (t: number) => {
    const o = takeover.origin;
    if (o === null) return 0;
    return Math.round(90 * Math.hypot((t % COLS) - (o % COLS), Math.floor(t / COLS) - Math.floor(o / COLS)));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (flat || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { x: e.clientX, y: e.clientY, start: view, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setView({ yaw: d.start.yaw + dx * 0.35, tilt: clamp(d.start.tilt - dy * 0.3, 0, 68) });
  };
  const endDrag = () => {
    if (drag.current?.moved) {
      // The release after a drag shouldn't also play a tile.
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
    }
    drag.current = null;
    setDragging(false);
  };
  const turn = (deg: number) => setView({ ...view, yaw: Math.round((view.yaw + deg) / 90) * 90 });

  const stageStyle = { '--yaw': `${flat ? 0 : view.yaw}deg`, '--tilt': `${flat ? 0 : view.tilt}deg` } as CSSProperties;

  return (
    <>
      <div
        className={cx('board-stage', flat && 'flat', dragging && 'dragging')}
        style={stageStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <div className="board" role="grid" aria-label="Board">
          <span className="edge n" /><span className="edge s" /><span className="edge e" /><span className="edge w" />
          {/* Coordinates on every side, so the near edge always has them whichever way the board is turned. */}
          {(['n', 's'] as const).map((side) => (
            <span key={side} className={`ruler cols ${side}`} aria-hidden="true">
              {Array.from({ length: COLS }, (_, c) => <span key={c}><span className="upright">{c + 1}</span></span>)}
            </span>
          ))}
          {(['w', 'e'] as const).map((side) => (
            <span key={side} className={`ruler rows ${side}`} aria-hidden="true">
              {ROW_LETTERS.slice(0, ROWS).split('').map((r) => <span key={r}><span className="upright">{r}</span></span>)}
            </span>
          ))}
          {board.map((cell, t) => {
            const mine = myTiles.has(t);
            const status = mine ? tileStatus(board, t) : null;
            const playable = placing && status === 'ok';
            const label = tileLabel(t);
            const chain = cell && cell !== 'loose' ? cell : null;
            const shape = shapes.get(t);
            const converted = takeover.cells.has(t);
            const style = { ...(chain ? chainStyle(chain) : {}), ...(converted ? { '--delay': `${waveDelay(t)}ms` } : {}) } as CSSProperties;
            return (
              <button
                key={t}
                className={cx(
                  'cell', cell === 'loose' && 'loose', chain && `chained look-${chain}`, shape?.core && 'core',
                  mine && 'in-hand', playable && 'playable', status === 'dead' && 'dead',
                  lastTile === t && 'last', hoverTile === t && 'hover', converted && 'converted',
                  chain && merging?.doomed.includes(chain) && 'doomed', chain && merging?.acquirers.includes(chain) && 'acquirer',
                  merging?.tile === t && 'merge-tile',
                )}
                style={style}
                disabled={!playable}
                onClick={() => onPlace(t)}
                onMouseEnter={() => mine && onHover(t)}
                onMouseLeave={() => onHover(null)}
                aria-label={`${label}${cell ? `, ${chain ? chainName(chain) : 'hotel'}` : mine ? ', your tile' : ''}`}
              >
                <span className="slot" aria-hidden="true"><span className="upright">{label}</span></span>
                {cell && (
                  <span key={cell} className="building" aria-hidden="true">
                    {(shape?.levels ?? [{ h: LOOSE_HEIGHT, set: all(2) }]).map((level, k, levels) => {
                      const summit = k === levels.length - 1;
                      const joins = shape?.joins[k] ?? all(false);
                      const z = levels.slice(0, k).reduce((sum, l) => sum + l.h, 0);
                      const inset = level.set.map((set, i) => (joins[i] ? `${-GAP / 2}px` : `${set}%`)).join(' ');
                      const roofLabel = <span className="upright">{shape?.core || shape?.gable ? '' : label}</span>;
                      return (
                        <span
                          key={k}
                          className={cx('block', summit && 'summit')}
                          style={{ inset, '--h': `${Math.round(level.h)}px`, '--z': `${Math.round(z)}px` } as CSSProperties}
                        >
                          <Faces roof={summit ? roofLabel : null}>
                            {summit && shape?.gable && (
                              <span className="gable">
                                <span className="pitch n" />
                                <span className="pitch s"><span className="upright">{label}</span></span>
                                {!joins[3] && <span className="gable-end w" />}
                                {!joins[1] && <span className="gable-end e" />}
                              </span>
                            )}
                            {summit && shape?.core && (
                              <span className="crown">
                                <Faces roof={<span className="upright">{CHAIN_INFO[chain!].name[0]}</span>}>
                                  <span className="antenna" />
                                  <span className="antenna turned" />
                                </Faces>
                              </span>
                            )}
                          </Faces>
                        </span>
                      );
                    })}
                  </span>
                )}
                {merging?.tile === t && <span className="beam" aria-hidden="true"><span /><span /></span>}
                {mine && !cell && <span className="tile-ghost" aria-hidden="true"><span className="upright">{label}</span></span>}
              </button>
            );
          })}
        </div>
      </div>
      {!flat && (
        <div className="view-controls">
          <button className="btn tiny ghost" onClick={() => turn(-90)} title="Turn the board left" aria-label="Turn the board left">⟲</button>
          <span className="muted small">Drag to rotate</span>
          <button className="btn tiny ghost" onClick={() => turn(90)} title="Turn the board right" aria-label="Turn the board right">⟳</button>
          <button className="btn tiny ghost" onClick={() => setView(DEFAULT_VIEW)} disabled={view.yaw === 0 && view.tilt === DEFAULT_VIEW.tilt}>Reset view</button>
        </div>
      )}
    </>
  );
}

