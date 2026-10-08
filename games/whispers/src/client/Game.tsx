import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Action, GameView, PlayerView } from '../shared/game';
import type { ClientMessage, RoomInfo } from '../shared/protocol';
import { PRESET_ARMS, type Arms } from '../shared/heraldry';
import { GAME_NAME, ROLES, TEAM_NAMES, VILLAGE } from '../shared/theme';
import { BOT_LEVEL_INFO } from '../shared/botLevels';
import { Announcer, useAnnouncements } from './Announcer';
import { Chat } from './Chat';
import { RuleBook } from './RuleBook';
import { UiIcon } from './UiIcon';
import { MOON, SUN } from './art/roles';
import { Crest, RoleEmblem, cx } from './pieces';
import { chimeSound, isMuted, setMuted, voteSound } from './sfx';

/** The current time, ticking twice a second, for countdowns. */
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return now;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function Game({ room, game, you, act, send, leave }: {
  room: RoomInfo;
  game: GameView;
  you: string | null;
  act: (action: Action) => void;
  send: (msg: ClientMessage) => void;
  leave: () => void;
  notify: (msg: string) => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [muted, setMutedState] = useState(isMuted);
  /** A choice waiting for confirmation (the Witchfinder, the Priest, the Hunter, the Wise Woman's poison). */
  const [chosen, setChosen] = useState<string | null>(null);
  const [heal, setHeal] = useState(false);
  // The role reveal shows once per game (it survives a page refresh), and again on request.
  const revealKey = `moonfall.revealed.${room.code}.${game.players.map((p) => p.id).join('')}`;
  const [revealing, setRevealing] = useState(() => {
    try { return !!game.myRole && game.phase !== 'over' && !sessionStorage.getItem(revealKey); } catch { return true; }
  });
  const closeReveal = () => {
    setRevealing(false);
    try { sessionStorage.setItem(revealKey, '1'); } catch { /* private mode: it just shows again next time */ }
  };
  const now = useNow();
  const announcement = useAnnouncements(game);

  // When the Seer has a new vision, show it on a card until they dismiss it.
  const [vision, setVision] = useState<string | null>(null);
  const seenVisions = useRef(Object.keys(game.visions).length);
  useEffect(() => {
    const ids = Object.keys(game.visions);
    if (ids.length > seenVisions.current) setVision(ids[ids.length - 1]);
    seenVisions.current = ids.length;
  }, [game.visions]);

  const me = game.players.find((p) => p.id === you) ?? null;
  const isHost = room.hostId === you;
  const seat = (id: string) => room.players.find((p) => p.id === id);
  const armsOf = (id: string): Arms => seat(id)?.arms ?? PRESET_ARMS[0];
  const awaited = !!you && game.waitingOn.includes(you);
  const night = game.phase === 'night' || game.phase === 'brew';

  // A fresh phase forgets any half-made choice.
  const phaseKey = `${game.day}:${game.phase}`;
  useEffect(() => {
    setChosen(null);
    setHeal(false);
  }, [phaseKey]);

  // A soft chime when the game needs you.
  const wasAwaited = useRef(false);
  useEffect(() => {
    if (awaited && !wasAwaited.current && game.phase !== 'day') chimeSound();
    wasAwaited.current = awaited;
  }, [awaited, game.phase]);

  useEffect(() => {
    document.title = awaited ? `● Your move · ${GAME_NAME}` : GAME_NAME;
  }, [awaited]);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };
  const leaveGame = () => {
    const sure = !me || game.phase === 'over' || confirm('Leave the game? A bot will take over your seat so the others can finish.');
    if (sure) leave();
  };

  // ---- What clicking a villager does right now ----
  const target = targetMode(game, me, chosen);
  const onPick = (p: PlayerView) => {
    if (!target || !target.can(p)) return;
    if (target.instant) {
      voteSound();
      act(target.instant(p));
    } else {
      setChosen(chosen === p.id ? null : p.id);
    }
  };

  const voteCounts = new Map<string, number>();
  for (const t of Object.values(game.votes)) if (t !== 'skip') voteCounts.set(t, (voteCounts.get(t) ?? 0) + 1);
  const remaining = game.deadline ? game.deadline - now : null;

  return (
    <div className={cx('game', night ? 'is-night' : 'is-day', game.phase === 'over' && 'is-over')}>
      <header className="topbar">
        <div className="brand"><img className="emblem" src="/emblem.svg" alt="" width={30} height={30} /> <span>{GAME_NAME}</span> <span className="room-tag">{room.code}</span></div>
        <div key={game.log.length} className="ticker">{game.log.at(-1)}</div>
        <div className="status">
          <span className={cx('pill', 'phase-pill', night && 'night')}>
            {game.phase === 'over' ? 'Game over' : night ? `Night ${game.day}` : game.phase === 'hunter' ? 'The Hunter' : `Day ${game.day}`}
            {remaining !== null && game.phase !== 'over' && <span className={cx('clock', remaining < 10_000 && 'urgent')}>{clock(remaining)}</span>}
          </span>
          {awaited && <span className="pill turn">Your move</span>}
        </div>
        <button className="btn ghost small" onClick={toggleMute} title={muted ? 'Sound is off' : 'Sound is on'} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}><UiIcon name={muted ? 'bellOff' : 'bell'} /></button>
        <button className="btn ghost small" onClick={() => setRulesOpen(true)} title="Rules" aria-label="Rules"><UiIcon name="book" /><span className="btn-label">Rules</span></button>
        <button className="btn ghost small" onClick={() => setLogOpen(!logOpen)} title="What has happened" aria-label="Log"><UiIcon name="scroll" /><span className="btn-label">Log</span></button>
        {isHost && game.phase !== 'over' && (
          <button className="btn ghost small" title="Stop this game and return everyone to the lobby" onClick={() => confirm('End this game for everyone?') && send({ type: 'endGame' })} aria-label="End game"><UiIcon name="swords" /><span className="btn-label">End game</span></button>
        )}
        <button className="btn ghost small" onClick={leaveGame} title="Leave the village" aria-label="Leave"><UiIcon name="door" /><span className="btn-label">Leave</span></button>
      </header>

      <div className="arena">
        <aside className="side">
          {me ? <RoleCard player={me} onOpen={() => setRevealing(true)} /> : <div className="role-card spectator"><p>You are watching. If a player has left, you can take their seat.</p></div>}
          <Journal notes={game.notes} />
        </aside>

        <main className="square">
          <div className="sky" style={{ backgroundImage: night ? MOON : SUN }} aria-hidden="true" />
          <Prompt
            game={game}
            me={me}
            isHost={isHost}
            chosen={chosen}
            heal={heal}
            setHeal={setHeal}
            confirm={(a) => { act(a); setChosen(null); chimeSound(); }}
            send={send}
          />
          <ul className={cx('villagers', target && 'selecting')}>
            {game.players.map((p) => {
              const pickable = !!target && target.can(p);
              const myVote = game.phase === 'day' && you ? game.votes[you] === p.id : false;
              const packPicks = game.covenVotes ? Object.entries(game.covenVotes).filter(([, t]) => t === p.id).map(([w]) => w) : [];
              const offline = !seat(p.id)?.connected;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={cx('villager', !p.alive && 'dead', p.id === you && 'me', pickable && 'pickable',
                      (chosen === p.id || myVote || (game.myPick === p.id && game.phase === 'night')) && 'chosen',
                      game.hunter === p.id && 'aiming', game.phase === 'day' && game.waitingOn.includes(p.id) && 'undecided')}
                    onClick={() => onPick(p)}
                    disabled={!pickable}
                    aria-label={`${p.name}${p.alive ? '' : ', dead'}`}
                  >
                    {/* The dead show their revealed role in place of their arms. */}
                    {!p.alive && p.role
                      ? <span className="v-grave"><RoleEmblem role={p.role} size={46} /></span>
                      : <span className="v-crest"><Crest arms={armsOf(p.id)} size={38} /></span>}
                    <span className="v-name">{p.name}{p.id === you && <small> (you)</small>}</span>
                    <span className="v-status">
                      {!p.alive ? <>{p.death?.cause === 'lynch' ? 'Hanged' : p.death?.cause === 'hunter' ? 'Shot' : p.death?.cause === 'poison' ? 'Poisoned' : 'Cursed'} · day {p.death?.day}</>
                        : seat(p.id)?.bot ? <span className="tag muted">{seat(p.id)?.left ? 'left · bot' : BOT_LEVEL_INFO.normal.rank.toLowerCase() + ' bot'}</span>
                        : offline ? <span className="tag muted">away</span> : null}
                    </span>
                    {!p.alive && p.role && <span className={cx('v-revealed', p.role === 'coven' && 'wolf')}>{ROLES[p.role].name}</span>}
                    {p.alive && p.role && <span className="v-role"><RoleEmblem role={p.role} size={26} /></span>}
                    {(voteCounts.get(p.id) ?? 0) > 0 && <span className="v-votes" title="Votes against">{voteCounts.get(p.id)}</span>}
                    {packPicks.length > 0 && <span className="v-prey" title={`Chosen by ${packPicks.map((w) => game.players.find((x) => x.id === w)?.name).join(', ')}`}>{packPicks.length}</span>}
                    {game.phase === 'day' && p.alive && !game.waitingOn.includes(p.id) && <span className="v-voted" title="Has voted">✓</span>}
                    {p.id in game.visions && (
                      <span className={cx('v-vision', game.visions[p.id] ? 'wolf' : 'good')} title="What you learned as the Witchfinder">
                        {game.visions[p.id] ? 'Witch!' : 'Innocent'}
                      </span>
                    )}
                  </button>
                  {!me && (offline || seat(p.id)?.left) && p.alive && (
                    <button className="btn tiny take-seat" onClick={() => send({ type: 'claimSeat', seatId: p.id })}>Take seat</button>
                  )}
                </li>
              );
            })}
          </ul>
          <Announcer item={announcement} game={game} />
        </main>

        <Chat game={game} room={room} send={(channel, text) => act({ type: 'chat', channel, text })} />
      </div>

      {revealing && me?.role && <RoleReveal player={me} notes={game.notes} onClose={closeReveal} />}
      {vision && !revealing && (
        <SeerVision
          name={game.players.find((p) => p.id === vision)?.name ?? ''}
          arms={armsOf(vision)}
          isWolf={!!game.visions[vision]}
          onClose={() => setVision(null)}
        />
      )}
      {rulesOpen && <RuleBook onClose={() => setRulesOpen(false)} />}
      {logOpen && <LogDrawer entries={game.log} onClose={() => setLogOpen(false)} />}
      {game.phase === 'over' && showResults && !announcement && (
        <Results game={game} isHost={isHost} armsOf={armsOf} onLobby={() => send({ type: 'backToLobby' })} onHide={() => setShowResults(false)} />
      )}
    </div>
  );
}

