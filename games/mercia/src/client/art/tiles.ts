import { TILES, sideOf, type FeatureDef } from '../../shared/tiles';
import { svgUrl } from './svg';

// Draws each land tile as an engraved, hand-tinted map square on a 100×100
// artboard: olive meadow, pale dusty roads, sandstone cities with terracotta
// roofs behind crenellated walls, and ink-drawn abbeys. Everything is derived
// from the tile's features, so the art always agrees with the rules.

const INK = '#2a1f14';
const MEADOW_LIGHT = '#8d9757';
const MEADOW_DARK = '#6b7540';
const GRASS = '#55602f';
const ROAD = '#e6d8b5';
const ROAD_EDGE = '#5b4a30';
const STONE = '#cdb88c';
const STONE_DARK = '#a8915f';
const WALL = '#8a7650';
const ROOF = '#9c4630';
const ROOF_DARK = '#6e2c1c';

/** City outlines for one canonical arrangement of city edges; rotated into place. */
interface CityShape {
  fill: string;
  /** The inner wall only (not the tile edges). */
  wall: string;
  houses: [number, number][];
  pennant: [number, number];
}

const SHAPES: Record<'one' | 'adjacent' | 'opposite' | 'three' | 'four', CityShape> = {
  // City on the north edge.
  one: {
    fill: 'M0 0H100C76 34 24 34 0 0Z',
    wall: 'M100 0C76 34 24 34 0 0',
    houses: [[30, 7], [44, 13], [58, 10], [71, 6]],
    pennant: [50, 50],
  },
  // City on the west and north edges, joined.
  adjacent: {
    fill: 'M0 0H100C56 36 36 56 0 100Z',
    wall: 'M100 0C56 36 36 56 0 100',
    houses: [[40, 9], [58, 8], [26, 22], [9, 40], [8, 58], [40, 24], [24, 40], [14, 12]],
    pennant: [13, 13],
  },
  // City from the west edge to the east edge.
  opposite: {
    fill: 'M0 0C34 40 66 40 100 0V100C66 60 34 60 0 100Z',
    wall: 'M0 0C34 40 66 40 100 0M100 100C66 60 34 60 0 100',
    houses: [[10, 36], [10, 62], [30, 42], [30, 60], [70, 42], [70, 60], [90, 36], [90, 62], [52, 64]],
    pennant: [24, 50],
  },
  // City on the north, east and west edges; open to the south. Like every city
  // shape, it runs the full length of its city edges, so neighbors meet cleanly.
  three: {
    fill: 'M0 0H100V100C70 56 30 56 0 100Z',
    wall: 'M100 100C70 56 30 56 0 100',
    houses: [[14, 10], [32, 8], [68, 8], [86, 10], [10, 30], [90, 30], [10, 52], [90, 52], [10, 74], [90, 74], [32, 46], [68, 46], [50, 54], [76, 24], [30, 26]],
    pennant: [22, 20],
  },
  four: {
    fill: 'M0 0H100V100H0Z',
    wall: '',
    houses: [[12, 12], [32, 10], [68, 10], [88, 12], [10, 32], [90, 32], [10, 68], [90, 68], [12, 88], [32, 90], [68, 90], [88, 88], [30, 30], [70, 30], [30, 70], [70, 70], [50, 72]],
    pennant: [30, 50],
  },
};

/** Which canonical shape a city's edges form, and how far to turn it. */
function cityShape(sides: number[]): { shape: CityShape; rot: number } {
  const set = new Set(sides);
  switch (set.size) {
    case 1: return { shape: SHAPES.one, rot: sides[0] };
    case 2: {
      const [a, b] = [...set].sort();
      if (b - a === 2) return { shape: SHAPES.opposite, rot: a === 1 ? 0 : 1 };
      // Adjacent pair {s, s+1}: the canonical shape covers {west, north} = {3, 0}.
      const first = b - a === 1 ? a : b; // the side that comes first clockwise
      return { shape: SHAPES.adjacent, rot: (first + 1) % 4 };
    }
    case 3: {
      const missing = [0, 1, 2, 3].find((s) => !set.has(s))!;
      return { shape: SHAPES.three, rot: (missing + 2) % 4 };
    }
    default: return { shape: SHAPES.four, rot: 0 };
  }
}

