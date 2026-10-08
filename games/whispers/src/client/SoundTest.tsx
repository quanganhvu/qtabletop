import { useState } from 'react';
import type { Cause } from '../shared/game';
import { DeathFx } from './DeathFx';
import { SeerVision } from './Game';
import { PRESET_ARMS } from '../shared/heraldry';
import { chatSound, chimeSound, dawnSound, deathSound, nightSound, villageWinSound, voteSound, covenWinSound } from './sfx';

// A panel for hearing every sound and seeing every death effect and vision, shown only in the local preview at ?sounds.

const SOUNDS: [string, () => void][] = [
  ['Night falls', nightSound],
  ['Dawn', dawnSound],
  ['A death', deathSound],
  ['Vote', voteSound],
  ['Your move', chimeSound],
  ['Chat', chatSound],
  ['Village wins', villageWinSound],
  ['Coven wins', covenWinSound],
];

const DEATHS: [string, Cause][] = [['Cursed', 'curse'], ['Hanged', 'lynch'], ['Shot', 'hunter'], ['Poisoned', 'poison']];

export function SoundTest() {
  const [fx, setFx] = useState<{ cause: Cause; key: number } | null>(null);
  const [vision, setVision] = useState<boolean | null>(null);
  const show = (cause: Cause) => {
    const key = Date.now();
    setFx({ cause, key });
    setTimeout(() => setFx((f) => (f?.key === key ? null : f)), 6000);
  };
  return (
    <>
      <div className="sound-test" role="group" aria-label="Sound test">
        <span>Sounds</span>
        {SOUNDS.map(([label, play]) => <button key={label} type="button" className="btn small" onClick={play}>{label}</button>)}
        <span>Deaths</span>
        {DEATHS.map(([label, cause]) => <button key={label} type="button" className="btn small" onClick={() => show(cause)}>{label}</button>)}
        <span>Seer</span>
        <button type="button" className="btn small" onClick={() => setVision(true)}>Finding: witch</button>
        <button type="button" className="btn small" onClick={() => setVision(false)}>Finding: innocent</button>
      </div>
      {vision !== null && <SeerVision name="Old Tobias" arms={PRESET_ARMS[0]} isWolf={vision} onClose={() => setVision(null)} />}
      {fx && <DeathFx key={fx.key} cause={fx.cause} ms={6000} />}
    </>
  );
}