/** How a click on a villager is used in the current moment, if at all. */
function targetMode(game: GameView, me: PlayerView | null, chosen: string | null) {
  if (!me || !game.you) return null;
  const others = (p: PlayerView) => p.alive && p.id !== me.id;
  const role = game.myRole;
  if (game.phase === 'night' && me.alive) {
    if (role === 'coven') return { can: (p: PlayerView) => p.alive && p.role !== 'coven', instant: (p: PlayerView): Action => ({ type: 'night', target: p.id }) };
    if (role === 'seer' && !game.myPick) return { can: others };
    if (role === 'doctor' && !game.myPick) return { can: (p: PlayerView) => p.alive && p.id !== game.lastProtected };
  }
  if (game.phase === 'brew' && role === 'wisewoman' && game.wise && !game.wise.done && game.wise.poison && me.alive) return { can: others };
  if (game.phase === 'day' && me.alive) return { can: others, instant: (p: PlayerView): Action => ({ type: 'vote', target: p.id }) };
  if (game.phase === 'hunter' && game.hunter === me.id) return { can: others };
  void chosen;
  return null;
}

/** What to do right now, with the buttons to do it. */
function Prompt({ game, me, isHost, chosen, heal, setHeal, confirm, send }: {
  game: GameView;
  me: PlayerView | null;
  isHost: boolean;
  chosen: string | null;
  heal: boolean;
  setHeal: (v: boolean) => void;
  confirm: (a: Action) => void;
  send: (msg: ClientMessage) => void;
}) {
  const name = (id: string | null) => game.players.find((p) => p.id === id)?.name ?? '';
  const role = game.myRole;
  const alive = !!me?.alive;
  let title: string;
  let text: React.ReactNode;
  let buttons: React.ReactNode = null;
  /** Numbered steps for this moment; the first one not done is the current one. */
  let steps: { text: React.ReactNode; done: boolean }[] = [];
  const packSize = game.players.filter((p) => p.alive && p.role === 'coven').length; // the living coven

  if (game.phase === 'over') {
    title = game.winner === 'village' ? 'The village is saved' : 'The coven has won';
    text = 'Every role is revealed below.';
  } else if (!me) {
    title = 'You are watching';
    text = 'Roles are hidden from spectators until they are revealed.';
  } else if (!alive && game.hunter !== me.id) {
    title = 'You are dead';
    text = 'You can watch the village and read the chat, but not speak or vote.';
  } else if (game.phase === 'night') {
    title = `Night ${game.day}`;
    if (role === 'coven') {
      text = game.myPick ? <>You whisper a curse on <b>{name(game.myPick)}</b>.</> : 'The coven gathers in the dark.';
      steps = [
        { text: 'Click a villager to choose who to curse (you can change it)', done: !!game.myPick },
        ...(packSize > 1 ? [{ text: 'Agree on one victim in the Coven chat; the most-chosen one dies', done: Object.keys(game.covenVotes ?? {}).length >= packSize && new Set(Object.values(game.covenVotes ?? {})).size === 1 }] : []),
        { text: 'Wait for dawn', done: false },
      ];
    } else if (role === 'seer') {
      text = game.myPick ? <>You questioned <b>{name(game.myPick)}</b>. See your journal.</> : chosen ? <>Question <b>{name(chosen)}</b> tonight?</> : 'Who will you question tonight?';
      steps = [
        { text: 'Click a player', done: !!chosen || !!game.myPick },
        { text: 'Press Question', done: !!game.myPick },
        { text: 'Read the answer on the card and in your journal (left)', done: false },
      ];
      if (!game.myPick && chosen) buttons = <button className="btn primary" onClick={() => confirm({ type: 'night', target: chosen })}>Question</button>;
    } else if (role === 'doctor') {
      text = game.myPick ? <>You pray over <b>{name(game.myPick)}</b> tonight.</> : chosen ? <>Bless <b>{name(chosen)}</b> tonight?</> : <>Who will you bless tonight{game.lastProtected ? <> (not {name(game.lastProtected)} again)</> : null}?</>;
      steps = [
        { text: 'Click a player (you may choose yourself)', done: !!chosen || !!game.myPick },
        { text: 'Press Bless', done: !!game.myPick },
        { text: 'Wait for dawn', done: false },
      ];
      if (!game.myPick && chosen) buttons = <button className="btn primary" onClick={() => confirm({ type: 'night', target: chosen })}>Bless</button>;
    } else {
      text = 'You bar your door and sleep. Something whispers outside…';
      steps = [{ text: 'Nothing to do tonight. Dawn comes once the others have acted, or when the timer runs out.', done: false }];
    }
  } else if (game.phase === 'brew') {
    title = `Night ${game.day}`;
    if (role === 'wisewoman' && game.wise && !game.wise.done) {
      const v = game.wise.victim;
      text = (
        <>
          {v ? <>The coven has cursed <b>{name(v)}</b>. </> : 'The coven cursed no one tonight. '}
          {game.wise.poison ? (chosen ? <>Poison <b>{name(chosen)}</b>?</> : 'Choose someone to poison, or let them be.') : 'Your poison is spent.'}
        </>
      );
      buttons = (
        <>
          {v && game.wise.heal && (
            <label className="check"><input type="checkbox" checked={heal} onChange={(e) => setHeal(e.target.checked)} /> Cure {name(v)}</label>
          )}
          <button className="btn primary" onClick={() => confirm({ type: 'brew', heal, poison: chosen })}>
            {heal || chosen ? 'Brew it' : 'Do nothing'}
          </button>
        </>
      );
      steps = [
        ...(v && game.wise.heal ? [{ text: <>Tick <b>Cure</b> to save {name(v)} (once per game)</>, done: heal }] : []),
        ...(game.wise.poison ? [{ text: 'If you wish, click someone to poison (once per game)', done: !!chosen }] : []),
        { text: <>Press <b>{heal || chosen ? 'Brew it' : 'Do nothing'}</b></>, done: false },
      ];
    } else {
      text = 'Somewhere a cauldron bubbles. Dawn is close.';
      steps = [{ text: 'Nothing to do. Dawn comes in a moment.', done: false }];
    }
  } else if (game.phase === 'hunter') {
    title = 'The Hunter';
    if (game.hunter === me.id) {
      text = chosen ? <>Loose your last arrow at <b>{name(chosen)}</b>?</> : 'You are dying. Choose who falls with you.';
      steps = [
        { text: 'Click a player', done: !!chosen },
        { text: 'Press Shoot before the timer runs out', done: false },
      ];
      if (chosen) buttons = <button className="btn primary" onClick={() => confirm({ type: 'shoot', target: chosen })}>Shoot</button>;
    } else {
      text = <><b>{name(game.hunter)}</b> raises a bow with their last strength…</>;
      steps = [{ text: 'Nothing to do. Wait while the Hunter takes their last shot (30 seconds at most).', done: false }];
    }
  } else {
    title = `Day ${game.day}`;
    const mine = game.you ? game.votes[game.you] : undefined;
    text = mine && mine !== 'skip'
      ? <>You vote to hang <b>{name(mine)}</b>. You may change it until the vote closes.</>
      : mine === 'skip' ? 'You abstain today.' : `Who should ${VILLAGE} hang?`;
    steps = [
      { text: 'Talk it over in the Village chat (right)', done: game.chat.some((m) => m.from === game.you && m.channel === 'day') },
      { text: 'Click a player to vote for them, or press Abstain. You can change your vote', done: !!mine },
      { text: 'The vote closes when everyone has voted or time runs out. A tie hangs no one', done: false },
    ];
    buttons = (
      <>
        <button className={cx('btn', mine === 'skip' && 'on')} onClick={() => confirm({ type: 'vote', target: 'skip' })}>Abstain</button>
        {isHost && <button className="btn ghost" onClick={() => window.confirm('Close the vote now and count it?') && send({ type: 'closeVote' })}>Close the vote</button>}
      </>
    );
  }

  return (
    <div className="prompt-box">
      <h2>{title}</h2>
      <p>{text}</p>
      {steps.length > 0 && (
        <ol className="steps">
          {steps.map((st, i) => {
            const current = !st.done && steps.slice(0, i).every((x) => x.done);
            return <li key={i} className={cx(st.done && 'done', current && 'current')}>{st.text}</li>;
          })}
        </ol>
      )}
      {buttons && <div className="prompt-buttons">{buttons}</div>}
    </div>
  );
}