const EDGE_POINT: [number, number][] = [[50, 0], [100, 50], [50, 100], [0, 50]];

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

function meadow(id: string): string {
  const rng = seeded(id.charCodeAt(0) * 7919);
  const tufts = Array.from({ length: 30 }, () => {
    const x = 4 + rng() * 92, y = 4 + rng() * 92, s = 1.6 + rng() * 1.4;
    return `M${(x - s).toFixed(1)} ${(y - s).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}L${(x + s * 0.8).toFixed(1)} ${(y - s * 1.2).toFixed(1)}`;
  }).join('');
  return `<rect width="100" height="100" fill="url(#mead)"/>
    <path d="${tufts}" fill="none" stroke="${GRASS}" stroke-width=".7" stroke-linecap="round" opacity=".55"/>`;
}

function roadPath(f: FeatureDef, endY: number): string {
  const sides = f.ports.map(sideOf);
  const [ax, ay] = EDGE_POINT[sides[0]];
  if (sides.length === 1) {
    const end = sides[0] === 2 ? endY : 50;
    // Single road arms run to the middle of the tile (or to an abbey's door).
    const [ex, ey] = sides[0] === 2 ? [50, end] : [50, 50];
    return `M${ax} ${ay}L${ex} ${ey}`;
  }
  const [bx, by] = EDGE_POINT[sides[1]];
  return (sides[0] + 2) % 4 === sides[1] ? `M${ax} ${ay}L${bx} ${by}` : `M${ax} ${ay}Q50 50 ${bx} ${by}`;
}

function house(x: number, y: number, shade: number, upright: number): string {
  const roof = shade > 0.5 ? ROOF : ROOF_DARK;
  return `<g transform="translate(${x} ${y}) rotate(${upright})"><rect x="-4" y="-1" width="8" height="5" fill="#eadcbc" stroke="${INK}" stroke-width=".5"/>
    <path d="M-5 -0.5L0 -5L5 -0.5Z" fill="${roof}" stroke="${INK}" stroke-width=".5" stroke-linejoin="round"/></g>`;
}

/** A city, drawn on a tile that will be turned `tileRot` quarter turns. */
function city(f: FeatureDef, rng: () => number, tileRot: number): string {
  const { shape, rot } = cityShape(f.ports.map(sideOf));
  const upright = -(rot + tileRot) * 90;
  const houses = shape.houses.map(([x, y]) => house(x, y, rng(), upright)).join('');
  const pennant = f.pennant ? `<g transform="translate(${shape.pennant[0]} ${shape.pennant[1]}) rotate(${upright})">
      <path d="M-7-8H7V0C7 6 3 9 0 11C-3 9-7 6-7 0Z" fill="#24427c" stroke="#c9a03a" stroke-width="1.6"/>
      <path d="M0-5V7M-4 0H4" stroke="#e8c66e" stroke-width="1.6"/></g>` : '';
  const wall = shape.wall
    ? `<path d="${shape.wall}" fill="none" stroke="${WALL}" stroke-width="5"/>
       <path d="${shape.wall}" fill="none" stroke="${INK}" stroke-width="7" stroke-dasharray="2.2 2.2" opacity=".55"/>
       <path d="${shape.wall}" fill="none" stroke="${STONE_DARK}" stroke-width="2.6"/>`
    : '';
  return `<g transform="rotate(${rot * 90} 50 50)">
    <path d="${shape.fill}" fill="url(#stone)"/>
    <path d="${shape.fill}" fill="url(#cobbles)" opacity=".5"/>
    ${houses}${pennant}${wall}
  </g>`;
}

