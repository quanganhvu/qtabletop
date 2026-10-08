import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../shared/protocol';
import { Crest } from './pieces';
import { ArmsPicker } from './ArmsPicker';
import { RuleBook } from './RuleBook';
import { UiIcon } from './UiIcon';
import { WaxSeal } from './WaxSeal';
import { GAME_NAME } from '../shared/theme';
import { getArms, getName, randomRoomCode, setArms, setName } from './identity';
import { hallUrl } from './hall';
import { SoundTest } from './SoundTest';

export function Home({ connect, notify, busy }: {
  connect: (code: string, create: boolean) => void;
  notify: (msg: string) => void;
  busy: boolean;
}) {
  const [name, setNameInput] = useState(getName);
  const [arms, setArmsState] = useState(getArms);
  const [picking, setPicking] = useState(false);
  const [rules, setRules] = useState(false);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');

  const go = (create: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return notify('Please enter your name');
    if (!create && !/^[A-Z]{4}$/.test(code)) return notify('Room codes are 4 letters');
    setName(trimmed);
    connect(create ? randomRoomCode() : code, create);
  };

  return (
    <div className="center">
      <a className="hall-link" href={hallUrl()}>← All games</a>
      {import.meta.env.DEV && location.search.includes('sounds') && <SoundTest />}
      <form className="panel home" onSubmit={(e) => { e.preventDefault(); go(!code); }}>
        <div className="home-crest"><img className="castle" src="/castle.svg" alt="" width={84} height={84} /></div>
        <h1>{GAME_NAME}</h1>
        <p className="muted tagline">Lay the land tile by tile. Raise cities, roads and abbeys. 2–5 players.</p>
        <label htmlFor="name">Your name and arms</label>
        <div className="identity-row">
          <button type="button" className="crest-button" onClick={() => setPicking(true)} title="Choose your coat of arms">
            <Crest arms={arms} size={40} />
            <span>Change</span>
          </button>
          <input
            id="name"
            autoFocus
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => setNameInput(e.target.value)}
          />
        </div>
        <button type="button" className="btn primary wide" disabled={busy} onClick={() => go(true)}>Create a room</button>
        <div className="or">or join a friend</div>
        <div className="join-row">
          <input
            maxLength={4}
            placeholder="CODE"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <button type="button" className="btn" disabled={busy} onClick={() => go(false)}>Join</button>
        </div>
        <button type="button" className="rules-link" onClick={() => setRules(true)}><UiIcon name="book" />Read the rules</button>
      </form>
      <div className="seal"><WaxSeal /></div>
      {rules && <RuleBook onClose={() => setRules(false)} />}
      {picking && (
        <ArmsPicker
          value={arms}
          onChange={(a) => { setArms(a); setArmsState(a); }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