/** Your secret: the role, your side, and your power. */
function RoleCard({ player, onOpen }: { player: PlayerView; onOpen: () => void }) {
  const role = player.role;
  if (!role) return null;
  const info = ROLES[role];
  return (
    <button type="button" className={cx('role-card', info.team, !player.alive && 'dead')} onClick={onOpen} title="How to play your role">
      <div className="rc-kicker">Your role{player.alive ? '' : ' (dead)'}</div>
      <RoleEmblem role={role} size={96} />
      <h3>{info.name}</h3>
      <div className="rc-team">Fights for {TEAM_NAMES[info.team]}</div>
      <p>{info.power}</p>
      <span className="rc-more">How to play this role</span>
    </button>
  );
}

/** What the Witchfinder learned: a card that stays until dismissed. */
export function SeerVision({ name, arms, isWolf, onClose }: { name: string; arms: Arms; isWolf: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay vision-overlay" onClick={onClose}>
      <div className={cx('vision-card', isWolf ? 'wolf' : 'good')} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your finding">
        <div className="rc-kicker">Your questioning</div>
        <div className="vision-orb"><RoleEmblem role="seer" size={70} /></div>
        <div className="vision-who"><Crest arms={arms} size={44} /><b>{name}</b></div>
        <div className="vision-verdict">
          <RoleEmblem role={isWolf ? 'coven' : 'villager'} size={64} />
          <span>{isWolf ? 'IS A WITCH' : 'is not a witch'}</span>
        </div>
        <p>{isWolf ? 'Warn the village, but carefully: the coven will curse you if they learn who you are.' : 'You can trust them. It is noted in your journal and on their tile.'}</p>
        <button className="btn primary" onClick={onClose} autoFocus>Remember it</button>
      </div>
    </div>
  );
}

