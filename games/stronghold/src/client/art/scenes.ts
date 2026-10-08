// Card illustrations: small watercolor-and-ink paintings on parchment.
//
// Drawn on a 100×140 artboard (the card's 5:7 shape). The top ~30% sits under
// the card header and the bottom-left under the cost seals, so subjects lean
// center-right. Light falls from the upper left: buildings have a sunlit front
// and a shaded side. The tiers move through the day: morning on the land
// (tier I), golden afternoon in town (tier II), dusk for the great works (III).
// Each scene is rendered once to a data URI and cached.

import type { Color, Level } from '../../shared/game';
import { svgUrl } from './svg';

const INK = '#3a2a1c';
const L = `stroke="${INK}" stroke-width=".55" stroke-linejoin="round" stroke-linecap="round"`;

type Stops = [number, string][];
const MORNING: Stops = [[0, '#bcd3df'], [0.5, '#e9e4d0'], [1, '#f3dfb6']];
const AFTERNOON: Stops = [[0, '#a9c2cf'], [0.45, '#efd9aa'], [1, '#eeb877']];
const DUSK: Stops = [[0, '#2e3655'], [0.42, '#755a78'], [0.72, '#d98d68'], [1, '#f0c27c']];
const NIGHT: Stops = [[0, '#121a30'], [0.55, '#2c3a62'], [1, '#5d5577']];

function defs(sky: Stops, haze: string) {
  return `<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${sky.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>
  <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${haze}" stop-opacity="0"/><stop offset="1" stop-color="${haze}" stop-opacity=".75"/></linearGradient>
  <linearGradient id="cyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1a0f08" stop-opacity=".45"/></linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb0c4"/><stop offset="1" stop-color="#4f7590"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#fff3c8" stop-opacity=".95"/><stop offset=".35" stop-color="#ffcf73" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  <radialGradient id="sunglow"><stop offset="0" stop-color="#fffbe8"/><stop offset=".25" stop-color="#fff1c4" stop-opacity=".9"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient>
  <radialGradient id="vig" cx=".5" cy=".55" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".42"/></radialGradient>
  <pattern id="stone" width="7" height="4.4" patternUnits="userSpaceOnUse"><path d="M0 .2H7M0 2.4H7M2 .2V2.4M5.5 2.4V4.4" stroke="#4a3a28" stroke-width=".3" opacity=".42" fill="none"/></pattern>
  <pattern id="tiles" width="3.2" height="2.4" patternUnits="userSpaceOnUse"><path d="M0 2.4a1.6 1.4 0 0 1 3.2 0" fill="none" stroke="#2a120a" stroke-width=".3" opacity=".5"/></pattern>
  <pattern id="slate" width="3" height="2" patternUnits="userSpaceOnUse"><path d="M0 1.95H3M1.5 0V1" stroke="#141820" stroke-width=".28" opacity=".55"/></pattern>
  <pattern id="thatch" width="2.2" height="3.6" patternUnits="userSpaceOnUse"><path d="M.4 0L1 3.6M1.5 0L2.1 3.6" stroke="#6b4a1e" stroke-width=".3" opacity=".6"/></pattern>
  <pattern id="planks" width="5" height="2.2" patternUnits="userSpaceOnUse"><path d="M0 2.1H5M2.5 0V2.1" stroke="#2e1b0e" stroke-width=".28" opacity=".5"/></pattern>
  <pattern id="hatch" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="2.2" stroke="${INK}" stroke-width=".35" opacity=".45"/></pattern>
  <pattern id="furrows" width="6" height="2.6" patternUnits="userSpaceOnUse"><path d="M0 2.4Q3 1.6 6 2.4" fill="none" stroke="#5a4a22" stroke-width=".3" opacity=".45"/></pattern>
  <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.4"/></filter>
  <filter id="blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="wobble" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.1"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="9" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .2 0"/></filter>
</defs>`;
}

// ---- Atmosphere -------------------------------------------------------------

const sky = () => `<rect width="100" height="140" fill="url(#sky)"/>`;
const sun = (x: number, y: number, r = 6) =>
  `<circle cx="${x}" cy="${y}" r="${r * 4}" fill="url(#sunglow)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff8e0"/>`;
const moon = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="16" fill="url(#sunglow)" opacity=".45"/><path d="M${x} ${y - 6}a6 6 0 1 0 5.2 9 5 5 0 0 1-5.2-9z" fill="#f7efd6"/>`;
const stars = (pts: number[][]) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff6dc" opacity=".85"/>`).join('');
const cloud = (x: number, y: number, s = 1, color = '#fffaf0', op = 0.8) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${color}" opacity="${op}" filter="url(#soft)">
    <ellipse cx="0" cy="0" rx="10" ry="3.5"/><ellipse cx="6" cy="-2.5" rx="7" ry="3.8"/><ellipse cx="-5" cy="-1.5" rx="6" ry="3"/></g>`;
const haze = (y: number, h: number) => `<rect x="0" y="${y}" width="100" height="${h}" fill="url(#haze)"/>`;
const birds = (x: number, y: number) =>
  `<path d="M${x} ${y}q1.6-1.6 3.2 0q1.6-1.6 3.2 0M${x + 9} ${y - 4}q1.2-1.2 2.4 0q1.2-1.2 2.4 0" fill="none" stroke="${INK}" stroke-width=".5" opacity=".7"/>`;
const smoke = (x: number, y: number, color = '#cfc6b8') =>
  `<g fill="${color}" opacity=".6" filter="url(#soft)"><circle cx="${x}" cy="${y - 3}" r="2.6"/><circle cx="${x + 2}" cy="${y - 9}" r="3.4"/><circle cx="${x - 1}" cy="${y - 16}" r="4"/><circle cx="${x + 3}" cy="${y - 24}" r="4.6"/></g>`;
const glow = (x: number, y: number, r: number, op = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#glow)" opacity="${op}"/>`;
const rays = (x: number, y: number) =>
  `<g fill="#fff6d8" opacity=".16" filter="url(#soft)"><path d="M${x} ${y}l-14 70h8z"/><path d="M${x + 4} ${y}l-4 74h8z"/><path d="M${x + 8} ${y}l8 70h7z"/></g>`;

/** A landscape layer: a filled outline with optional texture or hatching on top. */
const land = (d: string, fill: string, tex?: string) => `<path d="${d}" fill="${fill}" ${L}/>${tex ? `<path d="${d}" fill="url(#${tex})"/>` : ''}`;
const far = (d: string, fill: string) => `<path d="${d}" fill="${fill}" opacity=".75"/>`;

// ---- Vegetation and people ---------------------------------------------------

function pine(x: number, y: number, s: number, c: string, dark: string) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-.8" y="-2" width="1.6" height="5" fill="#4a2f1c"/>
    <path d="M0-26L-7-12H-4L-10-1H-3L-11 3H11L3-1H10L4-12H7z" fill="${c}" ${L}/>
    <path d="M0-26L7-12H4L10-1H3L11 3H0z" fill="${dark}" opacity=".55"/></g>`;
}
function oak(x: number, y: number, s: number, c: string, dark: string, light: string) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-1.2 0V-8h2.4V0z" fill="#4a2f1c"/>
    <circle cx="-5" cy="-12" r="6.5" fill="${c}" ${L}/><circle cx="5" cy="-12" r="6.5" fill="${dark}" ${L}/><circle cx="0" cy="-18" r="7.5" fill="${c}" ${L}/>
    <circle cx="-3" cy="-20" r="3.2" fill="${light}" opacity=".7"/><circle cx="-7" cy="-14" r="2.4" fill="${light}" opacity=".5"/></g>`;
}
const grass = (x: number, y: number, c = '#4f6a32') =>
  `<path d="M${x} ${y}l.6-2.4M${x + 1} ${y}l-.2-3M${x + 2} ${y}l.8-2.2" stroke="${c}" stroke-width=".45"/>`;
