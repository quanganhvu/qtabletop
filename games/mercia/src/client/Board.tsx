import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { parseKey, type GameView } from '../shared/game';
import { FEATURE_NAMES } from '../shared/theme';
import { TILES, rotatePoint } from '../shared/tiles';
import { Banner, TileFace, cx } from './pieces';

/** Size of one tile in board units (CSS pixels at zoom 1). */
export const TILE = 96;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.8;

export interface Preview {
  x: number;
  y: number;
  rot: number;
  tile: string;
  /** Follower spots the player may choose on this tile. */
  options: number[];
  meeple: number | null;
  seat: number;
}

/** Feature tiles to light up while a score is announced. */
export interface Flash {
  id: string;
  tiles: [number, number][];
  points: number;
}

interface Camera { x: number; y: number; z: number }

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function Board({ game, spots, rot, preview, onSpot, onMeeple, flash, fitSignal }: {
  game: GameView;
  /** Squares where the tile in hand may go (your turn only). */
  spots: { x: number; y: number; rots: number[] }[] | null;
  /** The rotation shown in your hand: squares where it fits as-is glow brighter. */
  rot: number;
  preview: Preview | null;
  onSpot: (x: number, y: number) => void;
  onMeeple: (feature: number | null) => void;
  flash: Flash | null;
  /** Bump to re-frame the whole land. */
  fitSignal: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, z: 1 });
  const camRef = useRef(cam);
  camRef.current = cam;

  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const keys = Object.keys(game.board).map(parseKey);
    const pts = [...keys, ...(spots ?? []).map((s) => [s.x, s.y] as [number, number])];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + 1, minY = Math.min(...ys), maxY = Math.max(...ys) + 1;
    const w = el.clientWidth, h = el.clientHeight;
    const z = clampZoom(Math.min(1.15, (w - 40) / ((maxX - minX) * TILE), (h - 40) / ((maxY - minY) * TILE)));
    setCam({ z, x: w / 2 - ((minX + maxX) / 2) * TILE * z, y: h / 2 - ((minY + maxY) / 2) * TILE * z });
  }, [game.board, spots]);

  // Frame the land when the board opens and whenever asked.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useLayoutEffect(() => fitRef.current(), [fitSignal]);

  // ---- Panning and zooming: drag, wheel, pinch ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startX: number; startY: number; pinch?: { dist: number; z: number } } | null>(null);
  const suppressClick = useRef(false);

  const zoomAt = (px: number, py: number, z: number) => {
    const c = camRef.current;
    const nz = clampZoom(z);
    setCam({ z: nz, x: px - ((px - c.x) * nz) / c.z, y: py - ((py - c.y) * nz) / c.z });
  };

  const local = (e: { clientX: number; clientY: number }) => {
    const r = viewport.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { moved: false, startX: e.clientX, startY: e.clientY };
      suppressClick.current = false;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { moved: true, startX: 0, startY: 0, pinch: { dist: Math.hypot(a.x - b.x, a.y - b.y), z: camRef.current.z } };
      suppressClick.current = true;
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    const g = gesture.current;
    if (!prev || !g) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      zoomAt(mid.x, mid.y, g.pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) / g.pinch.dist));
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 6) {
      g.moved = true;
      suppressClick.current = true;
      viewport.current?.setPointerCapture(e.pointerId);
    }
    if (g.moved) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    else if (pointers.current.size === 1 && gesture.current) {
      const [p] = [...pointers.current.values()];
      gesture.current = { moved: true, startX: p.x, startY: p.y };
    }
  };

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // Wheel zoom needs a non-passive listener so the page itself doesn't scroll.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      zoomAt(p.x, p.y, camRef.current.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // A click that ended a drag is not a click.
  const guard = (fn: () => void) => () => {
    if (suppressClick.current) return;
    fn();
  };

  const zoomBy = (factor: number) => {
    const el = viewport.current!;
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, camRef.current.z * factor);
  };

  const pos = (x: number, y: number): CSSProperties => ({ left: x * TILE, top: y * TILE });
  const flashed = new Set(flash?.tiles.map(([x, y]) => `${x},${y}`));
  const last = game.last ? `${game.last[0]},${game.last[1]}` : null;

  return (
    <div
      className="board-viewport"
      ref={viewport}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="board-world" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`, '--tile': `${TILE}px` } as CSSProperties}>
        {Object.entries(game.board).map(([k, placed]) => {
          const [x, y] = parseKey(k);
          return (
            <div key={k} className={cx('btile', k === last && 'last', flashed.has(k) && 'flash')} style={pos(x, y)}>
              <TileFace tile={placed.t} rot={placed.r} />
            </div>
          );
        })}

        {spots?.map((s) => (
          <button
            key={`spot${s.x},${s.y}`}
            className={cx('spot', s.rots.includes(rot) && 'fits', preview?.x === s.x && preview?.y === s.y && 'chosen')}
            style={pos(s.x, s.y)}
            onClick={guard(() => onSpot(s.x, s.y))}
            aria-label={`Lay the tile here (${s.x}, ${s.y})`}
          />
        ))}

        {preview && (
          <div className="btile preview" style={pos(preview.x, preview.y)} onClick={guard(() => onSpot(preview.x, preview.y))}>
            <TileFace tile={preview.tile} rot={preview.rot} animateTurn />
            {preview.options.map((f) => {
              const def = TILES[preview.tile].features[f];
              const [ax, ay] = rotatePoint(def.at, preview.rot);
              const chosen = preview.meeple === f;
              return (
                <button
                  key={f}
                  className={cx('meeple-spot', def.kind, chosen && 'chosen')}
                  style={{ left: `${ax}%`, top: `${ay}%` }}
                  title={`Send a ${FEATURE_NAMES[def.kind].follower} to this ${FEATURE_NAMES[def.kind].name}`}
                  aria-label={`${FEATURE_NAMES[def.kind].follower} on the ${FEATURE_NAMES[def.kind].name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!suppressClick.current) onMeeple(chosen ? null : f);
                  }}
                >
                  {chosen && <Banner seat={preview.seat} size={TILE * 0.3} leaning={def.kind === 'field'} />}
                </button>
              );
            })}
          </div>
        )}

        {Object.entries(game.board).map(([k, placed]) => {
          if (!placed.m) return null;
          const [x, y] = parseKey(k);
          const def = TILES[placed.t].features[placed.m.f];
          const [ax, ay] = rotatePoint(def.at, placed.r);
          const owner = game.players[placed.m.p]?.name ?? '';
          return (
            <div key={`m${k}`} className="placed-meeple" style={{ left: x * TILE + (ax / 100) * TILE, top: y * TILE + (ay / 100) * TILE }}>
              <Banner seat={placed.m.p} size={TILE * 0.3} leaning={def.kind === 'field'} title={`${owner}'s ${FEATURE_NAMES[def.kind].follower}`} />
            </div>
          );
        })}

        {flash && flash.tiles.length > 0 && (() => {
          const xs = flash.tiles.map((t) => t[0]), ys = flash.tiles.map((t) => t[1]);
          const cxp = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * TILE, cyp = ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * TILE;
          return <div key={flash.id} className="score-float" style={{ left: cxp, top: cyp }}>+{flash.points}</div>;
        })()}
      </div>

      <div className="board-tools">
        <button className="btn ghost small" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">+</button>
        <button className="btn ghost small" onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out">−</button>
        <button className="btn ghost small" onClick={fit} aria-label="Show the whole land" title="Show the whole land">⤢</button>
      </div>
    </div>
  );
}
