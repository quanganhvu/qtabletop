import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MEEPLES, SCORE_KINDS, legalSpots, meepleOptions, type Action, type GameView, type PlayerState } from '../shared/game';
import type { ClientMessage, RoomInfo } from '../shared/protocol';
import { Announcer, useAnnouncements, useEventSounds } from './Announcer';
import { Board, type Flash, type Preview } from './Board';
import { RuleBook } from './RuleBook';
import { UiIcon } from './UiIcon';
import { BOT_LEVEL_INFO, type BotLevel } from '../shared/botLevels';
import { fanfare, isMuted, setMuted } from './sfx';
import { Crest, Banner, Num, TileFace, cx } from './pieces';
import { PRESET_ARMS, type Arms } from '../shared/heraldry';
import { FEATURE_NAMES, GAME_NAME, POINTS_NAME, SEAT_COLORS } from '../shared/theme';
import { TILES } from '../shared/tiles';

interface Selection {
  key: number;
  spot: { x: number; y: number } | null;
  rot: number;
  meeple: number | null;
}

const freshSelection = (key: number, rot = 0): Selection => ({ key, spot: null, rot, meeple: null });

/** Keeps the --dock-h CSS variable in sync with the dock's real height, so the board never hides behind it. */
function useDockHeight() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', `${el.offsetHeight}px`));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function Game({ room, game, you, act, send, leave, notify }: {
  room: RoomInfo;
  game: GameView;
  you: string | null;
  act: (action: Action) => void;
  send: (msg: ClientMessage) => void;
  leave: () => void;
  notify: (msg: string) => void;
}) {
  // Any selection is discarded as soon as the turn moves on.
  const [rawSel, setSel] = useState(() => freshSelection(game.turn));
  const sel = rawSel.key === game.turn ? rawSel : freshSelection(game.turn, rawSel.rot);
  const update = (patch: Partial<Selection>) => setSel({ ...sel, ...patch });

  const [showResults, setShowResults] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const dockRef = useDockHeight();
  const meIndex = game.players.findIndex((p) => p.id === you);
  const me = meIndex === -1 ? null : game.players[meIndex];
  const myTurn = !!me && game.phase !== 'over' && meIndex === game.current;
  const seat = (id: string) => room.players.find((p) => p.id === id);
  const armsOf = (id: string): Arms => seat(id)?.arms ?? PRESET_ARMS[0];
  const isHost = room.hostId === you;
  const leaveGame = () => {
    const sure = !me || game.phase === 'over'
      || confirm('Leave the game? A bot will take over your seat so the others can finish. You can rejoin later with the room link.');
    if (sure) leave();
  };
  const endGame = () => {
    if (confirm('End this game for everyone and return to the lobby?')) send({ type: 'endGame' });
  };
  const announcement = useAnnouncements(game, you);
  useEventSounds(game);
  const [muted, setMutedState] = useState(isMuted);
  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  useEffect(() => {
    document.title = myTurn ? `● Your turn · ${GAME_NAME}` : GAME_NAME;
  }, [myTurn]);

  const tile = game.tile;
  const spots = useMemo(() => (myTurn && tile ? legalSpots(game.board, tile) : null), [myTurn, tile, game.board]);
  const spotAt = (x: number, y: number) => spots?.find((s) => s.x === x && s.y === y);

  const options = useMemo(() => {
    if (!sel.spot || !tile || !me || me.meeples <= 0) return [];
    return meepleOptions(game.board, tile, sel.spot.x, sel.spot.y, sel.rot);
  }, [sel.spot, sel.rot, tile, game.board, me]);

  const chooseSpot = (x: number, y: number) => {
    const s = spotAt(x, y);
    if (!s) return;
    if (sel.spot?.x === x && sel.spot.y === y) return rotate();
    update({ spot: { x, y }, rot: s.rots.includes(sel.rot) ? sel.rot : s.rots[0], meeple: null });
  };

  /** Turn the tile: at a chosen square, only to the rotations that fit there. */
  const rotate = (dir = 1) => {
    if (!sel.spot) return update({ rot: (sel.rot + dir + 4) % 4 });
    const s = spotAt(sel.spot.x, sel.spot.y)!;
    if (s.rots.length === 1) return notify('It only fits this way round here');
    const i = s.rots.indexOf(sel.rot);
    update({ rot: s.rots[(i + dir + s.rots.length) % s.rots.length], meeple: null });
  };

  const confirmPlace = () => {
    if (!sel.spot) return;
    act({ type: 'place', x: sel.spot.x, y: sel.spot.y, rot: sel.rot, meeple: sel.meeple });
    setSel(freshSelection(game.turn, sel.rot));
  };

  // Keyboard: R / Shift+R to turn the tile, Enter to lay it, Escape to pick it back up.
  useEffect(() => {
    if (!myTurn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'r' || e.key === 'R') rotate(e.shiftKey ? -1 : 1);
      else if (e.key === 'Enter' && sel.spot) confirmPlace();
      else if (e.key === 'Escape') setSel(freshSelection(game.turn, sel.rot));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const preview: Preview | null = myTurn && sel.spot && tile
    ? { x: sel.spot.x, y: sel.spot.y, rot: sel.rot, tile, options, meeple: sel.meeple, seat: meIndex }
    : null;

  const flash: Flash | null = announcement?.kind === 'event' && announcement.event.kind === 'score'
    ? { id: announcement.id, tiles: announcement.event.tiles, points: announcement.event.points }
    : null;

  // Re-frame the land when you open the game and when the game ends.
  useEffect(() => setFitSignal((n) => n + 1), [game.phase]);

  const current = game.phase === 'over' ? null : game.players[game.current];

  return (
    <div className={cx('game', myTurn && 'my-turn', !me && 'spectating')}>
      <header className="topbar">
        <div className="brand"><img className="castle" src="/castle.svg" alt="" width={30} height={30} /> <span>{GAME_NAME}</span> <span className="room-tag">{room.code}</span></div>
        <div key={game.log.length} className="ticker">{game.log[game.log.length - 1]}</div>
        <div className="status"><Status game={game} myTurn={myTurn} /></div>
        <button className="btn ghost small" onClick={toggleMute} title={muted ? 'Sound is off' : 'Sound is on'} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}><UiIcon name={muted ? 'bellOff' : 'bell'} /></button>
        <button className="btn ghost small" onClick={() => setRulesOpen(true)} title="Rules" aria-label="Rules"><UiIcon name="book" /><span className="btn-label">Rules</span></button>
        <button className="btn ghost small" onClick={() => setLogOpen(!logOpen)} title="Game log" aria-label="Game log"><UiIcon name="scroll" /><span className="btn-label">Log</span></button>
        {isHost && game.phase !== 'over' && (
          <button className="btn ghost small" title="Stop this game and return everyone to the lobby" onClick={endGame} aria-label="End game"><UiIcon name="swords" /><span className="btn-label">End game</span></button>
        )}
        <button className="btn ghost small" title={me ? 'Leave the table; a bot takes over your seat' : 'Stop watching'} onClick={leaveGame} aria-label="Leave"><UiIcon name="door" /><span className="btn-label">Leave</span></button>
      </header>

      <div className="arena">
        <section className="scoreboard" aria-label="Players">
          {game.players.map((p, i) => (
            <PlayerRow
              key={p.id}
              player={p}
              seat={i}
              you={p.id === you}
              isCurrent={current?.id === p.id}
              offline={!seat(p.id)?.connected}
              left={!!seat(p.id)?.left}
              bot={!!seat(p.id)?.bot}
              level={seat(p.id)?.level}
              arms={armsOf(p.id)}
              canClaim={!me}
              onClaim={() => send({ type: 'claimSeat', seatId: p.id })}
            />
          ))}
          <div className="deck-left" title="Tiles still face down">
            <span className="deck-stack" /><span><Num>{game.deckCount}</Num></span><span className="muted small">tiles left</span>
          </div>
        </section>

        <main className="table">
          <Board
            game={game}
            spots={spots}
            rot={sel.rot}
            preview={preview}
            onSpot={chooseSpot}
            onMeeple={(meeple) => update({ meeple })}
            flash={flash}
            fitSignal={fitSignal}
          />
          <Announcer item={announcement} game={game} you={you} armsOf={armsOf} />
        </main>
      </div>

      {me ? (
        <div className={cx('dock', myTurn && 'active')} ref={dockRef}>
          <div className="prompt">
            <ActionBar
              game={game}
              me={me}
              myTurn={myTurn}
              sel={sel}
              canRotate={!sel.spot || (spotAt(sel.spot.x, sel.spot.y)?.rots.length ?? 0) > 1}
              optionsCount={options.length}
              rotate={() => rotate()}
              confirm={confirmPlace}
              cancel={() => setSel(freshSelection(game.turn, sel.rot))}
              onShowResults={() => setShowResults(true)}
            />
          </div>
          <div className="tableau">
            <div className="me-id">
              <div className="me-crest"><Crest arms={armsOf(me.id)} size={56} /></div>
              <div className="me-info">
                <div className="me-name" title={me.name}>{me.name}</div>
                <div className="me-row">
                  <div className="me-points" title={`Your ${POINTS_NAME}`}>
                    <span key={me.score} className="pop"><Num>{me.score}</Num></span>
                  </div>
                  <Followers count={me.meeples} seat={meIndex} />
                </div>
              </div>
            </div>
            <Hand game={game} you={you} rot={myTurn ? sel.rot : 0} myTurn={myTurn} onRotate={myTurn ? rotate : undefined} />
          </div>
        </div>
      ) : (
        <div className="dock spectator" ref={dockRef}>
          <div className="prompt"><span className="muted">You are spectating. If a player has left, you can take their seat.</span></div>
        </div>
      )}

      {rulesOpen && <RuleBook onClose={() => setRulesOpen(false)} />}
      {logOpen && <LogDrawer entries={game.log} onClose={() => setLogOpen(false)} />}

      {/* Let the final scoring play out before the results appear. */}
      {game.phase === 'over' && game.results && showResults && !announcement && (
        <Results game={game} you={you} isHost={isHost} armsOf={armsOf} onLobby={() => send({ type: 'backToLobby' })} onHide={() => setShowResults(false)} />
      )}
    </div>
  );
}

function Status({ game, myTurn }: { game: GameView; myTurn: boolean }) {
  if (game.phase === 'over') return <span className="pill">Game over</span>;
  return (
    <>
      {game.deckCount <= 5 && <span className="pill warn">{game.deckCount === 0 ? 'Last tile' : `${game.deckCount} tiles left`}</span>}
      {myTurn ? <span className="pill turn">Your turn</span> : <span className="muted">{game.players[game.current].name}'s turn</span>}
    </>
  );
}

/** The followers still in hand, as little figures. */
function Followers({ count, seat, small }: { count: number; seat: number; small?: boolean }) {
  return (
    <span className={cx('followers', small && 'small')} title={`${count} of ${MEEPLES} followers in hand`}>
      {Array.from({ length: MEEPLES }, (_, i) => (
        <span key={i} className={cx('follower-slot', i >= count && 'used')}><Banner seat={seat} size={small ? 13 : 20} /></span>
      ))}
    </span>
  );
}

function PlayerRow({ player: p, seat, you, isCurrent, offline, left, bot, level, arms, canClaim, onClaim }: {
  player: PlayerState;
  seat: number;
  you: boolean;
  level?: BotLevel;
  left: boolean;
  arms: Arms;
  isCurrent: boolean;
  offline: boolean;
  bot: boolean;
  canClaim: boolean;
  onClaim: () => void;
}) {
  return (
    <div className={cx('player-row', isCurrent && 'current', offline && 'offline', you && 'mine')} style={{ '--seat': SEAT_COLORS[seat].fill } as CSSProperties}>
      <Crest arms={arms} size={26} />
      <div className="pr-main">
        <span className="pr-name">
          <span className="pr-text">{p.name}{you && <span className="muted"> (you)</span>}</span>
          {bot && <span className="tag muted bot-tag" title={left ? 'Left the game; a bot is playing for them' : undefined}>{left ? 'left · bot' : BOT_LEVEL_INFO[level ?? 'normal'].rank}</span>}
          {offline && <span className="tag muted">offline</span>}
        </span>
        <Followers count={p.meeples} seat={seat} small />
      </div>
      {(offline || left) && canClaim && <button className="btn tiny" onClick={onClaim}>Take seat</button>}
      <span key={p.score} className="pr-score pop" title={POINTS_NAME}><Num>{p.score}</Num></span>
      {isCurrent && <div className="thinking-bar" />}
    </div>
  );
}

/** The tile being placed this turn: yours to turn, or whoever is on turn. */
function Hand({ game, you, rot, myTurn, onRotate }: { game: GameView; you: string | null; rot: number; myTurn: boolean; onRotate?: (dir?: number) => void }) {
  if (!game.tile) return <div className="hand empty"><span className="muted">No tile in hand</span></div>;
  const holder = game.players[game.current];
  return (
    <div className={cx('hand', myTurn && 'mine')}>
      <div className="hand-label">{myTurn ? 'Your tile' : holder.id === you ? 'Your tile' : `${holder.name}'s tile`}</div>
      <div className="hand-row">
        {onRotate && <button className="btn ghost small" onClick={() => onRotate(-1)} title="Turn left (Shift+R)" aria-label="Turn tile left"><UiIcon name="rotateLeft" /></button>}
        <div className="hand-tile" key={`${game.turn}`}><TileFace tile={game.tile} rot={rot} animateTurn /></div>
        {onRotate && <button className="btn ghost small" onClick={() => onRotate(1)} title="Turn right (R)" aria-label="Turn tile right"><UiIcon name="rotate" /></button>}
      </div>
    </div>
  );
}

function ActionBar({ game, me, myTurn, sel, canRotate, optionsCount, rotate, confirm, cancel, onShowResults }: {
  game: GameView;
  me: PlayerState;
  myTurn: boolean;
  sel: Selection;
  canRotate: boolean;
  optionsCount: number;
  rotate: () => void;
  confirm: () => void;
  cancel: () => void;
  onShowResults: () => void;
}) {
  if (game.phase === 'over') {
    return <><span>Game over.</span><button className="btn" onClick={onShowResults}>Show results</button></>;
  }
  if (!myTurn) return <span className="muted thinking">Waiting for {game.players[game.current].name}</span>;
  if (!sel.spot) {
    return <span><b className="accent">Your turn!</b> Choose a glowing square to lay your tile. Brighter squares fit it the way it is turned now.</span>;
  }
  const kind = sel.meeple === null ? null : TILES[game.tile!].features[sel.meeple].kind;
  return (
    <>
      <span>
        {kind
          ? <>A {FEATURE_NAMES[kind].follower} goes to the {FEATURE_NAMES[kind].name}.</>
          : me.meeples === 0
            ? <>All your followers are out.</>
            : optionsCount
              ? <>Tap a circle on the tile to send a follower, or lay it as it is.</>
              : <>No free feature for a follower here.</>}
      </span>
      {canRotate && <button className="btn" onClick={rotate}><UiIcon name="rotate" />Turn</button>}
      <button className="btn primary" onClick={confirm}>{kind ? `Lay tile & ${FEATURE_NAMES[kind].follower}` : 'Lay tile'}</button>
      <button className="btn ghost" onClick={cancel}>Cancel</button>
    </>
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
        <h3>Game log</h3>
        <button className="btn ghost tiny" onClick={onClose}>✕</button>
      </div>
      <ol className="log-list" ref={ref}>
        {entries.map((l, i) => <li key={i}>{l}</li>)}
      </ol>
    </aside>
  );
}

function Results({ game, you, isHost, armsOf, onLobby, onHide }: {
  game: GameView;
  you: string | null;
  isHost: boolean;
  armsOf: (id: string) => Arms;
  onLobby: () => void;
  onHide: () => void;
}) {
  const { ranking, winners } = game.results!;
  useEffect(() => fanfare(), []);
  const winnerNames = ranking.filter((r) => winners.includes(r.id)).map((r) => r.name).join(' & ');
  return (
    <div className="overlay">
      <Confetti />
      <div className="panel results">
        <div className="results-tiles">{['C', 'B', 'X', 'Q', 'A'].map((t) => <TileFace key={t} tile={t} size={36} />)}</div>
        <h2>{you && winners.includes(you) ? (winners.length > 1 ? 'You share the win!' : 'You win!') : `${winnerNames} win${winners.length > 1 ? '' : 's'}!`}</h2>
        <table className="results-table">
          <thead>
            <tr>
              <th />
              {SCORE_KINDS.map((k) => <th key={k} title={FEATURE_NAMES[k].plural}>{FEATURE_NAMES[k].plural}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.id} className={winners.includes(r.id) ? 'winner' : ''}>
                <td className="res-name"><Crest arms={armsOf(r.id)} size={22} />{i + 1}. {r.name}</td>
                {SCORE_KINDS.map((k) => <td key={k}>{r.breakdown[k]}</td>)}
                <td><b>{r.score}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="results-actions">
          {isHost ? <button className="btn primary" onClick={onLobby}>Back to lobby</button> : <span className="muted">Waiting for the host…</span>}
          <button className="btn ghost" onClick={onHide}>View the land</button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 70 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      duration: 2.6 + Math.random() * 2.4,
      size: 10 + Math.random() * 14,
      spin: (Math.random() - 0.5) * 720,
      color: SEAT_COLORS[Math.floor(Math.random() * SEAT_COLORS.length)].fill,
    })));
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetto"
          style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, '--spin': `${p.spin}deg`, '--c': p.color } as CSSProperties}
        />
      ))}
    </div>
  );
}
