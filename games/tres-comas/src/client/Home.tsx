import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../shared/protocol';
import { GAME_NAME } from '../shared/theme';
import { RuleBook } from './RuleBook';
import { getName, randomRoomCode, setName } from './identity';

export function Home({ connect, notify, busy }: {
  connect: (code: string, create: boolean) => void;
  notify: (msg: string) => void;
  busy: boolean;
}) {
  const [name, setNameInput] = useState(getName);
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
        <img className="home-emblem" src="/tres-comas.svg" alt="" width={110} height={110} />
        <h1>{GAME_NAME}</h1>
        <p className="muted tagline">Found Pied Piper, Hooli and friends, grow them block by block, and cash in when big tech buys them out. 2–6 players.</p>
        <label htmlFor="name">Your name</label>
        <input
          id="name"
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          placeholder="e.g. Alex"
          value={name}
          onChange={(e) => setNameInput(e.target.value)}
        />
        <button type="button" className="btn primary wide" disabled={busy} onClick={() => go(true)}>Create a room</button>
        <div className="or">or join a friend</div>
        <div className="join-row">
          <input
            maxLength={4}
            placeholder="CODE"
            aria-label="Room code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <button type="button" className="btn" disabled={busy} onClick={() => go(false)}>Join</button>
        </div>
        <button type="button" className="rules-link" onClick={() => setRules(true)}>Read the rules</button>
      </form>
      {rules && <RuleBook onClose={() => setRules(false)} />}
    </div>
  );
}
