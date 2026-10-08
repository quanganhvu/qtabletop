import { useEffect, type CSSProperties } from 'react';
import type { Cause } from '../shared/game';
import { stingSound } from './sfx';

// A full-screen moment of horror when someone dies, shown behind the
// announcement: creeping ink, a burning sigil and crows for a curse, a swinging noose for the gallows,
// an arrow for the Hunter, a green mist and a skull for poison.

export function DeathFx({ cause, ms }: { cause: Cause; ms: number }) {
  useEffect(() => stingSound(cause), [cause]);
  const style = { '--fx-ms': `${ms}ms` } as CSSProperties;
  return (
    <div className={`death-fx ${cause}`} style={style} aria-hidden="true">
      <div className="fx-vignette" />
      {cause === 'curse' && <Curse />}
      {cause === 'lynch' && <Gallows />}
      {cause === 'hunter' && <Arrow />}
      {cause === 'poison' && <Poison />}
    </div>
  );
}

/** Ink creeps in from every edge, a violet sigil burns into the middle, and crows burst away. */
function Curse() {
  // An irregular ink blot, grown from a corner or an edge.
  const blot = (cx: number, cy: number, r: number, seed: number) => {
    const pts = Array.from({ length: 28 }, (_, i) => {
      const a = (i / 28) * Math.PI * 2;
      const wobble = 1 + 0.22 * Math.sin(a * 5 + seed) + 0.14 * Math.sin(a * 11 + seed * 2) + 0.08 * Math.sin(a * 17 + seed * 3);
      return `${(cx + Math.cos(a) * r * wobble).toFixed(1)} ${(cy + Math.sin(a) * r * wobble).toFixed(1)}`;
    });
    return `M${pts.join('L')}Z`;
  };
  const sigil = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    return `${(500 + Math.cos(a) * 150).toFixed(1)} ${(500 + Math.sin(a) * 150).toFixed(1)}`;
  });
  return (
    <>
      <svg className="fx-ink" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {[[0, 0, 330, 1], [1000, 0, 300, 2], [0, 1000, 320, 3], [1000, 1000, 340, 4], [500, -40, 220, 5], [-40, 520, 200, 6], [1040, 480, 210, 7], [500, 1040, 230, 8]].map(([x, y, r, seed], i) => (
          <path key={i} className="fx-blot" d={blot(x, y, r, seed)} style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${i * 90}ms` } as CSSProperties} />
        ))}
      </svg>
      <svg className="fx-sigil" viewBox="0 0 1000 1000">
        <circle cx="500" cy="500" r="190" />
        <circle cx="500" cy="500" r="160" />
        <path d={`M${sigil.join('L')}Z`} />
      </svg>
      <div className="fx-crows">
        {Array.from({ length: 9 }, (_, i) => (
          <svg key={i} className="fx-crow" viewBox="0 0 60 30" style={{ top: `${18 + ((i * 37) % 60)}%`, animationDelay: `${600 + i * 110}ms`, width: 34 + (i % 3) * 14 } as CSSProperties}>
            <path d="M30 18C24 8 12 4 2 8C12 10 20 14 26 22ZM30 18C36 8 48 4 58 8C48 10 40 14 34 22ZM26 20C28 17 32 17 34 20C33 24 27 24 26 20Z" />
          </svg>
        ))}
      </div>
    </>
  );
}

/** A gallows looms down out of the dark, its empty noose swinging. */
function Gallows() {
  return (
    <svg className="fx-gallows" viewBox="0 0 400 600" preserveAspectRatio="xMidYMin meet">
      <g fill="#0b0809" stroke="#2a1f14" strokeWidth="2">
        <rect x="70" y="20" width="22" height="580" />
        <rect x="60" y="20" width="250" height="20" />
        <path d="M92 90L150 40H170L92 118Z" />
      </g>
      <g className="fx-noose">
        <path d="M260 40V250" stroke="#6b5232" strokeWidth="6" fill="none" />
        <path d="M260 40V250" stroke="#2a1f14" strokeWidth="1.5" strokeDasharray="6 5" fill="none" />
        <ellipse cx="260" cy="290" rx="30" ry="42" fill="none" stroke="#6b5232" strokeWidth="7" />
        <rect x="248" y="236" width="24" height="30" rx="5" fill="#5a4428" stroke="#2a1f14" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** An arrow whips across the screen and thuds home. */
function Arrow() {
  return (
    <svg className="fx-arrow" viewBox="0 0 600 60" preserveAspectRatio="xMidYMid meet">
      <path d="M0 30H520" stroke="#6e431f" strokeWidth="6" />
      <path d="M560 30L515 12V48Z" fill="#c9cdd4" stroke="#2b2118" strokeWidth="2" />
      <path d="M0 30L-30 12M0 30L-30 48M18 30L-12 12M18 30L-12 48" stroke="#8e1f24" strokeWidth="6" strokeLinecap="round" transform="translate(40 0)" />
    </svg>
  );
}

/** A sickly mist rises and a skull fades out of it. */
function Poison() {
  return (
    <>
      <div className="fx-mist" />
      <svg className="fx-skull" viewBox="0 0 100 110">
        <path d="M50 6C26 6 12 22 12 44c0 13 6 22 14 28v14c0 4 3 7 7 7h34c4 0 7-3 7-7V72c8-6 14-15 14-28C88 22 74 6 50 6z" fill="#cfe8b0" stroke="#22451a" strokeWidth="3" />
        <ellipse cx="35" cy="48" rx="10" ry="12" fill="#22451a" />
        <ellipse cx="65" cy="48" rx="10" ry="12" fill="#22451a" />
        <path d="M50 60l-6 12h12z" fill="#22451a" />
        <path d="M36 82v10M44 82v10M52 82v10M60 82v10" stroke="#22451a" strokeWidth="3" />
      </svg>
    </>
  );
}
