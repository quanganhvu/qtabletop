import type { CSSProperties } from 'react';
import type { TokenColor } from '../../shared/game';
import { RESOURCES } from '../../shared/theme';
import { svgUrl } from './svg';

// Small full-color illustrations of the six resources (64×64 artboard), rendered
// once each as data-URI images so gradient ids never collide on the page.

const INK = '#2b2118';
const O = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;

const DRAWINGS: Record<TokenColor, string> = {
  // Stone: one great dressed block, chisel-marked, with a little rubble
  white: `<defs>
      <linearGradient id="top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#faf6ec"/><stop offset="1" stop-color="#e2d8c2"/></linearGradient>
      <linearGradient id="front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ddd1b7"/><stop offset="1" stop-color="#b5a689"/></linearGradient>
      <linearGradient id="side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aa9a7c"/><stop offset="1" stop-color="#857659"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="57" rx="27" ry="4" fill="#000" opacity=".22"/>
    <path d="M8 24L21 13H56L43 24z" fill="url(#top)" ${O}/>
    <path d="M8 24H43V53H8z" fill="url(#front)" ${O}/>
    <path d="M43 24L56 13V42L43 53z" fill="url(#side)" ${O}/>
    <path d="M10 25.5H41.5M44.5 23.5L54.5 15" stroke="#fffaf0" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
    <g stroke="#8a7a5c" stroke-width="1" stroke-linecap="round" opacity=".75"><path d="M13 31l3 3M15 31l3 3M33 44l3 3M35 44l3 3M13 46l3-2M46 30l3 1M47 38l3 1"/></g>
    <path d="M22 35l4 6-3 4" fill="none" stroke="#7a6a50" stroke-width="1" stroke-linecap="round"/>
    <g fill="#9c8c6e" opacity=".55"><circle cx="30" cy="30" r=".9"/><circle cx="37" cy="36" r=".8"/><circle cx="18" cy="40" r=".8"/><circle cx="49" cy="26" r=".8"/><circle cx="51" cy="35" r=".8"/></g>
    <path d="M2 55l3-4 5 1 1 3z" fill="#c9bb9c" ${O}/><path d="M55 55l2-3 4 .5.5 2.5z" fill="#b5a689" ${O}/>`,
  // Cloth: an upright bolt of blue wool unspooling a length of cloth in soft waves
  blue: `<defs>
      <linearGradient id="roll" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7b9ad6"/><stop offset=".35" stop-color="#4469ae"/><stop offset="1" stop-color="#1c3262"/></linearGradient>
      <linearGradient id="drape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22396c"/><stop offset=".18" stop-color="#4a6cb2"/><stop offset=".4" stop-color="#2c4c8c"/><stop offset=".62" stop-color="#5677bb"/><stop offset=".84" stop-color="#2b4a88"/><stop offset="1" stop-color="#4466a8"/></linearGradient>
      <pattern id="weave" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V2" stroke="#ffffff" stroke-width=".35" opacity=".2"/></pattern>
    </defs>
    <ellipse cx="34" cy="57" rx="27" ry="3.6" fill="#000" opacity=".22"/>
    <path d="M24 16C33 11 40 20 48 16S58 11 62 15V45C57 41 52 47 45 46S33 41 24 47z" fill="url(#drape)" ${O}/>
    <path d="M24 16C33 11 40 20 48 16S58 11 62 15V45C57 41 52 47 45 46S33 41 24 47z" fill="url(#weave)"/>
    <path d="M24 19.5C33 14.5 40 23.5 48 19.5S58 14.5 62 18.5M24 43.5C33 37.5 40 43.5 45 42.5S57 37.5 62 41.5" fill="none" stroke="#d9b24a" stroke-width="1.8"/>
    <path d="M24 19.5C33 14.5 40 23.5 48 19.5S58 14.5 62 18.5M24 43.5C33 37.5 40 43.5 45 42.5S57 37.5 62 41.5" fill="none" stroke="${INK}" stroke-width=".45" stroke-dasharray="1.3 1.3"/>
    <path d="M62 15V45" stroke="${INK}" stroke-width="1.6"/>
    <path d="M6 12h20v38a10 4 0 0 1-20 0z" fill="url(#roll)" ${O}/>
    <path d="M6 12h20v38a10 4 0 0 1-20 0z" fill="url(#weave)"/>
    <path d="M6 18a10 4 0 0 0 20 0M6 44a10 4 0 0 0 20 0" fill="none" stroke="#d9b24a" stroke-width="1.3"/>
    <path d="M10 22v20" stroke="#fff" stroke-width="1.8" opacity=".35" stroke-linecap="round"/>
    <ellipse cx="16" cy="12" rx="10" ry="4" fill="#3a5c9e" ${O}/>
    <path d="M16 12c1.4 0 1.6 1.2.4 1.6-1.8.6-4-.4-3.6-1.8.6-2 4.4-2.4 6.6-1 2.4 1.6 1.2 4.4-2.6 4.6-4.2.2-7.6-1.8-6.4-4.4" fill="none" stroke="#9db4e4" stroke-width=".9" stroke-linecap="round"/>`,
  // Timber: three logs with bark and growth rings, and a sprig of leaves
  green: `<defs>
      <radialGradient id="end" cx=".4" cy=".35"><stop offset="0" stop-color="#f3d9a4"/><stop offset=".7" stop-color="#d9b072"/><stop offset="1" stop-color="#b98a4e"/></radialGradient>
      <linearGradient id="bark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8c5f3a"/><stop offset="1" stop-color="#5a3a22"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="56" rx="27" ry="4" fill="#000" opacity=".22"/>
    ${[[18, 42], [44, 42], [31, 22]].map(([x, y]) => `
      <path d="M${x} ${y - 10}h14a10 10 0 0 1 0 20H${x}z" fill="url(#bark)" ${O}/>
      <path d="M${x + 5} ${y - 7}h9M${x + 6} ${y + 6}h10" stroke="#3b2414" stroke-width="1" opacity=".7"/>
      <circle cx="${x}" cy="${y}" r="10" fill="url(#end)" ${O}/>
      <circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="#a7783f" stroke-width="1"/><circle cx="${x}" cy="${y}" r="3.2" fill="none" stroke="#a7783f" stroke-width="1"/><circle cx="${x}" cy="${y}" r=".9" fill="#8a5f2f"/>`).join('')}
    <path d="M50 14c6-6 11-5 12-2-4 4-9 5-12 2zM50 14c-1-7 2-11 5-11 1 5-2 9-5 11z" fill="#5f8f45" ${O}/><path d="M50 14l-4 6" ${O}/>`,
  // Wine: a glass goblet of red wine
  red: `<defs>
      <linearGradient id="wine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5e0f1c"/><stop offset=".35" stop-color="#a8283e"/><stop offset="1" stop-color="#4d0b17"/></linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".5" stop-color="#e6eef2" stop-opacity=".18"/><stop offset="1" stop-color="#c8d4da" stop-opacity=".4"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="58" rx="18" ry="3.2" fill="#000" opacity=".22"/>
    <path d="M16 5h32c0 20-7 29-16 29S16 25 16 5z" fill="url(#glass)" ${O}/>
    <path d="M17.6 13h28.8c-1.2 10.6-6.4 16.4-14.4 16.4S18.8 23.6 17.6 13z" fill="url(#wine)"/>
    <ellipse cx="32" cy="13" rx="14.4" ry="1.8" fill="#c43a52" opacity=".9"/>
    <path d="M20.5 9c0 8 2.5 15 7 18" stroke="#fff" stroke-width="2" opacity=".75" fill="none" stroke-linecap="round"/>
    <path d="M32 34v13" stroke="${INK}" stroke-width="1.6"/><path d="M30.6 34v13" stroke="#fff" stroke-width=".8" opacity=".6"/>
    <path d="M19 56c2-6 7-9 13-9s11 3 13 9z" fill="url(#glass)" ${O}/>`,
  // Iron: a smith's anvil
  black: `<defs>
      <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4b9be"/><stop offset=".22" stop-color="#6a7076"/><stop offset="1" stop-color="#2a2d31"/></linearGradient>
      <linearGradient id="face" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6e9ec"/><stop offset="1" stop-color="#a9afb5"/></linearGradient>
    </defs>
    <ellipse cx="34" cy="57" rx="24" ry="3.6" fill="#000" opacity=".25"/>
    <path d="M4 20h36c1 7 8 10 20 10v5H44v8c0 3 2 5 6 6v7H16v-7c4-1 6-3 6-6v-8h-6C9 35 4 28 4 20z" fill="url(#steel)" ${O}/>
    <path d="M5 20h35" stroke="url(#face)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M41 23c2 4 8 6 17 6.5" stroke="#d6dadd" stroke-width="1.1" fill="none" opacity=".7" stroke-linecap="round"/>
    <rect x="31" y="21.5" width="3" height="3" fill="#1e2024"/>
    <path d="M22 45h22" stroke="#1e2024" stroke-width="1" opacity=".6"/>`,
  // Gold: a jeweled crown with a velvet cap
  gold: `<defs>
      <linearGradient id="au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".35" stop-color="#e6bd4e"/><stop offset="1" stop-color="#9a6f1c"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="57" rx="25" ry="3.5" fill="#000" opacity=".22"/>
    <path d="M16 34c0-12 7-18 16-18s16 6 16 18z" fill="#8e1f24" ${O}/>
    <path d="M10 46L6 18l14 12 12-19 12 19 14-12-4 28z" fill="url(#au)" ${O}/>
    <rect x="9" y="44" width="46" height="9" rx="2" fill="url(#au)" ${O}/>
    <circle cx="6" cy="17" r="3" fill="#f6efe2" ${O}/><circle cx="32" cy="10" r="3.2" fill="#f6efe2" ${O}/><circle cx="58" cy="17" r="3" fill="#f6efe2" ${O}/>
    <circle cx="20" cy="48.5" r="2.6" fill="#b3263a" ${O}/><path d="M29 46l3-2 3 2-3 5z" fill="#2f63b8" ${O}/><circle cx="44" cy="48.5" r="2.6" fill="#2f8a52" ${O}/>
    <path d="M14 22l3 20M30 18l1 22" stroke="#fff6cc" stroke-width="1.4" opacity=".6" stroke-linecap="round"/>`,
};

const cache = new Map<TokenColor, string>();

export function iconUrl(color: TokenColor): string {
  let url = cache.get(color);
  if (!url) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${DRAWINGS[color]}</svg>`;
    url = svgUrl(svg);
    cache.set(color, url);
  }
  return url;
}

export function ResourceIcon({ color, className }: { color: TokenColor; className?: string }) {
  return (
    <span
      className={`res-icon ${className ?? ''}`}
      role="img"
      aria-label={RESOURCES[color].name}
      style={{ backgroundImage: iconUrl(color) } as CSSProperties}
    />
  );
}
