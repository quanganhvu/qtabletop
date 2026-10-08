import type { Role } from '../../shared/game';
import { svgUrl } from './svg';

// Role emblems, the moon and the sun, drawn as small engraved, gilded
// illustrations on a 64×64 artboard, in the same hand as the other games.

const INK = '#2b2118';
const O = `stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"`;

const DRAWINGS: Record<Role | 'unknown', string> = {
  // A witch's tall black hat, its band fastened with a gold buckle, under a crescent.
  coven: `<defs><linearGradient id="hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3a5e"/><stop offset="1" stop-color="#140e1c"/></linearGradient></defs>
    <ellipse cx="32" cy="58" rx="26" ry="3.5" fill="#000" opacity=".25"/>
    <path d="M44 6A9 9 0 1 0 50 20A7 7 0 1 1 44 6Z" fill="#e8c66e" stroke="${INK}" stroke-width="1"/>
    <path d="M30 6C34 14 38 26 41 42H17C21 30 24 18 30 6Z" fill="url(#hat)" ${O}/>
    <path d="M30 6C27 8 25 11 26 14" fill="none" stroke="#6e5a86" stroke-width="1.2"/>
    <path d="M6 48C12 41 52 41 58 48C52 53 12 53 6 48Z" fill="url(#hat)" ${O}/>
    <path d="M18 40H40L41 46H17Z" fill="#6b2a7a" ${O}/>
    <rect x="25" y="39.5" width="8" height="7" rx="1" fill="none" stroke="#e8c66e" stroke-width="2"/>`,
  // A sheaf of wheat bound with a red cord: the honest folk of the village.
  villager: `<defs><linearGradient id="wheat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d58a"/><stop offset="1" stop-color="#b8892e"/></linearGradient></defs>
    <ellipse cx="32" cy="58" rx="18" ry="3.5" fill="#000" opacity=".25"/>
    <g fill="url(#wheat)" ${O}>
      <path d="M32 33L22 56H27L32 40L37 56H42Z"/>
      <ellipse cx="32" cy="14" rx="4" ry="10"/><ellipse cx="22" cy="18" rx="3.6" ry="9" transform="rotate(-24 22 18)"/>
      <ellipse cx="42" cy="18" rx="3.6" ry="9" transform="rotate(24 42 18)"/><ellipse cx="14" cy="25" rx="3.2" ry="8" transform="rotate(-44 14 25)"/>
      <ellipse cx="50" cy="25" rx="3.2" ry="8" transform="rotate(44 50 25)"/>
    </g>
    <path d="M32 24V34M23 26L30 34M41 26L34 34" stroke="${INK}" stroke-width="1.2"/>
    <rect x="25" y="33" width="14" height="5" rx="2" fill="#8e1f24" ${O}/>`,
  // The Witchfinder's lantern: a gilded lamp with a steady flame that sees through lies.
  seer: `<defs><linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0d58a"/><stop offset=".5" stop-color="#c9a03a"/><stop offset="1" stop-color="#7a5a1a"/></linearGradient>
      <radialGradient id="flame" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="#fff8d8"/><stop offset=".5" stop-color="#f6c64a"/><stop offset="1" stop-color="#e07a2a" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="32" cy="58" rx="16" ry="3.5" fill="#000" opacity=".25"/>
    <circle cx="32" cy="34" r="20" fill="url(#flame)" opacity=".35"/>
    <path d="M27 8A5 5 0 0 1 37 8" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M22 12H42L39 18H25Z" fill="url(#brass)" ${O}/>
    <rect x="22" y="18" width="20" height="28" rx="2" fill="#2a2018" opacity=".25" ${O}/>
    <path d="M32 26C36 31 36 36 32 40C28 36 28 31 32 26Z" fill="url(#flame)" stroke="#e07a2a" stroke-width="1"/>
    <path d="M22 18V46M42 18V46M32 18V24M32 42V46" stroke="${INK}" stroke-width="1.6"/>
    <path d="M20 46H44L42 54H22Z" fill="url(#brass)" ${O}/>`,
  // The Priest: a gilded cross with a soft halo, standing on an open prayer book.
  doctor: `<defs><linearGradient id="gilt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6e2a0"/><stop offset=".5" stop-color="#d4ad48"/><stop offset="1" stop-color="#8a6a20"/></linearGradient>
      <radialGradient id="halo"><stop offset=".3" stop-color="#fff6d0" stop-opacity=".55"/><stop offset="1" stop-color="#fff6d0" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="32" cy="58" rx="22" ry="3.5" fill="#000" opacity=".25"/>
    <circle cx="32" cy="22" r="20" fill="url(#halo)"/>
    <path d="M28.5 6H35.5V15H44V22H35.5V40H28.5V22H20V15H28.5Z" fill="url(#gilt)" ${O}/>
    <circle cx="32" cy="18.5" r="2.2" fill="#8e1f24" stroke="${INK}" stroke-width=".8"/>
    <path d="M8 44C16 40 26 41 32 45C38 41 48 40 56 44V54C48 50 38 51 32 55C26 51 16 50 8 54Z" fill="#efe6c8" ${O}/>
    <path d="M32 45V55" stroke="${INK}" stroke-width="1.2"/>
    <path d="M13 46.5C18 45 24 45.5 28 47.5M13 50C18 48.5 24 49 28 51M36 47.5C40 45.5 46 45 51 46.5M36 51C40 49 46 48.5 51 50" stroke="#8a7a5c" stroke-width=".9" fill="none"/>
    <path d="M44 41L46 53" stroke="#8e1f24" stroke-width="2" stroke-linecap="round"/>`,
  // The Wise Woman's stoppered potion, green and glowing, with a skull on its label.
  wisewoman: `<defs><linearGradient id="brew" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6e07a"/><stop offset=".55" stop-color="#4f8f2a"/><stop offset="1" stop-color="#22451a"/></linearGradient></defs>
    <ellipse cx="32" cy="58" rx="18" ry="3.5" fill="#000" opacity=".25"/>
    <path d="M26 8H38V20C47 23 52 31 52 39C52 50 43 56 32 56S12 50 12 39C12 31 17 23 26 20Z" fill="url(#brew)" ${O}/>
    <path d="M14 38C22 34 28 42 36 37C42 34 47 36 50 38" fill="none" stroke="#d8f0a8" stroke-width="1.4" opacity=".7"/>
    <rect x="24" y="4" width="16" height="7" rx="2" fill="#8a6a3a" ${O}/>
    <path d="M22 41H42V50H22Z" fill="#efe6c8" ${O} stroke-width="1"/>
    <circle cx="32" cy="44.5" r="2.6" fill="none" stroke="${INK}" stroke-width="1"/><path d="M30.5 47.5H33.5M29 50L35 47M35 50L29 47" stroke="${INK}" stroke-width=".9"/>
    <path d="M18 29A16 16 0 0 1 25 23" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>`,
  // A drawn longbow with an arrow nocked.
  hunter: `<defs><linearGradient id="yew" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c58a4a"/><stop offset="1" stop-color="#6e431f"/></linearGradient></defs>
    <ellipse cx="32" cy="58" rx="20" ry="3.5" fill="#000" opacity=".25"/>
    <path d="M18 6C40 14 40 46 18 54" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <path d="M18 6C40 14 40 46 18 54" fill="none" stroke="url(#yew)" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M18 6L12 30L18 54" fill="none" stroke="#efe6c8" stroke-width="1"/>
    <path d="M12 30H56" stroke="${INK}" stroke-width="2.4"/><path d="M12 30H56" stroke="#a8875a" stroke-width="1.2"/>
    <path d="M56 30L49 26V34Z" fill="#c9cdd4" ${O}/>
    <path d="M12 30L7 26M12 30L7 34M15 30L10 26M15 30L10 34" stroke="#8e1f24" stroke-width="2" stroke-linecap="round"/>`,
  // A face-down role card: a sealed crescent.
  unknown: `<ellipse cx="32" cy="58" rx="18" ry="3.5" fill="#000" opacity=".2"/>
    <circle cx="32" cy="30" r="20" fill="#2a2440" ${O}/>
    <path d="M38 16A15 15 0 1 0 38 44A12 12 0 1 1 38 16Z" fill="#e8c66e" ${O} stroke-width="1"/>
    <path d="M26 24h.01M22 34h.01M30 40h.01" stroke="#e8c66e" stroke-width="2" stroke-linecap="round"/>`,
};