/** A tiny figure: x = center, y = feet. */
function person(x: number, y: number, s: number, cloth: string, extra = '') {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-1.6 0L-1-3.5H1L1.6 0z" fill="#3b2a1e"/>
    <path d="M-2.4-3.2L-1.6-9h3.2l.8 5.8z" fill="${cloth}" ${L}/>
    <circle cx="0" cy="-10.6" r="1.7" fill="#e3bf98" ${L}/>${extra}</g>`;
}

// ---- Architecture -------------------------------------------------------------

interface Wall { x: number; y: number; w: number; h: number; d?: number; lit: string; shade: string; tex?: 'stone' | 'planks' | 'timber' }
interface Roof { kind: 'gable' | 'cone' | 'crenel' | 'none'; color?: string; shade?: string; h?: number; tex?: 'tiles' | 'slate' | 'thatch' }

/** A building with a sunlit front, a shaded side receding up-right and a roof. x, y = front bottom-left. */
function building(wall: Wall, roof: Roof = { kind: 'none' }) {
  const { x, y, w, h, lit, shade } = wall;
  const d = wall.d ?? Math.min(8, w * 0.28);
  const dy = d * 0.55;
  const top = y - h;
  let out = `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${lit}" ${L}/>`;
  if (wall.tex === 'stone') out += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#stone)"/>`;
  if (wall.tex === 'planks') out += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#planks)"/>`;
  if (wall.tex === 'timber') {
    out += `<path d="M${x} ${top + h * 0.48}H${x + w}M${x + w / 3} ${top}V${y}M${x + (2 * w) / 3} ${top}V${y}M${x} ${top}L${x + w / 3} ${top + h * 0.48}M${x + w} ${top}L${x + (2 * w) / 3} ${top + h * 0.48}" fill="none" stroke="#4a2e1a" stroke-width="1"/>`;
  }
  const side = `M${x + w} ${y}L${x + w + d} ${y - dy}V${top - dy}L${x + w} ${top}z`;
  out += `<path d="${side}" fill="${shade}" ${L}/>${wall.tex === 'stone' ? `<path d="${side}" fill="url(#stone)"/>` : ''}<path d="${side}" fill="url(#hatch)"/>`;
  const rc = roof.color ?? '#8f4a32';
  const rs = roof.shade ?? '#6a3322';
  if (roof.kind === 'gable') {
    const rh = roof.h ?? w * 0.55;
    const peak = top - rh;
    out += `<path d="M${x + w / 2} ${peak}L${x + w / 2 + d} ${peak - dy}L${x + w + d + 1.5} ${top - dy}L${x + w + 1.5} ${top}z" fill="${rs}" ${L}/>`;
    if (roof.tex) out += `<path d="M${x + w / 2} ${peak}L${x + w / 2 + d} ${peak - dy}L${x + w + d + 1.5} ${top - dy}L${x + w + 1.5} ${top}z" fill="url(#${roof.tex})"/>`;
    out += `<path d="M${x - 1.5} ${top}L${x + w / 2} ${peak}L${x + w + 1.5} ${top}z" fill="${lit}" ${L}/>`;
    if (wall.tex === 'timber') out += `<path d="M${x + w / 2} ${peak + 2}V${top}M${x + w * 0.25} ${top - rh * 0.45}L${x + w / 2} ${top}L${x + w * 0.75} ${top - rh * 0.45}" fill="none" stroke="#4a2e1a" stroke-width=".9"/>`;
    out += `<path d="M${x - 2} ${top + 0.5}L${x + w / 2} ${peak - 1}L${x + w + 2} ${top + 0.5}" fill="none" stroke="${rc}" stroke-width="1.6"/>`;
  } else if (roof.kind === 'crenel') {
    for (let mx = x; mx < x + w - 1; mx += 4.2) out += `<rect x="${mx}" y="${top - 2.6}" width="2.4" height="2.6" fill="${lit}" ${L}/>`;
    out += `<path d="M${x + w} ${top}L${x + w + d} ${top - dy}" ${L}/>`;
  }
  return out;
}

