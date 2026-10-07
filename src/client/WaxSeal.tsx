// A red wax seal stamped with the maker's initial: the author's signature on the front page.

function blob(cx: number, cy: number, r: number): string {
  // An irregular, slightly lumpy circle, like wax that spread when pressed.
  const points = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const wobble = 1 + 0.045 * Math.sin(a * 5 + 0.7) + 0.03 * Math.sin(a * 9 + 2.1) + 0.02 * Math.sin(a * 13);
    return [cx + Math.cos(a) * r * wobble, cy + Math.sin(a) * r * wobble];
  });
  return 'M' + points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z';
}

const BEADS = Array.from({ length: 28 }, (_, i) => {
  const a = (i / 28) * Math.PI * 2;
  return [50 + Math.cos(a) * 35.5, 50 + Math.sin(a) * 35.5];
});

export function WaxSeal({ letter = 'Q', title = 'Curated by Q' }: { letter?: string; title?: string }) {
  return (
    <svg className="wax-seal" viewBox="0 0 100 100" role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <radialGradient id="seal-wax" cx=".38" cy=".32" r=".75">
          <stop offset="0" stopColor="#d4404a" />
          <stop offset=".55" stopColor="#a11d27" />
          <stop offset="1" stopColor="#5e0b12" />
        </radialGradient>
        <radialGradient id="seal-well" cx=".45" cy=".42" r=".7">
          <stop offset="0" stopColor="#7c121b" />
          <stop offset="1" stopColor="#4e070d" />
        </radialGradient>
        <linearGradient id="seal-letter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f07a82" />
          <stop offset=".5" stopColor="#d33a45" />
          <stop offset="1" stopColor="#a51c27" />
        </linearGradient>
      </defs>
      <path d={blob(50, 51, 45)} fill="#3a0508" opacity=".35" transform="translate(1.5 2.5)" />
      <path d={blob(50, 50, 45)} fill="url(#seal-wax)" />
      <circle cx="50" cy="50" r="31" fill="url(#seal-well)" stroke="#5e0b12" strokeWidth="1.6" />
      <circle cx="50" cy="50" r="33" fill="none" stroke="#e05a63" strokeWidth=".9" opacity=".55" />
      {BEADS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.5" fill="#c9343e" stroke="#6e0f16" strokeWidth=".5" />)}
      <g fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize="50" textAnchor="middle">
        <text x="51.6" y="69.2" fill="#2a0306" opacity=".9">{letter}</text>
        <text x="49" y="66.4" fill="#ffc2c6" opacity=".7">{letter}</text>
        <text x="50" y="67.6" fill="url(#seal-letter)" stroke="#5e0b12" strokeWidth=".6">{letter}</text>
      </g>
      <ellipse cx="34" cy="24" rx="12" ry="5" fill="#fff" opacity=".22" transform="rotate(-28 34 24)" />
    </svg>
  );
}