/** The big moment at the start: your secret role, your side, and when you act. */
function RoleReveal({ player, notes, onClose }: { player: PlayerView; notes: string[]; onClose: () => void }) {
  const info = ROLES[player.role!];
  const pack = player.role === 'coven' ? notes.find((n) => n.startsWith('Your coven') || n.startsWith('You work your curses alone')) : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay reveal-overlay" onClick={onClose}>
      <div className={cx('reveal-card', info.team)} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your role">
        <div className="rc-kicker">Your secret role</div>
        <RoleEmblem role={player.role} size={120} />
        <h2>You are {info.a}</h2>
        <div className="rc-team">You fight for {TEAM_NAMES[info.team]}. {info.team === 'coven' ? 'Win when the coven equals the rest of the village.' : 'Win when every witch is dead.'}</div>
        {pack && <p className="reveal-pack">{pack}</p>}
        <ul className="reveal-when">{info.when.map((w, i) => <li key={i}>{w}</li>)}</ul>
        <p className="reveal-secret">Keep it secret. Only you can see this.</p>
        <button className="btn primary" onClick={onClose} autoFocus>I understand</button>
      </div>
    </div>
  );
}

/** Things only you know: your coven, your findings, the Wise Woman's news. */
function Journal({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <section className="journal" aria-label="Your private journal">
      <h3>Your journal</h3>
      <ul>{notes.map((n, i) => <li key={i} className={n.includes('IS a witch') ? 'wolf' : ''}>{n}</li>)}</ul>
    </section>
  );
}