const ABBEY = `<g transform="translate(50 48)">
  <ellipse cx="0" cy="6" rx="22" ry="17" fill="#9aa463" opacity=".8"/>
  <ellipse cx="0" cy="6" rx="22" ry="17" fill="none" stroke="${INK}" stroke-width=".6" stroke-dasharray="1.5 1.5" opacity=".6"/>
  <rect x="-12" y="-4" width="24" height="16" fill="#eadcbc" stroke="${INK}" stroke-width=".9"/>
  <path d="M-14 -3L0 -13L14 -3Z" fill="${ROOF}" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>
  <rect x="6" y="-20" width="7" height="14" fill="#eadcbc" stroke="${INK}" stroke-width=".9"/>
  <path d="M5 -20L9.5 -27L14 -20Z" fill="${ROOF_DARK}" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M9.5 -27V-32M7.5 -30H11.5" stroke="${INK}" stroke-width=".9"/>
  <path d="M-3 12V6A3 3 0 0 1 3 6V12Z" fill="${INK}"/>
  <path d="M-9 1h3v4h-3zM6 1h3v4h-3z" fill="${INK}" opacity=".7"/>
</g>`;

const HAMLET = `<g transform="translate(50 50)">
  <circle r="9" fill="${ROAD}" stroke="${ROAD_EDGE}" stroke-width="1"/>
  <rect x="-5" y="-3" width="10" height="7" fill="#eadcbc" stroke="${INK}" stroke-width=".7"/>
  <path d="M-6.5 -2.5L0 -8L6.5 -2.5Z" fill="${ROOF}" stroke="${INK}" stroke-width=".7" stroke-linejoin="round"/>
  <path d="M-1.2 4V1h2.4v3z" fill="${INK}"/>
</g>`;

const DEFS = `<defs>
  <linearGradient id="mead" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${MEADOW_LIGHT}"/><stop offset="1" stop-color="${MEADOW_DARK}"/></linearGradient>
  <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${STONE}"/><stop offset="1" stop-color="#bba274"/></linearGradient>
  <pattern id="cobbles" width="6" height="5" patternUnits="userSpaceOnUse"><path d="M0 5H6M3 0V2.5M0 2.5H6" stroke="${STONE_DARK}" stroke-width=".5" fill="none"/></pattern>
</defs>`;

/**
 * A tile turned `rot` quarter turns clockwise. The land turns with the tile,
 * but houses, pennants and abbeys are drawn standing upright.
 */
export function tileSvg(id: string, rot = 0): string {
  const t = TILES[id];
  const rng = seeded(id.charCodeAt(0) * 104729);
  const hasAbbey = t.features.some((f) => f.kind === 'cloister');
  const roads = t.features.filter((f) => f.kind === 'road');
  const deadEnds = roads.filter((f) => f.ports.length === 1).length;
  const roadD = roads.map((f) => roadPath(f, hasAbbey ? 62 : 50)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${DEFS}
    ${meadow(id)}
    <g transform="rotate(${rot * 90} 50 50)">
    ${roadD ? `<path d="${roadD}" fill="none" stroke="${ROAD_EDGE}" stroke-width="11" stroke-linecap="butt" opacity=".85"/>
      <path d="${roadD}" fill="none" stroke="${ROAD}" stroke-width="8.4"/>
      <path d="${roadD}" fill="none" stroke="#b9a77c" stroke-width=".8" stroke-dasharray="1 3"/>` : ''}
    ${t.features.filter((f) => f.kind === 'city').map((f) => city(f, rng, rot)).join('')}
    </g>
    ${hasAbbey ? ABBEY : ''}
    ${deadEnds >= 2 ? HAMLET : ''}
    <rect x=".5" y=".5" width="99" height="99" fill="none" stroke="${INK}" stroke-opacity=".45"/>
  </svg>`;
}

const cache = new Map<string, string>();

/** CSS `url(...)` of a tile's art, turned `rot` quarter turns clockwise. */
export function tileUrl(id: string, rot = 0): string {
  const key = `${id}${rot % 4}`;
  let url = cache.get(key);
  if (!url) {
    url = svgUrl(tileSvg(id, rot % 4));
    cache.set(key, url);
  }
  return url;
}
