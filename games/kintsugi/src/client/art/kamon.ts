import type { Arms, Charge, Division, Tincture } from '../../shared/heraldry';
import { svgUrl } from './svg';

// Draws a player's arms as a kamon, a Japanese family crest, on a 100×100
// artboard. The same choices the other games draw as a heraldic shield (shape,
// colors, emblem) become a frame, its colors and a motif, so a player's pick
// carries over and the server needs nothing new.

/** Traditional pigments for each color choice. */
export const KAMON_COLORS: Record<Tincture, string> = {
  or: '#c79a2e', // gold leaf
  argent: '#f3ecdc', // gofun, shell white
  gules: '#c23b22', // shu, vermilion
  azure: '#23396b', // ai, indigo
  vert: '#3e6b48', // matsuba, pine green
  sable: '#26231f', // sumi, ink black
  purpure: '#5b3a74', // murasaki, purple
};

export const KAMON_COLOR_NAMES: Record<Tincture, string> = {
  or: 'Gold', argent: 'Shell white', gules: 'Vermilion', azure: 'Indigo', vert: 'Pine green', sable: 'Ink black', purpure: 'Murasaki purple',
};

export const FRAME_NAMES: Record<Division, string> = {
  plain: 'Circle', perPale: 'Ring', perFess: 'Double ring', perBend: 'Tortoiseshell (kikkō)', quarterly: 'Diamond (hishi)',
  chevron: 'Quatrefoil (mokkō)', chief: 'Scalloped', bend: 'Octagon', pale: 'Cut square', saltire: 'Beaded ring',
};

export const MOTIF_NAMES: Record<Charge, string> = {
  none: 'Mitsudomoe', fleur: 'Cherry blossom', mullet: 'Bellflower (kikyō)', crescent: 'Crescent moon', tower: 'Mountains',
  cross: 'Well frame (igeta)', crown: 'Folding fan', key: 'Hawk feathers', bezants: 'Three stars',
};

const f = (n: number) => n.toFixed(2);
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg - 90) * (Math.PI / 180);
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
};
const rotations = (count: number, body: string) =>
  Array.from({ length: count }, (_, i) => `<g transform="rotate(${(360 / count) * i} 50 50)">${body}</g>`).join('');