const cache = new Map<string, string>();

/** CSS `url(...)` for a role emblem. */
export function roleArt(role: Role | null): string {
  const key = role ?? 'unknown';
  let url = cache.get(key);
  if (!url) {
    url = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${DRAWINGS[key]}</svg>`);
    cache.set(key, url);
  }
  return url;
}

/** The full moon over the village at night, and the sun by day. */
export const MOON = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><radialGradient id="m" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fffbe8"/><stop offset=".7" stop-color="#e8dcae"/><stop offset="1" stop-color="#b8a870"/></radialGradient>
  <radialGradient id="glow"><stop offset=".5" stop-color="#f6eec8" stop-opacity=".45"/><stop offset="1" stop-color="#f6eec8" stop-opacity="0"/></radialGradient></defs>
  <circle cx="32" cy="32" r="31" fill="url(#glow)"/>
  <circle cx="32" cy="32" r="19" fill="url(#m)"/>
  <g fill="#c9bb88" opacity=".6"><circle cx="26" cy="27" r="4"/><circle cx="38" cy="36" r="5"/><circle cx="36" cy="24" r="2.4"/><circle cx="27" cy="39" r="2"/></g>
</svg>`);

export const SUN = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><radialGradient id="s" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff3c0"/><stop offset=".6" stop-color="#f0c75a"/><stop offset="1" stop-color="#c98a2a"/></radialGradient></defs>
  <g stroke="#e8b04a" stroke-width="3" stroke-linecap="round">${Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<path d="M${(32 + Math.cos(a) * 22).toFixed(1)} ${(32 + Math.sin(a) * 22).toFixed(1)}L${(32 + Math.cos(a) * 29).toFixed(1)} ${(32 + Math.sin(a) * 29).toFixed(1)}"/>`;
  }).join('')}</g>
  <circle cx="32" cy="32" r="17" fill="url(#s)" stroke="#2b2118" stroke-width="1.5"/>
</svg>`);
