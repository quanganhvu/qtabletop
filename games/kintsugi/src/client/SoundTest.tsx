import { breakSound, fanfare, roundSound, setSound, takeSound, turnChime } from './sfx';

// A panel for hearing every sound effect, shown only in the local preview at ?sounds.

const SOUNDS: [string, () => void][] = [
  ['Take panes', () => takeSound(3)],
  ['Set a pane', setSound],
  ['Broken glass', breakSound],
  ['Your turn', turnChime],
  ['Round over', roundSound],
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