/** The frame: filled with the main color, edged with the second. Returns its shape and how much room the motif has. */
function frame(division: Division, fill: string, edge: string): { svg: string; scale: number } {
  const ring = (r: number, w: number) => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${edge}" stroke-width="${w}"/>`;
  const polygon = (sides: number, r: number, turn: number) =>
    Array.from({ length: sides }, (_, i) => polar(r, turn + (360 / sides) * i).map(f).join(',')).join(' ');
  switch (division) {
    case 'plain':
      return { svg: `<circle cx="50" cy="50" r="47" fill="${fill}"/>`, scale: 0.82 };
    case 'perPale':
      return { svg: `<circle cx="50" cy="50" r="47" fill="${fill}"/>${ring(42.5, 6)}`, scale: 0.72 };
    case 'perFess':
      return { svg: `<circle cx="50" cy="50" r="47" fill="${fill}"/>${ring(44, 3.5)}${ring(37.5, 2.5)}`, scale: 0.66 };
    case 'perBend':
      return { svg: `<polygon points="${polygon(6, 47, 90)}" fill="${fill}" stroke="${edge}" stroke-width="5" stroke-linejoin="round"/>`, scale: 0.72 };
    case 'quarterly':
      return { svg: `<polygon points="${polygon(4, 48, 0)}" fill="${fill}" stroke="${edge}" stroke-width="5" stroke-linejoin="round"/>`, scale: 0.6 };
    case 'chevron': {
      // Four lobes: stroked circles first, then the same circles filled over them, so only the outer edge shows.
      const lobes = [[50, 29], [71, 50], [50, 71], [29, 50]];
      const circles = (attrs: string) => lobes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="21" ${attrs}/>`).join('') + `<circle cx="50" cy="50" r="24" ${attrs}/>`;
      return { svg: circles(`fill="${edge}" stroke="${edge}" stroke-width="8"`) + circles(`fill="${fill}"`), scale: 0.66 };
    }
    case 'chief': {
      const lobes = Array.from({ length: 12 }, (_, i) => polar(37, 30 * i));
      const circles = (attrs: string) => lobes.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="9.5" ${attrs}/>`).join('') + `<circle cx="50" cy="50" r="38" ${attrs}/>`;
      return { svg: circles(`fill="${edge}" stroke="${edge}" stroke-width="6"`) + circles(`fill="${fill}"`), scale: 0.7 };
    }
    case 'bend':
      return { svg: `<polygon points="${polygon(8, 47, 22.5)}" fill="${fill}" stroke="${edge}" stroke-width="5" stroke-linejoin="round"/>`, scale: 0.74 };
    case 'pale':
      return { svg: `<path d="M20 5H80L95 20V80L80 95H20L5 80V20Z" fill="${fill}" stroke="${edge}" stroke-width="5" stroke-linejoin="round"/>`, scale: 0.74 };
    case 'saltire': {
      const beads = Array.from({ length: 16 }, (_, i) => polar(41.5, 22.5 * i)).map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="3.6" fill="${edge}"/>`).join('');
      return { svg: `<circle cx="50" cy="50" r="47" fill="${fill}"/>${beads}`, scale: 0.68 };
    }
  }
}

/** The motif, drawn in `ink`, with details cut out in `ground` (the frame's color). */
function motif(charge: Charge, ink: string, ground: string): string {
  switch (charge) {
    case 'none': {
      // Mitsudomoe: three commas chasing each other round. Each is a round head with a
      // tail that sweeps clockwise along the outer edge and tapers to a point.
      const comma = (() => {
        const [hx, hy] = polar(19, 0);
        const [sx, sy] = polar(30, -6);
        const [tx, ty] = polar(33, 122);
        const [ex, ey] = polar(19, 34);
        return `<circle cx="${f(hx)}" cy="${f(hy)}" r="11" fill="${ink}"/>`
          + `<path d="M${f(sx)} ${f(sy)}A32 32 0 0 1 ${f(tx)} ${f(ty)}A30 30 0 0 0 ${f(ex)} ${f(ey)}Z" fill="${ink}"/>`;
      })();
      return rotations(3, comma);
    }
    case 'fleur': {
      // Sakura: five notched petals around a small heart.
      const petal = `<path d="M50 50C38 42 35 26 43 17L50 23L57 17C65 26 62 42 50 50Z" fill="${ink}"/>`;
      return rotations(5, petal) + `<circle cx="50" cy="50" r="5" fill="${ground}"/>` + rotations(5, `<circle cx="50" cy="40" r="1.8" fill="${ground}"/>`);
    }
    case 'mullet': {
      // Kikyo: a five-pointed bellflower, each petal veined from the center.
      const petal = `<path d="M50 50C41 42 37 31 41 22L50 13L59 22C63 31 59 42 50 50Z" fill="${ink}"/><path d="M50 47V24" stroke="${ground}" stroke-width="1.8" stroke-linecap="round"/>`;
      return rotations(5, petal) + `<circle cx="50" cy="50" r="4" fill="${ground}"/>`;
    }
    case 'crescent':
      // Tsuki: a crescent moon.
      return `<path d="M64 18A33 33 0 1 0 64 82A27 27 0 1 1 64 18Z" fill="${ink}"/>`;
    case 'tower':
      // Yama: three mountains, the middle one capped with snow.
      return `<path d="M12 72L34 40L44 52L56 28L88 72Z" fill="${ink}"/><path d="M49.5 37L56 28L62.5 37L59 35L56 39L53 35Z" fill="${ground}"/>`
        + `<path d="M12 78H88" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    case 'cross':
      // Igeta: the frame of a well, seen from above.
      return `<g fill="${ink}"><rect x="33" y="16" width="9" height="68" rx="1"/><rect x="58" y="16" width="9" height="68" rx="1"/>`
        + `<rect x="16" y="33" width="68" height="9" rx="1"/><rect x="16" y="58" width="68" height="9" rx="1"/></g>`;
    case 'crown': {
      // Ogi: an open folding fan.
      const [lx, ly] = polar(38, -62);
      const [rx, ry] = polar(38, 62);
      const ribs = [-46, -23, 0, 23, 46].map((d) => {
        const [x, y] = polar(36, d);
        return `<path d="M50 66L${f(x)} ${f(y + 16)}" stroke="${ground}" stroke-width="1.6"/>`;
      }).join('');
      return `<path d="M50 82L${f(lx)} ${f(ly + 16)}A38 38 0 0 1 ${f(rx)} ${f(ry + 16)}Z" fill="${ink}"/>${ribs}<circle cx="50" cy="80" r="4" fill="${ground}"/>`;
    }
    case 'key': {
      // Takanoha: two hawk feathers, crossed.
      const feather = `<path d="M50 10C61 26 61 70 50 90C39 70 39 26 50 10Z" fill="${ink}"/><path d="M50 16V86" stroke="${ground}" stroke-width="1.8"/>`
        + [30, 42, 54, 66].map((y) => `<path d="M50 ${y}L42 ${y - 6}M50 ${y}L58 ${y - 6}" stroke="${ground}" stroke-width="1.3"/>`).join('');
      return `<g transform="rotate(-28 50 50)">${feather}</g><g transform="rotate(28 50 50)">${feather}</g>`;
    }
    case 'bezants':
      // Mitsuboshi: three stars, under a single bar.
      return `<rect x="18" y="28" width="64" height="9" rx="1" fill="${ink}"/>`
        + [[50, 52], [32, 70], [68, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${ink}"/>`).join('');
  }
}

export function kamonUrl(arms: Arms): string {
  const fill = KAMON_COLORS[arms.field];
  const edge = arms.division === 'plain' ? fill : KAMON_COLORS[arms.second];
  // A motif the same color as its ground would vanish: fall back to white or ink.
  let ink = KAMON_COLORS[arms.chargeColor];
  if (arms.chargeColor === arms.field) ink = arms.field === 'argent' ? KAMON_COLORS.sable : KAMON_COLORS.argent;
  const { svg, scale } = frame(arms.division, fill, edge);
  const s = scale;
  const inner = `<g transform="translate(${f(50 - 50 * s)} ${f(50 - 50 * s)}) scale(${s})">${motif(arms.charge, ink, fill)}</g>`;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${svg}${inner}</svg>`);
}
