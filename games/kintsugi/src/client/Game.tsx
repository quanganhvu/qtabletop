import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  COLORS, FLOOR_PENALTIES, SIZE, canPlace, floorPenalty, tilesAt,
  type Action, type Color, type GameView, type PlayerState, type Source, type Target,
} from '../shared/game';
import type { ClientMessage, RoomInfo } from '../shared/protocol';
import { Announcer, TurnStamp, useAnnouncements, useEventSounds } from './Announcer';
import { RuleBook } from './RuleBook';
import { UiIcon } from './UiIcon';
import { BOT_LEVEL_INFO, type BotLevel } from '../shared/botLevels';
import { fanfare, isMuted, setMuted } from './sfx';
import { Crest, Seal, Seam, MiniWall, Num, Tile, PlayerBoard, cx, type Placement } from './pieces';
import { PRESET_ARMS, type Arms } from '../shared/heraldry';
import { GAME_NAME, POINTS_NAME, colorName } from '../shared/theme';

interface Selection {
  key: number;
  source: Source | null;
  color: Color | null;
  /** Where the player means to put the tiles; nothing happens until they confirm. */
  target: Target | null;
}

const freshSelection = (key: number): Selection => ({ key, source: null, color: null, target: null });

const NARROW = '(max-width: 1099px)';

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => matchMedia(NARROW).matches);
  useEffect(() => {
    const query = matchMedia(NARROW);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/** Keeps --dock-h in sync with the dock's height while it is pinned to the bottom (phones), so nothing hides behind it. */
function useDockHeight() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const pinned = getComputedStyle(el).position === 'fixed';
      document.documentElement.style.setProperty('--dock-h', `${pinned ? el.offsetHeight : 0}px`);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener('resize', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);
  return ref;
}

/** Wall tiles set since the last update, per player ("r,c"), so they can glow for a while. */
function useFreshPanes(game: GameView): Map<string, Set<string>> {
  const prev = useRef<Map<string, boolean[][]> | null>(null);
  const [fresh, setFresh] = useState<Map<string, Set<string>>>(new Map());
  useEffect(() => {
    const before = prev.current;
    prev.current = new Map(game.players.map((p) => [p.id, p.wall.map((row) => [...row])]));
    if (!before) return;
    const found = new Map<string, Set<string>>();
    for (const p of game.players) {
      const old = before.get(p.id);
      if (!old) continue;
      const cells = new Set<string>();
      p.wall.forEach((row, r) => row.forEach((set, c) => { if (set && !old[r][c]) cells.add(`${r},${c}`); }));
      if (cells.size) found.set(p.id, cells);
    }
    if (!found.size) return;
    setFresh(found);
    const timer = setTimeout(() => setFresh(new Map()), 6000);
    return () => clearTimeout(timer);
  }, [game]);
  return fresh;
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
  const sel = rawSel.key === game.turn ? rawSel : freshSelection(game.turn);
  const reset = () => setSel(freshSelection(game.turn));

  const [showResults, setShowResults] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [openRival, setOpenRival] = useState<string | null>(null);
  const narrow = useNarrow();
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
  const fresh = useFreshPanes(game);
  const [muted, setMutedState] = useState(isMuted);
  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  useEffect(() => {
    document.title = myTurn ? `● Your turn · ${GAME_NAME}` : GAME_NAME;
  }, [myTurn]);

  // Rivals sit in turn order after you, like seats around a table.
  const rivals = me ? [...game.players.slice(meIndex + 1), ...game.players.slice(0, meIndex)] : game.players;
  const current = game.phase === 'over' ? null : game.players[game.current];

  const pick = (source: Source, color: Color) => {
    if (!myTurn) return;
    if (sel.source === source && sel.color === color) return reset();
    setSel({ key: game.turn, source, color, target: null });
  };
  /** Choose where the tiles go; choosing the same place again confirms it. */
  const place = (target: Target) => {
    if (sel.source === null || !sel.color) return;
    if (sel.target === target) return confirmMove();
    setSel({ ...sel, target });
  };
  const confirmMove = () => {
    if (sel.source === null || !sel.color || sel.target === null) return;
    act({ type: 'take', source: sel.source, color: sel.color, target: sel.target });
    reset();
  };
  const placement: Placement | null = me && sel.source !== null && sel.color && sel.target !== null
    ? { target: sel.target, color: sel.color, count: tilesAt(game, sel.source).filter((c) => c === sel.color).length, seal: sel.source === 'center' && game.firstInCenter }
    : null;
  const validRows = me && sel.color ? Array.from({ length: SIZE }, (_, r) => r).filter((r) => canPlace(me, r, sel.color!)) : [];
  /** Say why a row can't take the tiles in hand. */
  const explainRow = (r: number) => {
    if (!me || !sel.color) return;
    const line = me.lines[r];
    const glaze = colorName(sel.color);
    if (line.count >= r + 1) return notify(`Row ${r + 1} is full until the end of the round.`);
    if (line.color && line.color !== sel.color) return notify(`Row ${r + 1} already holds ${colorName(line.color)}: each row takes one glaze only.`);
    return notify(`Your wall already has ${glaze} in row ${r + 1}, so that row can't take more.`);
  };

  // Escape puts the tiles back; Enter confirms a planned move.
  useEffect(() => {
    if (!myTurn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset();
      else if (e.key === 'Enter' && sel.target !== null) confirmMove();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const rivalCard = (p: PlayerState, sheet = false) => (
    <RivalPanel
      key={p.id}
      player={p}
      isCurrent={current?.id === p.id}
      offline={!seat(p.id)?.connected}
      left={!!seat(p.id)?.left}
      bot={!!seat(p.id)?.bot}
      level={seat(p.id)?.level}
      arms={armsOf(p.id)}
      canClaim={!me}
      onClaim={() => send({ type: 'claimSeat', seatId: p.id })}
      fresh={fresh.get(p.id)}
      sheet={sheet}
    />
  );
  const openRivalPlayer = narrow ? rivals.find((p) => p.id === openRival) : undefined;

  return (
    <div className={cx('game', myTurn && 'my-turn', !me && 'spectating')}>
      <header className="topbar">
        <div className="brand"><img className="emblem" src="/kintsugi.svg" alt="" width={30} height={30} /> <span>{GAME_NAME}</span> <span className="room-tag">{room.code}</span></div>
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
        {narrow ? (
          // Phones and tablets: one chip per rival; tap one to see their board.
          <section className="rivals compact" style={{ '--n': rivals.length } as CSSProperties}>
            {rivals.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cx('rival-chip', current?.id === p.id && 'current', !seat(p.id)?.connected && 'offline', openRival === p.id && 'open')}
                onClick={() => setOpenRival(openRival === p.id ? null : p.id)}
                aria-expanded={openRival === p.id}
                aria-label={`${p.name}: ${p.score} ${POINTS_NAME}. Show their board`}
              >
                <span className="rc-head">
                  <Crest arms={armsOf(p.id)} size={18} />
                  <span className="rc-name">{p.name}</span>
                  <span key={p.score} className="score-pill pop"><Num>{p.score}</Num></span>
                </span>
                <span className="rc-body">
                  <MiniWall wall={p.wall} />
                  <span className="rc-lines">
                    {p.lines.map((l, r) => (
                      <span key={r} className="rc-line">
                        {Array.from({ length: r + 1 }, (_, i) => <span key={i} className={cx('rc-dot', i >= r + 1 - l.count && l.color)} />)}
                      </span>
                    ))}
                  </span>
                  {p.floor.length > 0 && <span className="rc-floor" title="Panes on the floor">−{p.floor.length}</span>}
                </span>
                {current?.id === p.id && <div className="thinking-bar" />}
              </button>
            ))}
            {openRivalPlayer && (
              <>
                <div className="sheet-backdrop" onClick={() => setOpenRival(null)} />
                <div className="rival-sheet" onClick={() => setOpenRival(null)}>{rivalCard(openRivalPlayer, true)}</div>
              </>
            )}
          </section>
        ) : (
          <section className="rivals">{rivals.map((p) => rivalCard(p))}</section>
        )}

        <main className="table">
          <Workshop game={game} sel={sel} onPick={myTurn ? pick : undefined} />
        </main>

        {me ? (
          <section className={cx('dock', myTurn && 'active')} ref={dockRef}>
            <div className="prompt">
              <ActionBar game={game} me={me} myTurn={myTurn} sel={sel} validRows={validRows} place={place} confirm={confirmMove} unplan={() => setSel({ ...sel, target: null })} reset={reset} onShowResults={() => setShowResults(true)} />
            </div>
            <div className="my-side">
              <TurnStamp item={announcement} you={you} />
              <div className="me-id">
                <Crest arms={armsOf(me.id)} size={narrow ? 26 : 40} />
                <div className="me-info">
                  <div className="me-name" title={me.name}>{me.name}</div>
                  <div className="me-sub">Round {game.round}</div>
                </div>
                <span key={me.score} className="score-pill big pop" title={`Your ${POINTS_NAME}`}><Num>{me.score}</Num></span>
              </div>
              <PlayerBoard
                player={me}
                color={myTurn ? sel.color : null}
                validRows={validRows}
                onRow={myTurn ? (r) => place(r) : undefined}
                onBlocked={myTurn ? explainRow : undefined}
                placement={myTurn ? placement : null}
                onFloor={myTurn ? () => place('floor') : undefined}
                fresh={fresh.get(me.id)}
                flyPrefix={me.id}
              />
            </div>
          </section>
        ) : (
          <section className="dock spectator" ref={dockRef}>
            <div className="prompt"><span className="muted">You are spectating. If a player has left, you can take their seat.</span></div>
          </section>
        )}
      </div>

      <Announcer item={announcement} game={game} you={you} armsOf={armsOf} />
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
  const nearEnd = game.players.some((p) => p.wall.some((row) => row.filter(Boolean).length === SIZE - 1));
  return (
    <>
      <span className={cx('pill', nearEnd && 'warn')} title={nearEnd ? 'Someone could finish a wall row this round, which ends the game' : undefined}>Round {game.round}</span>
      {myTurn ? <span className="pill turn">Your turn</span> : <span className="muted">{game.players[game.current].name}'s turn</span>}
    </>
  );
}

/** The kilns around the tray, where everyone draws tiles from. */
function Workshop({ game, sel, onPick }: { game: GameView; sel: Selection; onPick?: (source: Source, color: Color) => void }) {
  const n = game.kilns.length;
  return (
    <div className="workshop" style={{ '--kilns': n, '--mid': (n - 1) / 2 } as CSSProperties}>
      <div className="kilns">
        {game.kilns.map((kiln, i) => (
          <div key={i} className={cx('kiln', !kiln.length && 'empty', sel.source === i && 'chosen')} style={{ '--i': i } as CSSProperties} data-fly={`kiln-${i}`}>
            <div className="kiln-tiles">
              {kiln.map((color, j) => (
                <Tile
                  key={j}
                  color={color}
                  selected={sel.source === i && sel.color === color}
                  dim={sel.source === i && sel.color !== color}
                  onClick={onPick ? () => onPick(i, color) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <Tray game={game} sel={sel} onPick={onPick} />
    </div>
  );
}

/** The center of the table: tiles left over from the kilns, grouped by color, and the master's seal. */
function Tray({ game, sel, onPick }: { game: GameView; sel: Selection; onPick?: (source: Source, color: Color) => void }) {
  const groups = COLORS.map((color) => ({ color, count: tilesAt(game, 'center').filter((c) => c === color).length })).filter((g) => g.count);
  return (
    <div className={cx('tray', sel.source === 'center' && 'chosen')} data-fly="tray">
      <span className="tray-label">The tray</span>
      <div className="tray-tiles">
        {game.firstInCenter && <Seal />}
        {groups.map(({ color, count }) => (
          <span key={color} className="tray-group">
            {Array.from({ length: count }, (_, i) => (
              <Tile
                key={i}
                color={color}
                selected={sel.source === 'center' && sel.color === color}
                dim={sel.source === 'center' && sel.color !== color}
                onClick={onPick ? () => onPick('center', color) : undefined}
              />
            ))}
          </span>
        ))}
        {!groups.length && !game.firstInCenter && <span className="muted tray-empty">empty</span>}
      </div>
    </div>
  );
}

function RivalPanel({ player: p, isCurrent, offline, left, bot, level, arms, canClaim, onClaim, fresh, sheet }: {
  player: PlayerState;
  isCurrent: boolean;
  offline: boolean;
  left: boolean;
  bot: boolean;
  level?: BotLevel;
  arms: Arms;
  canClaim: boolean;
  onClaim: () => void;
  fresh?: Set<string>;
  sheet: boolean;
}) {
  return (
    <div className={cx('rival', isCurrent && 'current', offline && 'offline')}>
      <div className="rival-head">
        <Crest arms={arms} size={24} />
        <span className="rival-name">
          <span className="rival-text">{p.name}</span>
          {bot && <span className="tag muted bot-tag" title={left ? 'Left the game; a bot is playing for them' : undefined}>{left ? 'left · bot' : BOT_LEVEL_INFO[level ?? 'normal'].rank}</span>}
          {offline && <span className="tag muted">offline</span>}
        </span>
        {(offline || left) && canClaim && <button className="btn tiny" onClick={onClaim}>Take seat</button>}
        <span key={p.score} className="score-pill pop" title={POINTS_NAME}><Num>{p.score}</Num></span>
      </div>
      <PlayerBoard player={p} compact fresh={fresh} flyPrefix={sheet ? undefined : p.id} />
      {isCurrent && <div className="thinking-bar" />}
    </div>
  );
}

function ActionBar({ game, me, myTurn, sel, validRows, place, confirm, unplan, reset, onShowResults }: {
  game: GameView;
  me: PlayerState;
  myTurn: boolean;
  sel: Selection;
  validRows: number[];
  place: (target: Target) => void;
  confirm: () => void;
  unplan: () => void;
  reset: () => void;
  onShowResults: () => void;
}) {
  if (game.phase === 'over') {
    return <><span>Game over.</span><button className="btn" onClick={onShowResults}>Show results</button></>;
  }
  if (!myTurn) return <span className="muted thinking">Waiting for {game.players[game.current].name}</span>;
  if (sel.source === null || !sel.color) {
    return <span className="prompt-text"><b className="accent">Your turn!</b> Tap a color in a kiln or on the tray.</span>;
  }
  const count = tilesAt(game, sel.source).filter((c) => c === sel.color).length;
  const token = sel.source === 'center' && game.firstInCenter;
  if (sel.target !== null) {
    // The move is planned: say exactly what it will do, and wait for the player to confirm.
    const glaze = colorName(sel.color);
    const fits = sel.target === 'floor' ? 0 : Math.min(count, sel.target + 1 - me.lines[sel.target].count);
    const broken = count - fits;
    const cost = floorPenalty(Math.min(FLOOR_PENALTIES.length, me.floor.length + broken + (token ? 1 : 0))) - floorPenalty(me.floor.length);
    return (
      <>
        <span className="prompt-text">
          <span className="prompt-tiles">{Array.from({ length: count }, (_, i) => <Tile key={i} color={sel.color!} />)}{token && <Seal />}</span>
          {sel.target === 'floor'
            ? <> Drop {count} {glaze} on the floor?</>
            : <> Put {fits} {glaze} in row {sel.target + 1}{broken ? <>, and break {broken}</> : null}?</>}
          {cost > 0 && <span className="cost"> −{cost} {cost === 1 ? 'point' : 'points'}</span>}
        </span>
        <button className="btn primary" onClick={confirm}>Confirm</button>
        <button className="btn" onClick={unplan}>Change</button>
        <button className="btn ghost" onClick={reset}>Cancel</button>
      </>
    );
  }
  return (
    <>
      <span className="prompt-text">
        <span className="prompt-tiles">{Array.from({ length: count }, (_, i) => <Tile key={i} color={sel.color!} />)}{token && <Seal />}</span>
        {validRows.length
          ? <> Choose a glowing row for {count} {colorName(sel.color)}, or the floor.</>
          : <> No row can take {colorName(sel.color)}: they go to the floor.</>}
        {token && <span className="muted"> You also take the master’s seal: you start next round, but it costs 1.</span>}
      </span>
      {!validRows.length && <button className="btn primary" onClick={() => place('floor')}>To the floor</button>}
      <button className="btn ghost" onClick={reset}>Cancel</button>
    </>
  );
}

function LogDrawer({ entries, onClose }: { entries: string[]; onClose: () => void }) {
  const ref = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);
  return (
    <aside className="paper log-drawer">
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

const RESULT_COLUMNS = [
  { key: 'tiles', label: 'Tiles', title: 'Points for tiles set during play' },
  { key: 'broken', label: 'Broken', title: 'Points lost to broken tiles' },
  { key: 'rows', label: 'Rows', title: '2 per finished wall row' },
  { key: 'columns', label: 'Columns', title: '7 per finished column' },
  { key: 'colors', label: 'Colors', title: '10 per color set five times' },
] as const;

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
  const tieBroken = ranking.length > 1 && ranking[0].score === ranking[1].score && winners.length === 1;
  return (
    <div className="overlay">
      <Confetti />
      <div className="panel results">
        <Seam />
        <div className="results-tiles">{COLORS.map((c) => <Tile key={c} color={c} />)}</div>
        <h2>{you && winners.includes(you) ? (winners.length > 1 ? 'You share the win!' : 'You win!') : `${winnerNames} win${winners.length > 1 ? '' : 's'}!`}</h2>
        <div className="results-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th />
                {RESULT_COLUMNS.map((c) => <th key={c.key} title={c.title}>{c.label}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.id} className={winners.includes(r.id) ? 'winner' : ''}>
                  <td className="res-name"><Crest arms={armsOf(r.id)} size={22} />{i + 1}. {r.name}</td>
                  {RESULT_COLUMNS.map((c) => <td key={c.key}>{c.key === 'broken' ? (r.breakdown.broken ? `−${r.breakdown.broken}` : 0) : r.breakdown[c.key]}</td>)}
                  <td><b>{r.score}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tieBroken && <p className="muted small">Tied on points: the most finished wall rows wins.</p>}
        <div className="results-actions">
          {isHost ? <button className="btn primary" onClick={onLobby}>Back to lobby</button> : <span className="muted">Waiting for the host…</span>}
          <button className="btn ghost" onClick={onHide}>View the walls</button>
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
      size: 10 + Math.random() * 12,
      spin: (Math.random() - 0.5) * 720,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })));
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={cx('confetto', p.color)}
          style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, '--spin': `${p.spin}deg` } as CSSProperties}
        />
      ))}
    </div>
  );
}

