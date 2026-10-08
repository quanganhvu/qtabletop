import { bannerSound, fanfare, sparkleSound, tileSound, turnChime } from './sfx';

// A panel for hearing every sound effect, shown only in the local preview at ?sounds.

const SOUNDS: [string, () => void][] = [
  ['Lay a tile', tileSound],
  ['Plant a banner', bannerSound],
  ['Your turn', turnChime],
  ['Score', sparkleSound],
  ['Game over', fanfare],
];

export function SoundTest() {
  return (
    <div className="sound-test" role="group" aria-label="Sound test">
      <span>Sound test</span>
      {SOUNDS.map(([label, play]) => <button key={label} type="button" className="btn small" onClick={play}>{label}</button>)}
    </div>
  );
}