/** A round tower with a conical roof: cx = center, y = ground. */
function tower(cx: number, y: number, w: number, h: number, lit: string, roof: string, flag?: string, roofTex: 'slate' | 'tiles' = 'slate') {
  const x = cx - w / 2;
  const top = y - h;
  const rh = w * 1.25;
  let out = `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${lit}" ${L}/><rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#stone)"/><rect x="${x}" y="${top}" width="${w}" height="${h}" fill="url(#cyl)"/>`;
  out += `<path d="M${x - 1.5} ${top}L${cx} ${top - rh}L${x + w + 1.5} ${top}z" fill="${roof}" ${L}/><path d="M${x - 1.5} ${top}L${cx} ${top - rh}L${x + w + 1.5} ${top}z" fill="url(#${roofTex})"/><path d="M${x - 1.5} ${top}L${cx} ${top - rh}L${x + w + 1.5} ${top}z" fill="url(#cyl)"/>`;
  out += `<rect x="${cx - 0.8}" y="${top + h * 0.22}" width="1.6" height="${Math.min(5, h * 0.15)}" rx=".8" fill="#2a1d12"/>`;
  if (flag) out += `<path d="M${cx} ${top - rh}v-7" stroke="${INK}" stroke-width=".5"/><path d="M${cx} ${top - rh - 7}q3 .5 6 0q-1 1.5 0 3q-3 .6-6 0z" fill="${flag}" ${L}/>`;
  return out;
}

function win(x: number, y: number, w: number, h: number, lit = false, arch = true) {
  const shape = arch
    ? `M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}z`
    : `M${x} ${y}h${w}v${h}h-${w}z`;
  return `${lit ? glow(x + w / 2, y + h / 2, w * 2.4, 0.8) : ''}<path d="${shape}" fill="${lit ? '#ffd889' : '#2e2016'}" ${L}/>
    ${lit ? `<path d="M${x + w / 2} ${y + 1}V${y + h}M${x} ${y + h * 0.55}H${x + w}" stroke="#7a4a1e" stroke-width=".4"/>` : ''}`;
}
const door = (x: number, y: number, w: number, h: number, c = '#5a3a22') =>
  `<path d="M${x} ${y}V${y - h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y}z" fill="${c}" ${L}/><path d="M${x} ${y}V${y - h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y}z" fill="url(#planks)"/>`;
const banner = (x: number, y: number, h: number, color: string) =>
  `<path d="M${x - 0.5} ${y}h5" stroke="${INK}" stroke-width=".6"/><path d="M${x} ${y}h4v${h}l-2-2-2 2z" fill="${color}" ${L}/><path d="M${x + 2.6} ${y}v${h - 1.5}" stroke="#000" stroke-width="1.2" opacity=".18"/>`;
function water(y: number, h: number) {
  return `<rect x="0" y="${y}" width="100" height="${h}" fill="url(#water)" ${L}/>
    <g stroke="#e8f2f6" stroke-width=".5" opacity=".6"><path d="M6 ${y + 2.5}h9M28 ${y + 4.5}h12M58 ${y + 2}h8M74 ${y + 6}h11M14 ${y + 7}h7M44 ${y + 8}h9"/></g>`;
}

// ---- Scenes -------------------------------------------------------------------------

