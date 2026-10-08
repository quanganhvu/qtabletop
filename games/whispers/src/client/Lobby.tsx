import type { ClientMessage, RoomInfo } from '../shared/protocol';
import { MAX_PLAYERS, MIN_PLAYERS } from '../shared/protocol';
import { rolesFor, type Role } from '../shared/game';
import { ROLES } from '../shared/theme';
import { RoleEmblem } from './pieces';
import { useState } from 'react';
import type { Arms } from '../shared/heraldry';
import { ArmsPicker } from './ArmsPicker';
import { RuleBook } from './RuleBook';
import { UiIcon } from './UiIcon';
import { BOT_LEVELS, BOT_LEVEL_INFO } from '../shared/botLevels';
import { setArms } from './identity';
import { Crest } from './pieces';

export function Lobby({ room, you, send, leave, notify }: {
  room: RoomInfo;
  you: string | null;
  send: (msg: ClientMessage) => void;
  leave: () => void;
  notify: (msg: string) => void;
}) {
  const isHost = room.hostId === you;
  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  const enough = room.players.length >= MIN_PLAYERS;
  const [picking, setPicking] = useState(false);
  const [rules, setRules] = useState(false);
  const mine = room.players.find((p) => p.id === you);
  const changeArms = (arms: Arms) => {
    setArms(arms);
    send({ type: 'setArms', arms });
  };

  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => notify('Link copied'), () => notify('Copy failed: select the link manually'));
  };

  return (
    <div className="center">
      <div className="panel lobby">
        <div className="muted small">Room code</div>
        <div className="room-code">{room.code}</div>
        <div className="share">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="btn" onClick={copy}>Copy link</button>
        </div>

        <h2>Players <span className="muted">({room.players.length}/{MAX_PLAYERS})</span></h2>
        <ul className="lobby-players">
          {room.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'offline'}>
              {p.id === you
                ? <button className="crest-button small" onClick={() => setPicking(true)} title="Change your coat of arms"><Crest arms={p.arms} size={30} /></button>
                : <Crest arms={p.arms} size={30} />}
              <span className="lp-name">{p.name}{p.id === you && <span className="muted"> (you)</span>}</span>
              {p.id === room.hostId && <span className="tag">host</span>}
              {p.bot && <span className="tag muted" title={BOT_LEVEL_INFO[p.level ?? 'normal'].blurb}>bot · {BOT_LEVEL_INFO[p.level ?? 'normal'].rank}</span>}
              {!p.connected && <span className="tag muted">offline</span>}
              {isHost && p.id !== you && (
                <button className="btn tiny ghost" title={`Remove ${p.name}`} onClick={() => send({ type: 'removePlayer', playerId: p.id })}>✕</button>
              )}
            </li>
          ))}
        </ul>
        <RoleMix count={room.players.length} />
        {isHost && room.players.length < MAX_PLAYERS && (
          <div className="add-bot">
            <div className="add-bot-label"><UiIcon name="helm" />Add a bot</div>
            <div className="add-bot-levels">
              {BOT_LEVELS.map((level) => (
                <button key={level} className="btn" title={BOT_LEVEL_INFO[level].blurb} onClick={() => send({ type: 'addBot', level })}>
                  <span className="lvl-rank">{BOT_LEVEL_INFO[level].rank}</span>
                  <span className="lvl-label">{BOT_LEVEL_INFO[level].label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isHost ? (
          <button className="btn primary wide" disabled={!enough} onClick={() => send({ type: 'start' })}>
            {enough ? 'Start game' : `Need ${MIN_PLAYERS - room.players.length} more…`}
          </button>
        ) : (
          <p className="muted">Waiting for the host to start the game…</p>
        )}
        <button className="btn ghost wide" onClick={() => setRules(true)}><UiIcon name="book" />Rules</button>
        <button className="btn ghost wide" onClick={leave}>Leave room</button>
      </div>
      {rules && <RuleBook onClose={() => setRules(false)} />}
      {picking && mine && <ArmsPicker value={mine.arms} onChange={changeArms} onClose={() => setPicking(false)} />}
    </div>
  );
}

/** Which roles a table this size gets: everyone may know the mix, not who has what. */
function RoleMix({ count }: { count: number }) {
  if (count < MIN_PLAYERS) {
    return <p className="role-mix-note">Gather at least {MIN_PLAYERS} villagers (bots count) and the roles will be dealt in secret.</p>;
  }
  const mix = new Map<Role, number>();
  for (const r of rolesFor(Math.min(count, MAX_PLAYERS))) mix.set(r, (mix.get(r) ?? 0) + 1);
  return (
    <div className="role-mix" aria-label="Roles in this game">
      {[...mix].map(([role, n]) => (
        <span key={role} className={`role-chip ${role}`} title={ROLES[role].power}>
          <RoleEmblem role={role} size={26} />
          {n > 1 ? `${n} ${ROLES[role].name}s` : ROLES[role].name}
        </span>
      ))}
    </div>
  );
}