function LogDrawer({ entries, onClose }: { entries: string[]; onClose: () => void }) {
  const ref = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);
  return (
    <aside className="log-drawer">
      <div className="log-head">
        <h3>What has happened</h3>
        <button className="btn ghost tiny" onClick={onClose}>✕</button>
      </div>
      <ol className="log-list" ref={ref}>
        {entries.map((l, i) => <li key={i}>{l}</li>)}
      </ol>
    </aside>
  );
}

function Results({ game, isHost, armsOf, onLobby, onHide }: {
  game: GameView;
  isHost: boolean;
  armsOf: (id: string) => Arms;
  onLobby: () => void;
  onHide: () => void;
}) {
  const village = game.winner === 'village';
  const myTeam = game.myRole ? ROLES[game.myRole].team : null;
  const won = myTeam === game.winner;
  return (
    <div className="overlay">
      <div className={cx('panel results', village ? 'village' : 'coven')}>
        <span className="results-sky" style={{ backgroundImage: village ? SUN : MOON }} />
        <h2>{village ? 'The village is saved!' : 'The coven has won'}</h2>
        {myTeam && <p className="results-you">{won ? 'Your side won.' : 'Your side lost.'}</p>}
        <ul className="results-roles">
          {game.players.map((p) => (
            <li key={p.id} className={cx(p.role && ROLES[p.role].team === game.winner && 'winner', !p.alive && 'dead')}>
              <Crest arms={armsOf(p.id)} size={24} />
              <span className="rr-name">{p.name}</span>
              <RoleEmblem role={p.role} size={28} />
              <span className="rr-role">{p.role ? ROLES[p.role].name : ''}</span>
              <span className="rr-fate">{p.alive ? 'survived' : p.death?.cause === 'lynch' ? 'hanged' : p.death?.cause === 'hunter' ? 'shot' : p.death?.cause === 'poison' ? 'poisoned' : 'cursed'}</span>
            </li>
          ))}
        </ul>
        <div className="results-actions">
          {isHost ? <button className="btn primary" onClick={onLobby}>Back to lobby</button> : <span className="muted">Waiting for the host…</span>}
          <button className="btn ghost" onClick={onHide}>See the village</button>
        </div>
      </div>
    </div>
  );
}
