import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../shared/protocol';
import { FlagIcon, RocketArt } from './pieces';
import { FlagPicker } from './FlagPicker';
import { RuleBook } from './RuleBook';
import { UiIcon } from './UiIcon';
import { GAME_NAME, TAGLINE } from '../shared/theme';
import { getFlag, getName, randomRoomCode, setFlag, setName } from './identity';

export function Home({ connect, notify, busy }: {
  connect: (code: string, create: boolean) => void;
  notify: (msg: string) => void;
  busy: boolean;
}) {
  const [name, setNameInput] = useState(getName);
  const [flag, setFlagState] = useState(getFlag);
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
      <form className="panel home" onSubmit={(e) => { e.preventDefault(); go(!code); }}>
        <div className="home-planet" aria-hidden="true"><span className="home-rocket"><RocketArt kind="steel" /></span></div>
        <h1>{GAME_NAME}</h1>
        <p className="muted tagline">{TAGLINE}</p>
        <label htmlFor="name">Your name and corporation flag</label>
        <div className="identity-row">
          <button type="button" className="flag-button" onClick={() => setPicking(true)} title="Choose your corporation flag">
            <FlagIcon flag={flag} size={40} />
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
      {rules && <RuleBook onClose={() => setRules(false)} />}
      {picking && (
        <FlagPicker
          value={flag}
          onChange={(f) => { setFlag(f); setFlagState(f); }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
