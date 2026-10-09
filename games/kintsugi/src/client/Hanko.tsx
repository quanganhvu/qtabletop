// A red hanko, the maker's seal: the author's signature on the front page,
// stamped in vermilion ink with the slightly broken edges of a real impression.

export function Hanko({ letter = 'Q', title = 'Curated by Q' }: { letter?: string; title?: string }) {
  return (
    <svg className="hanko" viewBox="0 0 100 100" role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        {/* Ink that didn't quite take: speckles and worn edges. */}
        <filter id="hanko-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.8" result="speckle" />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" result="inked" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" result="warp" />
          <feDisplacementMap in="inked" in2="warp" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#hanko-ink)" fill="#c23b22">
        {/* The square border, a thinner line inside it, and the letter. */}
        <path fillRule="evenodd" d="M8 10Q8 8 10 8H90Q92 8 92 10V90Q92 92 90 92H10Q8 92 8 90ZM15 15V85H85V15Z" />
        <path fillRule="evenodd" d="M19 19H81V81H19ZM21.5 21.5V78.5H78.5V21.5Z" />
        <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontFamily="'Yuji Syuku', 'Shippori Mincho', serif" fontSize="58" fontWeight="700">{letter}</text>
      </g>
    </svg>
  );
}