const SCENES: Record<Level, Record<Color, () => string>> = {
  1: {
    // Quarry: a cut stone face, a treadwheel crane hoisting a block, masons at work.
    white: () => `${defs(MORNING, '#efe6d2')}${sky()}${sun(22, 30, 4.5)}${cloud(70, 34, 1.1)}${birds(48, 40)}
      ${far('M0 76L14 66L30 72L48 60L66 70L84 62L100 68V100H0z', '#b6bfb4')}${haze(60, 30)}
      ${land('M0 70L10 64H30V76H46V88H60V100H72V112H100V140H0z', '#d4c7aa', 'stone')}
      ${land('M30 64H34V76H30zM46 76H50V88H46zM60 88H64V100H60z', '#a9997a', 'hatch')}
      ${land('M0 112Q50 106 100 112V140H0z', '#cdbf9f')}
      <path d="M62 116L72 58L82 116M65 98H79M67 86H77" fill="none" stroke="#5a3a22" stroke-width="1.3"/><path d="M72 58L94 70" stroke="#5a3a22" stroke-width="1.3"/>
      <circle cx="61" cy="102" r="9" fill="none" stroke="#5a3a22" stroke-width="1.2"/><circle cx="61" cy="102" r="1.4" fill="#5a3a22"/>
      ${[0, 45, 90, 135].map((a) => `<path d="M61 102l${(Math.cos((a * Math.PI) / 180) * 9).toFixed(2)} ${(Math.sin((a * Math.PI) / 180) * 9).toFixed(2)}M61 102l${(-Math.cos((a * Math.PI) / 180) * 9).toFixed(2)} ${(-Math.sin((a * Math.PI) / 180) * 9).toFixed(2)}" stroke="#5a3a22" stroke-width=".6"/>`).join('')}
      <path d="M94 70V92" stroke="${INK}" stroke-width=".5"/>${building({ x: 88, y: 99, w: 10, h: 7, d: 3, lit: '#e3d8bf', shade: '#b4a587', tex: 'stone' })}
      ${building({ x: 16, y: 128, w: 14, h: 9, d: 4, lit: '#e3d8bf', shade: '#b4a587', tex: 'stone' })}${building({ x: 22, y: 119, w: 10, h: 7, d: 3, lit: '#d9cdb2', shade: '#ab9c7f', tex: 'stone' })}
      ${person(44, 126, 1.1, '#7a5a3a', '<path d="M1.5-8l4-3" stroke="#3a2a1c" stroke-width=".6"/>')}${person(84, 124, 1, '#8e3a2e')}
      ${grass(4, 132)}${grass(52, 134)}${grass(92, 136)}`,

    // Weaver's Cottage: a thatched cottage by the river, blue cloth drying on frames.
    blue: () => `${defs(MORNING, '#e6ebe8')}${sky()}${sun(80, 28, 4.5)}${cloud(20, 36, 1)}
      ${far('M0 80Q20 66 44 74T100 70V100H0z', '#aebfb0')}${haze(64, 26)}
      ${land('M0 92Q40 82 100 90V140H0z', '#a7b98a')}
      ${oak(14, 96, 1.1, '#7a9a5a', '#5a7a44', '#a8c07a')}
      ${building({ x: 50, y: 104, w: 30, h: 18, d: 8, lit: '#efe2c4', shade: '#c4ae86', tex: 'timber' }, { kind: 'gable', color: '#b8964a', shade: '#a07a36', h: 14, tex: 'thatch' })}
      ${win(55, 92, 5, 6, false, false)}${door(64, 104, 6, 10)}${smoke(76, 74)}
      <path d="M22 108V88M46 108V88" stroke="#5a3a22" stroke-width=".9"/><path d="M22 89H46" stroke="#5a3a22" stroke-width=".7"/>
      ${[[24, 6, 15], [31, 6, 16], [38, 6, 14]].map(([x, w, h]) => `<path d="M${x} 89h${w}v${h}l-${w / 2}-1.5-${w / 2} 1.5z" fill="#3f5f96" ${L}/><path d="M${x + w * 0.65} 89v${h - 1}" stroke="#20365e" stroke-width="1.2" opacity=".55"/><path d="M${x} 92h${w}" stroke="#d9b24a" stroke-width=".6"/>`).join('')}
      ${water(110, 12)}<path d="M50 112h30" stroke="#efe2c4" stroke-width="1.6" opacity=".25"/>
      ${land('M0 122Q50 118 100 123V140H0z', '#98ac78')}${person(86, 132, 1.05, '#3f5f96')}${grass(10, 134)}${grass(60, 136)}`,

    // Woodcutter's Camp: sunlight through a pine forest, a log pile and a woodcutter.
    green: () => `${defs(MORNING, '#dfe6d4')}${sky()}${sun(60, 26, 4)}
      ${pine(8, 82, 0.9, '#9fb79a', '#7f9a7a')}${pine(26, 78, 0.95, '#9fb79a', '#7f9a7a')}${pine(92, 80, 0.9, '#9fb79a', '#7f9a7a')}${haze(56, 32)}
      ${rays(56, 30)}
      ${land('M0 96Q50 88 100 96V140H0z', '#9bb27c')}
      ${pine(16, 104, 1.3, '#5f8150', '#3f5f38')}${pine(84, 102, 1.45, '#5f8150', '#3f5f38')}${pine(98, 110, 1.1, '#4f7044', '#34512f')}
      ${[[46, 120], [56, 120], [66, 120], [51, 111.5], [61, 111.5], [56, 103]].map(([x, y]) => `<path d="M${x} ${y - 4.6}h-7v9.2h7" fill="#7a4e2c" ${L}/><circle cx="${x}" cy="${y}" r="4.6" fill="#e5c58e" ${L}/><circle cx="${x}" cy="${y}" r="2.6" fill="none" stroke="#b08850" stroke-width=".45"/><circle cx="${x}" cy="${y}" r="1" fill="none" stroke="#b08850" stroke-width=".4"/>`).join('')}
      <path d="M72 128v-6h10v6z" fill="#7a4e2c" ${L}/><ellipse cx="77" cy="122" rx="5" ry="1.6" fill="#e5c58e" ${L}/>
      ${person(32, 128, 1.2, '#5a7a44', '<path d="M2-8l4-5" stroke="#5a3a22" stroke-width=".8"/><path d="M5-14l2.4 1-1 2-2.2-1z" fill="#9aa0a6"/>')}
      ${smoke(90, 118, '#d8d2c4')}${grass(6, 134)}${grass(44, 136)}`,

    // Vineyard: terraced vines on rolling hills, a stone chapel, harvesters with baskets.
    red: () => {
      let rows = '';
      for (let i = 0; i < 6; i++) {
        const y = 98 + i * 7.5;
        rows += `<path d="M-2 ${y}Q50 ${y - 7} 102 ${y}" fill="none" stroke="#5a6a32" stroke-width="1.6"/>`;
        for (let x = 3 + (i % 2) * 5; x < 100; x += 10) {
          const yy = y - 1.8 - Math.sin((x / 100) * Math.PI) * 5.3;
          rows += `<circle cx="${x}" cy="${yy}" r="1.3" fill="#6e2a4a"/><circle cx="${x + 1}" cy="${yy + 0.6}" r="1" fill="#8e3a5a"/>`;
        }
      }
      return `${defs(MORNING, '#efdfcf')}${sky()}${sun(78, 28, 4.5)}${cloud(24, 38, 0.9)}
        ${far('M0 80Q26 64 52 74T100 68V100H0z', '#c2b3a2')}${haze(60, 30)}
        ${land('M0 84Q30 72 60 80T100 76V140H0z', '#b7b27a', 'furrows')}
        ${building({ x: 58, y: 80, w: 12, h: 10, d: 4, lit: '#efe2c4', shade: '#c4ae86', tex: 'stone' }, { kind: 'gable', color: '#8f4a32', shade: '#6a3322', h: 6, tex: 'tiles' })}
        ${tower(73, 82, 5, 14, '#efe2c4', '#6a3322', undefined, 'tiles')}${oak(40, 82, 0.7, '#7a8a4a', '#5a6a32', '#a8b26a')}
        ${land('M0 92Q50 84 100 92V140H0z', '#a9a46a')}${rows}
        ${person(70, 132, 1.15, '#8e2a2e', '<ellipse cx="3" cy="-5" rx="2.4" ry="1.6" fill="#a87a44" stroke="#3a2a1c" stroke-width=".4"/>')}${person(84, 134, 1.05, '#5a6a8a')}`;
    },

    // Iron Mine: a timbered adit in the mountainside, ore carts on rails, a smelter's smoke.
    black: () => `${defs(MORNING, '#e2e0da')}${sky()}${cloud(72, 30, 1.2, '#f3f0ea')}
      ${far('M0 70L20 46L34 58L52 34L72 54L88 44L100 52V100H0z', '#a9aeb2')}<path d="M52 34L46 42L50 41L54 44L58 40z" fill="#f4f2ec"/>${haze(50, 40)}
      ${land('M0 100L16 74L34 84L56 66L80 80L100 74V140H0z', '#8c867c', 'hatch')}
      ${land('M0 112Q50 104 100 112V140H0z', '#b5ad9c')}
      <path d="M58 112V94a9 9 0 0 1 18 0v18z" fill="#1e1610" ${L}/><path d="M56 112V92h22v20M55 92h24" fill="none" stroke="#5a3a22" stroke-width="1.6"/>
      ${glow(67, 104, 6, 0.6)}${person(67, 112, 0.9, '#5a5550', '<circle cx="2.5" cy="-7" r=".9" fill="#ffd27a"/>')}
      <path d="M4 124h68M4 127.5h68" stroke="#4a4038" stroke-width=".7"/><path d="M8 124v3.5M18 124v3.5M28 124v3.5M38 124v3.5M48 124v3.5M58 124v3.5" stroke="#5a3a22" stroke-width=".8"/>
      <path d="M22 113h18l-2.4 8.6H24.4z" fill="#6a5a4a" ${L}/><path d="M22 113h18l-2.4 8.6H24.4z" fill="url(#planks)"/>
      <path d="M23 113l3-3 3 1.5 4-3 3 2 3.5 2.5z" fill="#3a3632" ${L}/><circle cx="26" cy="123" r="2" fill="#2e2a26" ${L}/><circle cx="36" cy="123" r="2" fill="#2e2a26" ${L}/>
      ${building({ x: 82, y: 112, w: 8, h: 20, d: 3, lit: '#9a9288', shade: '#6e665c', tex: 'stone' })}${glow(86, 92, 4, 0.7)}${smoke(86, 90, '#9a948c')}
      ${grass(46, 132, '#5a5a44')}${grass(80, 134, '#5a5a44')}`,
  },
  2: {
    // Masons' Guild: a church rising inside timber scaffolding, a crane and masons.
    white: () => `${defs(AFTERNOON, '#f0dcb8')}${sky()}${sun(18, 32, 5)}${cloud(74, 34, 1.1, '#fff4dc')}${birds(56, 38)}
      ${far('M0 92h14V80h8v12h10V84h10v8h58V100H0z', '#c9b28e')}${haze(74, 26)}
      ${land('M0 118Q50 112 100 118V140H0z', '#d8c39c')}
      ${building({ x: 36, y: 118, w: 38, h: 44, d: 10, lit: '#f1e5c9', shade: '#c8b089', tex: 'stone' })}
      ${win(42, 86, 6, 13)}${win(62, 86, 6, 13)}${door(51, 118, 9, 16)}
      <path d="M40 74V58h12v16M52 58l-6-9-6 9" fill="none" stroke="${INK}" stroke-width=".6" stroke-dasharray="1.6 1.2"/>
      <g stroke="#6a4424" stroke-width=".9" fill="none"><path d="M32 118V56M86 118V60M32 98H86M32 78H86M32 60H86"/><path d="M32 78l54 20M86 78L32 98" opacity=".55"/></g>
      ${person(44, 78, 0.85, '#8e3a2e')}${person(70, 98, 0.85, '#3f5f96')}
      <path d="M92 118L92 70L102 64" stroke="#5a3a22" stroke-width="1.1" fill="none"/><path d="M97 67V84" stroke="${INK}" stroke-width=".4"/>
      ${building({ x: 92, y: 90, w: 6, h: 5, d: 2, lit: '#e3d8bf', shade: '#b4a587', tex: 'stone' })}
      ${building({ x: 8, y: 132, w: 12, h: 8, d: 4, lit: '#e3d8bf', shade: '#b4a587', tex: 'stone' })}${person(26, 132, 1.1, '#7a5a3a', '<path d="M1.6-8l3.6-2.4" stroke="#3a2a1c" stroke-width=".6"/>')}`,

    // Cloth Market: a square of tall gabled houses, market stalls with blue awnings, townsfolk.
    blue: () => {
      const stall = (x: number, y: number) => `
        <rect x="${x}" y="${y - 10}" width="20" height="10" fill="#d9c49a" ${L}/><rect x="${x}" y="${y - 10}" width="20" height="10" fill="url(#planks)"/>
        <path d="M${x - 2} ${y - 10}l2.5-7h17l2.5 7z" fill="#3f5f96" ${L}/><path d="M${x + 4} ${y - 10}l1-7M${x + 10} ${y - 10}v-7M${x + 16} ${y - 10}l-1-7" stroke="#e8e0cc" stroke-width="1.6" opacity=".8"/>
        <path d="M${x + 2} ${y - 9}h5v7h-5zM${x + 9} ${y - 9}h5v7h-5z" fill="#2f4f8a" ${L}/><path d="M${x + 15} ${y - 9}h4v7h-4z" fill="#8e2a2e" ${L}/>`;
      return `${defs(AFTERNOON, '#f0dcb8')}${sky()}${cloud(30, 30, 1.1, '#fff4dc')}
        ${building({ x: 2, y: 96, w: 18, h: 30, d: 5, lit: '#f1e5c9', shade: '#c8b089', tex: 'timber' }, { kind: 'gable', color: '#8f4a32', shade: '#6a3322', h: 14, tex: 'tiles' })}
        ${building({ x: 25, y: 96, w: 18, h: 38, d: 5, lit: '#e7d3a8', shade: '#b89a6a', tex: 'timber' }, { kind: 'gable', color: '#5d6470', shade: '#454b55', h: 14, tex: 'slate' })}
        ${building({ x: 48, y: 96, w: 18, h: 32, d: 5, lit: '#f1e5c9', shade: '#c8b089', tex: 'timber' }, { kind: 'gable', color: '#8f4a32', shade: '#6a3322', h: 14, tex: 'tiles' })}
        ${building({ x: 71, y: 96, w: 18, h: 40, d: 6, lit: '#e2cfa6', shade: '#b4966a', tex: 'timber' }, { kind: 'gable', color: '#5d6470', shade: '#454b55', h: 14, tex: 'slate' })}
        ${[8, 31, 54, 77].map((x) => win(x, 74, 5, 6, false, false)).join('')}
        <path d="M0 64Q25 72 50 64T100 64" fill="none" stroke="${INK}" stroke-width=".4"/>${[8, 18, 30, 42, 58, 70, 82, 92].map((x, i) => `<path d="M${x} ${64 + Math.sin((x / 50) * Math.PI) * 3.6}l1.6 3 1.6-3z" fill="${['#3f5f96', '#c9a03a', '#8e2a2e'][i % 3]}"/>`).join('')}
        ${land('M0 96H100V140H0z', '#d3bf98')}<path d="M0 104H100M0 114H100M0 126H100" stroke="#a9946c" stroke-width=".4"/>
        ${stall(10, 116)}${stall(56, 118)}
        ${person(38, 122, 1.15, '#8e2a2e')}${person(46, 128, 1.1, '#3f5f96')}${person(86, 130, 1.2, '#5a7a44')}${person(94, 126, 1.05, '#c9a03a')}`;
    },

    // Watermill: a timbered mill turning its great wheel in the millrace, a stone bridge.
    green: () => {
      let wheel = '';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const ex = 30 + Math.cos(a) * 15;
        const ey = 98 + Math.sin(a) * 15;
        wheel += `<path d="M30 98L${ex.toFixed(2)} ${ey.toFixed(2)}" stroke="#5a3a22" stroke-width=".7"/><rect x="${(ex - 1.6).toFixed(2)}" y="${(ey - 1.6).toFixed(2)}" width="3.2" height="3.2" fill="#8a6038" ${L} transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${ex.toFixed(2)} ${ey.toFixed(2)})"/>`;
      }
      return `${defs(AFTERNOON, '#ebdcb4')}${sky()}${sun(82, 30, 5)}${cloud(26, 36, 1, '#fff4dc')}
        ${far('M0 82Q30 66 62 76T100 72V100H0z', '#b7b88e')}${haze(60, 30)}
        ${land('M0 92Q50 82 100 90V140H0z', '#9fb07a')}
        ${oak(90, 94, 1.15, '#6f8a4a', '#536c38', '#9cb06a')}
        ${building({ x: 40, y: 110, w: 34, h: 26, d: 9, lit: '#efe2c4', shade: '#c4ae86', tex: 'timber' }, { kind: 'gable', color: '#8f4a32', shade: '#6a3322', h: 18, tex: 'tiles' })}
        ${win(46, 90, 5, 6, false, false)}${win(64, 90, 5, 6, false, false)}${door(54, 110, 7, 11)}${smoke(80, 64)}
        <circle cx="30" cy="98" r="16" fill="none" stroke="#5a3a22" stroke-width="1.3"/><circle cx="30" cy="98" r="12" fill="none" stroke="#5a3a22" stroke-width=".6"/>${wheel}<circle cx="30" cy="98" r="2.4" fill="#8a6038" ${L}/>
        ${water(110, 14)}<g fill="#fff" opacity=".55" filter="url(#soft)"><ellipse cx="30" cy="112" rx="9" ry="2"/></g>
        ${land('M0 124Q50 120 100 126V140H0z', '#8fa26a')}
        <path d="M60 124l2-8h3v2h2a6 4 0 0 1 12 0h2v-2h3l2 8z" fill="#cdbf9f" ${L}/><path d="M60 124l2-8h3v2h2a6 4 0 0 1 12 0h2v-2h3l2 8z" fill="url(#stone)"/>
        ${person(88, 116, 0.95, '#8e2a2e')}<rect x="76" y="106" width="4" height="4.5" rx="1.2" fill="#e5d4b0" ${L}/><rect x="80" y="107" width="3.6" height="3.8" rx="1.2" fill="#e5d4b0" ${L}/>`;
    },

    // Tavern: a timbered inn at golden hour, lamplit windows, a painted sign, barrels and a feast table.
    red: () => `${defs(AFTERNOON, '#efd2a8')}${sky()}${sun(16, 34, 5)}${cloud(70, 28, 1.1, '#fff0d4')}
      ${building({ x: 4, y: 104, w: 16, h: 30, d: 4, lit: '#e7d3a8', shade: '#b89a6a', tex: 'timber' }, { kind: 'gable', color: '#5d6470', shade: '#454b55', h: 12, tex: 'slate' })}
      ${building({ x: 30, y: 112, w: 48, h: 38, d: 12, lit: '#efe0bd', shade: '#c4a878', tex: 'timber' }, { kind: 'gable', color: '#8f4a32', shade: '#6a3322', h: 22, tex: 'tiles' })}
      ${win(35, 96, 7, 8, true, false)}${win(66, 96, 7, 8, true, false)}${win(35, 80, 6, 7, true, false)}${win(67, 80, 6, 7, true, false)}${win(51, 64, 6, 7, true, true)}
      ${door(50, 112, 8, 14, '#4a2e1a')}${glow(54, 106, 10, 0.5)}
      <path d="M78 76h14M90 76v3" stroke="#3a2a1c" stroke-width=".9"/><rect x="85" y="79" width="10" height="11" rx="1" fill="#e8d6b0" ${L}/>
      <path d="M87.5 81.5h5c0 3.4-1 5.4-2.5 5.4s-2.5-2-2.5-5.4zM90 87v1.6" fill="#8e2a2e" ${L}/>
      ${land('M0 112Q50 108 100 112V140H0z', '#cdb58c')}<path d="M0 120H100M0 130H100" stroke="#a48a62" stroke-width=".4"/>
      <ellipse cx="14" cy="122" rx="6" ry="8" fill="#9a6a3c" ${L}/><path d="M8 118h12M8 126h12" stroke="#4a2e1a" stroke-width=".7"/><ellipse cx="14" cy="114" rx="4.6" ry="1.6" fill="#7a4e2c" ${L}/>
      <rect x="60" y="122" width="30" height="2.2" fill="#7a4e2c" ${L}/><path d="M63 124.2v8M87 124.2v8" stroke="#5a3a22" stroke-width="1"/>
      <path d="M66 122c0-3 1.4-4.4 3-4.4s3 1.4 3 4.4z" fill="#e8d6b0" ${L}/><circle cx="78" cy="120.6" r="1.6" fill="#8e2a2e" ${L}/><path d="M82 122v-3.4h2.4v3.4" fill="#e9eef0" fill-opacity=".5" ${L}/>
      ${person(56, 132, 1.15, '#8e2a2e')}${person(94, 134, 1.15, '#3f5f96')}`,

    // Blacksmith's Forge: a stone smithy, its hearth throwing firelight; the smith at the anvil.
    black: () => `${defs(AFTERNOON, '#e6d0b0')}${sky()}${cloud(26, 30, 1.1, '#fff0d4')}${sun(80, 34, 4.5)}
      ${far('M0 90h20V78h10v12h12V82h12v8H100V100H0z', '#bba487')}${haze(70, 30)}
      ${building({ x: 30, y: 116, w: 50, h: 38, d: 12, lit: '#b8ada0', shade: '#857a6c', tex: 'stone' }, { kind: 'gable', color: '#5d6470', shade: '#454b55', h: 16, tex: 'slate' })}
      ${building({ x: 66, y: 66, w: 8, h: 16, d: 3, lit: '#a89d90', shade: '#7a6f62', tex: 'stone' })}${smoke(70, 46, '#8f8a84')}
      <path d="M40 116V96a12 12 0 0 1 24 0v20z" fill="#1c1410" ${L}/>
      ${glow(52, 106, 26, 0.9)}<path d="M44 116c0-9 4-13 8-17 4 4 8 8 8 17z" fill="#e8822e"/><path d="M48 116c0-5 2-8 4-11 2 3 4 6 4 11z" fill="#ffd36b"/>
      ${land('M0 116Q50 112 100 116V140H0z', '#a59a88')}${glow(52, 122, 20, 0.45)}
      <path d="M14 112h16c0 3 3 5 7 5v3h-6v4c0 2 1 3 3 3v4H17v-4c2 0 3-1 3-3v-4h-2c-3 0-4-4-4-8z" fill="#4a4a4e" ${L}/><path d="M15 113h14" stroke="#b9bec4" stroke-width=".8"/>
      ${person(25, 112, 1.25, '#5a4a3a', '<path d="M2-9l3.6-4.6" stroke="#5a3a22" stroke-width=".8"/><rect x="4.6" y="-15.6" width="3" height="2" fill="#6a6e74"/>')}
      <g stroke="#ffbe55" stroke-width=".7" stroke-linecap="round"><path d="M30 108l3-4M32 110l4-1M29 106l.5-4"/></g>
      ${[86, 90, 94].map((x, i) => `<path d="M${x} ${118 + i}a2 2 0 1 1 4 0" fill="none" stroke="#3a3a3e" stroke-width="1"/>`).join('')}`,
  },
  3: {
    // Cathedral: a gothic front at dusk, twin spires, a glowing rose window, worshippers below.
    white: () => `${defs(DUSK, '#d9a07a')}${sky()}${stars([[12, 12, 0.5], [30, 6, 0.4], [88, 10, 0.5]])}${cloud(78, 32, 1.2, '#f4c39a', 0.55)}${birds(12, 40)}
      ${far('M0 100h10V90h8v10h8V94h66V108H0z', '#6e5a6a')}
      ${tower(28, 120, 16, 58, '#efe2c4', '#5d6470')}${tower(84, 120, 16, 62, '#efe2c4', '#5d6470')}
      ${building({ x: 36, y: 120, w: 40, h: 52, d: 0.1, lit: '#f1e5c9', shade: '#c8b089', tex: 'stone' })}
      <path d="M34 68L56 46L78 68z" fill="#e7d8b8" ${L}/><path d="M34 68L56 46L78 68z" fill="url(#stone)"/><path d="M56 46v-6M53 43h6" stroke="${INK}" stroke-width=".7"/>
      ${glow(56, 82, 16, 0.85)}<circle cx="56" cy="82" r="8" fill="#c9a0d6" ${L}/>
      <g stroke="#5a3a6a" stroke-width=".5"><path d="M56 74v16M48 82h16M50.3 76.3l11.4 11.4M61.7 76.3L50.3 87.7"/><circle cx="56" cy="82" r="3.4" fill="#f0c86a"/></g>
      ${win(42, 92, 5, 12, true)}${win(65, 92, 5, 12, true)}${win(25.5, 80, 5, 14, true)}${win(81.5, 80, 5, 14, true)}
      ${door(50, 120, 12, 18, '#4a2e1a')}${glow(56, 114, 12, 0.45)}
      ${land('M0 120Q50 116 100 120V140H0z', '#b8a78c')}<path d="M0 128H100" stroke="#8c7c62" stroke-width=".4"/>
      ${person(40, 132, 1.05, '#3f5f96')}${person(46, 134, 1, '#8e2a2e')}${person(72, 133, 1.05, '#5a7a44')}`,

    // Guild Hall: a towering stepped-gable hall hung with blue banners, a clock, lanterns in the square.
    blue: () => {
      const gable = 'M24 120V64h4v-6h5v-6h5v-6h5v-6h6v-6h6v6h6v6h5v6h5v6h5v6h4v56z';
      return `${defs(DUSK, '#c99088')}${sky()}${stars([[10, 10, 0.5], [88, 14, 0.5], [70, 6, 0.4]])}${moon(84, 30)}
        ${building({ x: 2, y: 120, w: 16, h: 36, d: 4, lit: '#d9c49a', shade: '#a48a62', tex: 'timber' }, { kind: 'gable', color: '#5d6470', shade: '#454b55', h: 12, tex: 'slate' })}
        <path d="${gable}" fill="#efe0c0" ${L}/><path d="${gable}" fill="url(#stone)"/><path d="M76 120V64l6 3v57z" fill="#b8a07a" ${L}/><path d="M76 120V64l6 3v57z" fill="url(#hatch)"/>
        <circle cx="52" cy="46" r="4.4" fill="#f6ecd2" ${L}/><path d="M52 43.4V46l1.8 1.2" stroke="${INK}" stroke-width=".5"/>
        ${[30, 41, 57, 68].map((x) => win(x, 60, 5, 10, true)).join('')}
        ${banner(29, 78, 16, '#3f5f96')}${banner(40, 78, 16, '#3f5f96')}${banner(56, 78, 16, '#3f5f96')}${banner(67, 78, 16, '#3f5f96')}
        ${door(46, 120, 12, 18, '#4a2e1a')}${glow(52, 112, 12, 0.5)}
        ${land('M0 120H100V140H0z', '#a8977c')}<path d="M0 128H100M0 134H100" stroke="#857560" stroke-width=".4"/>
        ${[16, 90].map((x) => `<path d="M${x} 134V118" stroke="#2e2016" stroke-width=".8"/>${glow(x, 116, 7, 0.9)}<rect x="${x - 1.6}" y="114" width="3.2" height="4" fill="#ffd889" ${L}/>`).join('')}
        ${person(34, 132, 1.05, '#3f5f96')}${person(70, 134, 1.1, '#8e2a2e')}${person(76, 132, 1, '#c9a03a')}`;
    },

    // Great Hall: a steep-roofed timber longhall with carved gables among the pines, torches at dusk.
    green: () => `${defs(DUSK, '#b98a76')}${sky()}${stars([[20, 10, 0.5], [60, 8, 0.4], [84, 16, 0.5]])}${cloud(30, 34, 1.1, '#f0b896', 0.5)}
      ${pine(6, 96, 1.1, '#3c4f3e', '#2a3a2e')}${pine(20, 92, 0.9, '#3c4f3e', '#2a3a2e')}${pine(94, 94, 1.2, '#3c4f3e', '#2a3a2e')}
      ${land('M0 110Q50 102 100 110V140H0z', '#6f7a58')}
      ${building({ x: 24, y: 116, w: 54, h: 26, d: 14, lit: '#9a6c42', shade: '#6e4a2a', tex: 'planks' }, { kind: 'gable', color: '#4a3020', shade: '#3a2416', h: 30, tex: 'thatch' })}
      <path d="M48 62l-5-8q-1-3 2-3M54 62l5-8q1-3-2-3" fill="none" stroke="#3a2416" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M30 116V96M72 116V96" stroke="#4a2e1a" stroke-width="2"/>${win(36, 98, 6, 7, true, false)}${win(60, 98, 6, 7, true, false)}
      ${door(46, 116, 10, 15, '#3a2416')}${glow(51, 110, 12, 0.55)}
      ${[18, 86].map((x) => `<path d="M${x} 126v-12" stroke="#4a2e1a" stroke-width="1"/>${glow(x, 111, 9, 1)}<path d="M${x - 1.4} 113q1.4-5 2.8 0z" fill="#ffb347"/>`).join('')}
      ${person(36, 130, 1.1, '#5a7a44')}${person(66, 132, 1.15, '#8e2a2e')}
      ${pine(98, 132, 1.3, '#2f3f31', '#1f2b22')}`,

    // Royal Feast Hall: a castle hall at dusk, every window ablaze, banners and torches in the courtyard.
    red: () => `${defs(DUSK, '#c98c78')}${sky()}${stars([[14, 8, 0.5], [44, 12, 0.4], [90, 8, 0.5]])}${moon(80, 28)}
      ${far('M0 96Q50 86 100 94V110H0z', '#6a4a5a')}
      ${tower(14, 118, 12, 50, '#e6d6b6', '#7a3236', '#8e2a2e')}${tower(88, 118, 12, 54, '#e6d6b6', '#7a3236', '#8e2a2e')}
      ${building({ x: 20, y: 118, w: 62, h: 42, d: 0.1, lit: '#efe0c0', shade: '#c4a878', tex: 'stone' }, { kind: 'crenel' })}
      ${[25, 38, 51, 64].map((x) => win(x, 84, 7, 13, true)).join('')}${win(33, 104, 5, 8, true)}${win(64, 104, 5, 8, true)}
      ${banner(30, 100, 12, '#8e2a2e')}${banner(68, 100, 12, '#8e2a2e')}
      ${door(46, 118, 12, 16, '#4a2e1a')}${glow(52, 112, 14, 0.6)}
      ${land('M0 118Q50 114 100 118V140H0z', '#a8917a')}
      ${[24, 80].map((x) => `<path d="M${x} 132v-10" stroke="#3a2416" stroke-width="1"/>${glow(x, 120, 9, 1)}<path d="M${x - 1.4} 122q1.4-5 2.8 0z" fill="#ffb347"/>`).join('')}
      ${person(40, 132, 1.1, '#8e2a2e')}${person(60, 134, 1.15, '#c9a03a')}${person(66, 132, 1.05, '#3f5f96')}`,

    // Castle Keep: a fortress on its crag beneath the moon, lit windows, mist in the valley.
    black: () => `${defs(NIGHT, '#5d5577')}${sky()}${stars([[8, 8, 0.6], [26, 18, 0.4], [44, 6, 0.5], [66, 14, 0.4], [92, 10, 0.6], [80, 30, 0.4], [14, 40, 0.4]])}${moon(20, 32)}
      ${far('M0 104L18 90L36 98L60 84L84 96L100 90V120H0z', '#2c3450')}
      ${land('M0 120L14 100L30 104L44 92L70 90L84 100L100 96V140H0z', '#4a4a56', 'hatch')}
      ${tower(30, 96, 12, 34, '#cfc8bc', '#3e4250', '#8e2a2e')}${tower(84, 94, 12, 38, '#cfc8bc', '#3e4250', '#8e2a2e')}
      ${building({ x: 36, y: 96, w: 42, h: 22, d: 0.1, lit: '#c8c0b2', shade: '#8a8478', tex: 'stone' }, { kind: 'crenel' })}
      ${building({ x: 48, y: 76, w: 20, h: 32, d: 6, lit: '#d8d0c2', shade: '#8f887c', tex: 'stone' }, { kind: 'crenel' })}
      ${win(52, 54, 4, 7, true)}${win(61, 54, 4, 7, true)}${win(42, 82, 4, 7, true)}${win(70, 82, 4, 7, true)}${win(27.5, 76, 4, 7, true)}
      ${door(54, 96, 8, 10, '#1c1410')}
      <g fill="#c9c4d6" opacity=".35" filter="url(#blur)"><ellipse cx="20" cy="124" rx="30" ry="5"/><ellipse cx="80" cy="128" rx="34" ry="5"/></g>
      ${land('M0 130Q50 126 100 130V140H0z', '#3a3a46')}`,
  },
};

const cache = new Map<string, string>();

/** CSS `url(...)` for a card's illustration. */
export function sceneUrl(level: Level, color: Color): string {
  const key = `${level}-${color}`;
  let url = cache.get(key);
  if (!url) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
      <g filter="url(#wobble)">${SCENES[level][color]()}</g>
      <rect width="100" height="140" filter="url(#grain)"/>
      <rect width="100" height="140" fill="url(#vig)"/></svg>`;
    url = svgUrl(svg);
    cache.set(key, url);
  }
  return url;
}
