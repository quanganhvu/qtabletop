import { HOUSE_ARMS, type Arms, type Charge, type Tincture } from '../../shared/heraldry';
import { svgUrl } from './svg';

// Draws coats of arms: a heater shield with a field division and a charge, on a
// 100×110 artboard. Used for the noble houses and for players' own arms.

const INK = '#1e1610';
const T: Record<Tincture, string> = {
  or: '#c9a03a',
  argent: '#ece5d3',
  gules: '#8e1f24',
  azure: '#24427c',
  vert: '#2e5e3a',
  sable: '#1d1a17',
  purpure: '#5a2d66',
};

/** Swatch color for each tincture, for pickers. */
export const TINCTURE_COLORS = T;

const SHIELD = 'M14 10H86V52C86 78 70 94 50 102C30 94 14 78 14 52Z';

function field({ division, field: f, second: g }: Arms): string {
  const band = `stroke="${INK}" stroke-width="1"`;
  switch (division) {
    case 'plain': return `<rect width="100" height="110" fill="${T[f]}"/>`;
    case 'perPale': return `<rect width="50" height="110" fill="${T[f]}"/><rect x="50" width="50" height="110" fill="${T[g]}"/>`;
    case 'perFess': return `<rect width="100" height="52" fill="${T[f]}"/><rect y="52" width="100" height="58" fill="${T[g]}"/>`;
    case 'perBend': return `<rect width="100" height="110" fill="${T[g]}"/><path d="M0 0H100L0 100z" fill="${T[f]}"/>`;
    case 'quarterly': return `<rect width="100" height="110" fill="${T[f]}"/><rect x="50" width="50" height="52" fill="${T[g]}"/><rect y="52" width="50" height="58" fill="${T[g]}"/>`;
    case 'chevron': return `<rect width="100" height="110" fill="${T[f]}"/><path d="M8 82L50 42L92 82V96L50 56L8 96z" fill="${T[g]}" ${band}/>`;
    case 'chief': return `<rect width="100" height="110" fill="${T[f]}"/><rect width="100" height="30" fill="${T[g]}" ${band}/>`;
    case 'bend': return `<rect width="100" height="110" fill="${T[f]}"/><path d="M0 0L16 0L100 84V100z" fill="${T[g]}" ${band}/>`;
    case 'saltire': return `<rect width="100" height="110" fill="${T[f]}"/><path d="M8 4L50 46L92 4L100 12L58 54L100 96L92 104L50 62L8 104L0 96L42 54L0 12z" fill="${T[g]}" ${band}/>`;
    case 'pale': return `<rect width="100" height="110" fill="${T[f]}"/><rect x="38" width="24" height="110" fill="${T[g]}" ${band}/>`;
  }
}

function charge(kind: Charge, fill: string, y = 56): string {
  const s = `fill="${fill}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"`;
  switch (kind) {
    case 'fleur': return `<g transform="translate(50 ${y})" ${s}>
      <path d="M0-26C7-18 8-8 3 2H-3C-8-8-7-18 0-26z"/>
      <path d="M-3 0C-8-6-16-6-19 0c-3 6 2 12 8 10-4-2-4-7 0-8 3-1 5 2 6 4z"/>
      <path d="M3 0C8-6 16-6 19 0c3 6-2 12-8 10 4-2 4-7 0-8-3-1-5 2-6 4z"/>
      <rect x="-12" y="2" width="24" height="5" rx="1.5"/>
      <path d="M-3 7C-4 14-8 18-10 22 0 20 0 14 0 10 0 14 0 20 10 22 8 18 4 14 3 7z"/></g>`;
    case 'mullet': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? 9 : 21;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        return `${50 + Math.cos(a) * r},${y + Math.sin(a) * r}`;
      }).join(' ');
      return `<polygon points="${pts}" ${s}/>`;
    }
    case 'crescent': return `<path d="M30 ${y - 4}a20 20 0 0 0 40 0a17 17 0 0 1-40 0z" ${s}/>`;
    case 'tower': return `<g transform="translate(50 ${y})" ${s}><path d="M-13 22V-10h-4v-8h6v5h4v-5h6v5h4v-5h6v5h4v-5h6v8h-4v32z"/>
      <path d="M-5 22V12a5 5 0 0 1 10 0v10z" fill="${INK}"/><rect x="-2" y="-4" width="4" height="8" rx="2" fill="${INK}"/></g>`;
    case 'cross': return `<path d="M44 ${y - 30}h12l-2 22 22-2v12l-22-2 2 22H44l2-22-22 2V${y - 6}l22 2z" ${s}/>`;
    case 'crown': return `<g transform="translate(50 ${y})" ${s}><path d="M-20 10L-24-14l11 9L0-20l13 15 11-9-4 24z"/><rect x="-20" y="10" width="40" height="7" rx="1.5"/>
      <circle cx="-24" cy="-15" r="3"/><circle cx="0" cy="-21" r="3"/><circle cx="24" cy="-15" r="3"/></g>`;
    case 'key': return `<g transform="translate(50 ${y}) rotate(-35)" ${s}><circle cy="-16" r="9"/><circle cy="-16" r="4" fill="${INK}"/>
      <rect x="-2.5" y="-8" width="5" height="34"/><path d="M2.5 16h8v5h-8zM2.5 23h6v4h-6z"/></g>`;
    case 'bezants': return [[34, y - 14], [66, y - 14], [50, y + 12]].map(([x, cy]) => `<circle cx="${x}" cy="${cy}" r="9" ${s}/>`).join('');
    case 'none': return '';
  }
}

const cache = new Map<string, string>();

/** CSS `url(...)` for any coat of arms. */
export function armsUrl(arms: Arms): string {
  const key = `${arms.division}.${arms.field}.${arms.second}.${arms.charge}.${arms.chargeColor}`;
  let url = cache.get(key);
  if (!url) {
    const y = arms.division === 'chief' ? 64 : 56;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110">
      <defs>
        <clipPath id="s"><path d="${SHIELD}"/></clipPath>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
      </defs>
      <path d="${SHIELD}" fill="#000" opacity=".35" transform="translate(2 3)"/>
      <g clip-path="url(#s)">${field(arms)}${charge(arms.charge, T[arms.chargeColor], y)}<rect width="100" height="110" fill="url(#sheen)"/></g>
      <path d="${SHIELD}" fill="none" stroke="#c9a03a" stroke-width="3.5"/><path d="${SHIELD}" fill="none" stroke="${INK}" stroke-width="1.2"/>
    </svg>`;
    url = svgUrl(svg);
    cache.set(key, url);
  }
  return url;
}

/** CSS `url(...)` for a noble house's coat of arms, by noble id ("n0".."n9"). */
export const crestUrl = (nobleId: string) => armsUrl(HOUSE_ARMS[Number(nobleId.slice(1))] ?? HOUSE_ARMS[0]);
