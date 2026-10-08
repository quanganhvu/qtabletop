import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode, type Ref } from 'react';
import {
  TOWN, buildingsOf, cannotEnter, chitInfo, foodDemand, roundCard, shipFood, wealth,
  type Action, type GameView, type PlayerState,
} from '../shared/game';
import { GOODS, OFFER_GOODS, foodIn, type OfferGood } from '../shared/goods';
import { LOAN_REPAY, SHIP_ENERGY, SHIP_INFO, SHIP_KINDS, TURNS_PER_ROUND, building } from '../shared/data';
import type { ClientMessage, RoomInfo } from '../shared/protocol';
import { PRESET_FLAGS, type Flag } from '../shared/flags';
import { BOT_LEVEL_INFO } from '../shared/botLevels';
import { FRANC, GAME_NAME, GOOD_NAMES, T } from '../shared/theme';
import { Announcer, useAnnouncements } from './Announcer';
import { BuildingDialog, FeedDialog, ShipDialog } from './Dialogs';
import { RuleBook } from './RuleBook';
import { UiIcon } from './UiIcon';
import { fanfare, isMuted, setMuted } from './sfx';
import { BagView, BuildingCard, Engineer, FlagIcon, GoodCount, GoodIcon, Num, RocketArt, TokenPile, cx } from './pieces';

/** Keeps the --dock-h CSS variable in sync with the dock's real height, so the page never hides behind it. */
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

type Open = { kind: 'building'; id: string } | { kind: 'ship'; id: string } | null;
/** What's being dragged: your engineer (towards a building) or a landing pad's goods (towards your dock). */
type Drag = { kind: 'worker' } | { kind: 'offer'; good: OfferGood } | null;
const DRAG_TYPE = 'application/x-red-harbor';

/** A spot that lights up while something it accepts is being dragged. */
function DropZone({ accepts, onDrop, className, children }: { accepts: boolean; onDrop: () => void; className?: string; children: ReactNode }) {
  const [over, setOver] = useState(false);
  const allow = (e: DragEvent) => {
    if (!accepts) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOver(true);
  };
  return (
    <div
      className={cx(className, accepts && 'drop-ready', over && accepts && 'drop-over')}
      onDragOver={allow}
      onDragEnter={allow}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (!accepts) return;
        e.preventDefault();
        onDrop();
      }}
    >
      {children}
    </div>
  );
}

export function Game({ room, game, you, act, send, leave }: {
  room: RoomInfo;
  game: GameView;
  you: string | null;
  act: (action: Action) => void;
  send: (msg: ClientMessage) => void;
  leave: () => void;
  notify: (msg: string) => void;
}) {
  const [open, setOpen] = useState<Open>(null);
  const [offer, setOffer] = useState<OfferGood | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [feedHidden, setFeedHidden] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const dockRef = useDockHeight();

  const me = game.players.find((p) => p.id === you) ?? null;
  const acting = game.phase === 'turn' || game.phase === 'final';
  const myTurn = !!me && acting && game.players[game.current].id === me.id;
  const myFeed = !!me && game.phase === 'feed' && game.feeding[me.id] > 0;
  const seat = (id: string) => room.players.find((p) => p.id === id);
  const flagOf = (id: string): Flag => seat(id)?.flag ?? PRESET_FLAGS[0];
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? T.town;
  const isHost = room.hostId === you;
  const announcement = useAnnouncements(game, you);
  const actingId = announcement?.kind === 'event' ? announcement.event.playerId : null;
  const canAct = myTurn && !game.mainDone;
  const canTake = canAct && game.phase === 'turn';

  // Choices are discarded as soon as the turn moves on.
  useEffect(() => setOffer(null), [game.turn, game.mainDone]);
  useEffect(() => setFeedHidden(false), [game.round, game.phase]);
  useEffect(() => {
    document.title = myTurn || myFeed ? `● Your move · ${GAME_NAME}` : GAME_NAME;
  }, [myTurn, myFeed]);

  const leaveGame = () => {
    const sure = !me || game.phase === 'over'
      || confirm('Leave the game? A bot will take over your corporation so the others can finish. You can rejoin later with the room link.');
    if (sure) leave();
  };
  const endGame = () => {
    if (confirm('End this game for everyone and return to the lobby?')) send({ type: 'endGame' });
  };
  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const workersIn = (id: string) => game.players.filter((p) => p.at === id).map((p) => ({ flag: flagOf(p.id), name: p.name }));
  const enterable = (id: string) => canAct && !!me && !cannotEnter(game, me.id, id);
  const dropWorker = drag?.kind === 'worker';
  const dropOffer = drag?.kind === 'offer';
  const startDrag = (e: DragEvent, d: Drag) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(d));
    e.dataTransfer.effectAllowed = 'move';
    setDrag(d);
  };
  const endDrag = () => setDrag(null);

  /** A building on the board: click for details, or drop your engineer on it to use it. */
  const placed = (id: string, extra: { note?: ReactNode; ownerFlag?: Flag | null } = {}) => (
    <DropZone key={id} accepts={dropWorker && enterable(id)} onDrop={() => setOpen({ kind: 'building', id })} className="drop-slot">
      <BuildingCard id={id} workers={workersIn(id)} highlight={enterable(id)} dropTarget={dropWorker && enterable(id)}
        onClick={() => setOpen({ kind: 'building', id })} {...extra} />
    </DropZone>
  );

  const opponents = me ? game.players.filter((p) => p.id !== me.id) : game.players;

  return (
    <div className={cx('game', (myTurn || myFeed) && 'my-turn', !me && 'spectating', drag && 'dragging')}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">◉</span> <span>{GAME_NAME}</span> <span className="room-tag">{room.code}</span></div>
        <div key={game.log.length} className="ticker">{game.log[game.log.length - 1]}</div>
        <div className="status"><Status game={game} you={you} /></div>
        <button className="btn ghost small" onClick={toggleMute} title={muted ? 'Sound is off' : 'Sound is on'} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}><UiIcon name={muted ? 'bellOff' : 'bell'} /></button>
        <button className="btn ghost small" onClick={() => setRulesOpen(true)} title="Rules" aria-label="Rules"><UiIcon name="book" /><span className="btn-label">Rules</span></button>
        <button className="btn ghost small" onClick={() => setLogOpen(!logOpen)} title="Colony log" aria-label="Colony log"><UiIcon name="scroll" /><span className="btn-label">Log</span></button>
        {isHost && game.phase !== 'over' && (
          <button className="btn ghost small" title="Stop this game and return everyone to the lobby" onClick={endGame} aria-label="End game"><UiIcon name="stop" /><span className="btn-label">End game</span></button>
        )}
        <button className="btn ghost small" title={me ? 'Leave the table; a bot takes over your corporation' : 'Stop watching'} onClick={leaveGame} aria-label="Leave"><UiIcon name="door" /><span className="btn-label">Leave</span></button>
      </header>

      <div className="table-grid">
        <div className="table-main">
          {/* ---- The board ---- */}
          <section className="board" aria-label="Game board">
            <div className="board-top">
              <div className="blueprints">
                <div className="board-label">{T.proposals}<span>build at a construction bay, or buy</span></div>
                <div className="stacks">
                  {game.stacks.map((s, i) => (
                    <div key={i} className="stack-col">
                      {s[0]
                        ? <div className="stack-depth" style={{ '--depth': Math.min(s.length - 1, 4) } as CSSProperties}>
                            {placed(s[0], { note: s.length > 1 ? <span>{s.length - 1} beneath · next: {building(s[1]).name}</span> : 'last one' })}
                          </div>
                        : <div className="building empty">empty</div>}
                    </div>
                  ))}
                </div>
              </div>

              <CycleCard game={game} />

              <div className="bays">
                <div className="board-label">{T.harbour}<span>rockets for sale or assembly</span></div>
                {SHIP_KINDS.map((kind) => {
                  const docked = game.harbour.filter((s) => s.kind === kind);
                  const upcoming = game.rounds.filter((r) => r.ship === kind && r.round >= game.round && game.phase !== 'final' && game.phase !== 'over').length;
                  const info = SHIP_INFO[kind];
                  return (
                    <div key={kind} className={cx('bay', `s-${kind}`)}>
                      <div className="bay-head" title={`Assemble at a launch pad: ${Object.entries(info.materials).map(([g, n]) => `${n} ${GOOD_NAMES[g as keyof typeof GOOD_NAMES][1]}`).join(', ')} + ${SHIP_ENERGY} energy`}>
                        <span className="bay-name">{info.name}</span>
                        <span className="bay-stats">{info.value}{FRANC} · {info.food} food{info.capacity ? ` · 📦${info.capacity}` : ''}</span>
                        <span className="bay-cost"><BagView bag={info.materials} size={14} />+{SHIP_ENERGY}⚡</span>
                      </div>
                      <div className="bay-slots">
                        {docked.map((s) => (
                          <button key={s.id} type="button" className="rocket-token" onClick={() => setOpen({ kind: 'ship', id: s.id })} title={`${info.name}: click to buy`}>
                            <RocketArt kind={kind} />
                          </button>
                        ))}
                        {upcoming > 0 && <span className="bay-upcoming" title="Arriving at the end of future Sol cycles">+{upcoming} coming</span>}
                        {!docked.length && !upcoming && <span className="bay-upcoming">none</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* The orbit band: the supply shuttle steps along it once per turn. */}
            <div className="orbit" aria-label="Supply orbit">
              <div className="board-label light">{T.supply}<span>each turn the shuttle drops 2 goods on the pads below</span></div>
              <div className="drops">
                {game.chits.map((c, i) => {
                  const info = c.revealed ? chitInfo(c.id) : undefined;
                  return (
                    <div key={i} className={cx('drop', c.revealed && 'revealed', i < game.step - 1 && 'past', i === game.step - 1 && 'here')}
                      title={info ? `Drops ${info.goods.map((g) => GOOD_NAMES[g][0]).join(' and ')}${info.interest ? '; interest due on loans' : ''}` : 'Not yet scanned'}>
                      {info ? <>{info.goods.map((g, k) => <GoodIcon key={k} good={g} size={22} />)}{info.interest && <span className="interest" title="Interest: everyone with a loan pays 1cr">%</span>}</> : <span className="drop-back">?</span>}
                    </div>
                  );
                })}
                {(game.phase === 'turn' || game.phase === 'feed') && (
                  <span className="shuttle" style={{ left: `calc(${(game.step - 0.5) / TURNS_PER_ROUND} * 100%)` }} aria-label="Supply shuttle">
                    <RocketArt kind="wooden" />
                  </span>
                )}
              </div>
            </div>

            <div className="pads">
              {OFFER_GOODS.map((g) => {
                const n = game.offers[g];
                const takeable = canTake && n > 0;
                return (
                  <button
                    key={g}
                    type="button"
                    className={cx('pad', offer === g && 'selected', takeable && 'clickable', !n && 'bare')}
                    disabled={!takeable}
                    draggable={takeable}
                    onDragStart={(e) => startDrag(e, { kind: 'offer', good: g })}
                    onDragEnd={endDrag}
                    onClick={() => setOffer(offer === g ? null : g)}
                    title={takeable ? `Take all ${n} ${GOOD_NAMES[g][n === 1 ? 0 : 1]}: click, or drag onto your dock` : `${n} ${GOOD_NAMES[g][1]}`}
                  >
                    <span className="pad-ring" />
                    <TokenPile good={g} n={n} size={26} />
                    <span className="pad-n"><Num>{n}</Num></span>
                    <span className="pad-name">{GOOD_NAMES[g][1]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="colony panel">
            <h3>{T.town} <span className="muted">· starting and colony-built modules: enter for a fee</span></h3>
            <div className="building-grid">
              {buildingsOf(game, TOWN).map((id) => placed(id))}
            </div>
          </section>

          {me && (
            <section className="my-district panel">
              <h3>Your modules</h3>
              <div className="building-grid">
                {buildingsOf(game, me.id).map((id) => placed(id))}
                {!buildingsOf(game, me.id).length && <p className="muted small">None yet. Build one at a construction bay, or buy a blueprint.</p>}
              </div>
              {me.ships.length > 0 && (
                <>
                  <h3>Your rockets</h3>
                  <div className="ships-row">
                    {me.ships.map((s) => (
                      <button key={s.id} type="button" className="rocket-token large" onClick={() => setOpen({ kind: 'ship', id: s.id })} title={SHIP_INFO[s.kind].name}>
                        <RocketArt kind={s.kind} /><span>{SHIP_INFO[s.kind].name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="table-side">
          <CycleTrack game={game} />
          <section className="companies">
            {opponents.map((p) => (
              <Company
                key={p.id}
                game={game}
                player={p}
                flag={flagOf(p.id)}
                current={acting && game.players[game.current].id === p.id}
                feeding={game.phase === 'feed' && game.feeding[p.id] > 0}
                acting={actingId === p.id}
                seatInfo={seat(p.id)}
                canClaim={!me}
                onClaim={() => send({ type: 'claimSeat', seatId: p.id })}
                onOpenBuilding={(id) => setOpen({ kind: 'building', id })}
              />
            ))}
          </section>
        </aside>
      </div>

      {me ? (
        <DropZone accepts={dropOffer} onDrop={() => drag?.kind === 'offer' && act({ type: 'take', good: drag.good })} className="dock-drop">
          <Dock dockRef={dockRef} game={game} me={me} flag={flagOf(me.id)} myTurn={myTurn} myFeed={myFeed} offer={offer} setOffer={setOffer}
            canDragWorker={canAct} onWorkerDrag={(e) => startDrag(e, { kind: 'worker' })} onWorkerDragEnd={endDrag}
            act={act} onShowFeed={() => setFeedHidden(false)} onShowResults={() => setShowResults(true)} />
        </DropZone>
      ) : (
        <div className="dock spectator" ref={dockRef}>
          <div className="prompt"><span className="muted">You are spectating. If a player has left, you can take their seat.</span></div>
        </div>
      )}

      <Announcer item={announcement} game={game} you={you} flagOf={flagOf} />

      {open?.kind === 'building' && (
        <BuildingDialog game={game} me={me} id={open.id} flagOf={flagOf} nameOf={nameOf} act={act} onClose={() => setOpen(null)} />
      )}
      {open?.kind === 'ship' && <ShipDialog game={game} me={me} shipId={open.id} act={act} onClose={() => setOpen(null)} />}
      {myFeed && !feedHidden && !announcement && <FeedDialog me={me} due={game.feeding[me.id]} act={act} onHide={() => setFeedHidden(true)} />}
      {rulesOpen && <RuleBook onClose={() => setRulesOpen(false)} />}
      {logOpen && <LogDrawer entries={game.log} onClose={() => setLogOpen(false)} />}
      {game.phase === 'over' && game.results && showResults && !announcement && (
        <Results game={game} you={you} isHost={isHost} flagOf={flagOf} onLobby={() => send({ type: 'backToLobby' })} onHide={() => setShowResults(false)} />
      )}
    </div>
  );
}

/** The current Sol cycle's card, in the middle of the board like the round card on a real one. */
function CycleCard({ game }: { game: GameView }) {
  const card = roundCard(game);
  const ending = game.phase === 'final' || game.phase === 'over';
  return (
    <div className="cycle-card">
      <div className="cc-planet" aria-hidden="true" />
      {ending ? (
        <div className="cc-title">Final actions</div>
      ) : (
        <>
          <div className="cc-title">{T.round} <b>{card.round}</b><small>/{game.rounds.length}</small></div>
          <div className="cc-turn">turn {Math.max(1, game.step)} of {TURNS_PER_ROUND}</div>
          <ul className="cc-facts">
            <li title="Food every colony must supply at the end of this cycle (less what its rockets bring)">🍽 <b>{card.food}</b> food</li>
            <li className={card.harvest ? '' : 'off'}>🌾 {card.harvest ? T.harvest : 'no yield'}</li>
            {card.townBuilds && <li title="The Colony Authority builds the lowest-numbered blueprint at the end of this cycle">🏛 colony builds</li>}
            <li title="Lands at the spaceport at the end of this cycle">🚀 {SHIP_INFO[card.ship].name}</li>
          </ul>
        </>
      )}
    </div>
  );
}

/** Every Sol cycle as a numbered disc, like the round markers around a real board. */
function CycleTrack({ game }: { game: GameView }) {
  const done = game.phase === 'final' || game.phase === 'over';
  return (
    <section className="cycle-track panel">
      <h3>{T.round}s</h3>
      <div className="discs">
        {game.rounds.map((r) => {
          const state = done || r.round < game.round ? 'past' : r.round === game.round ? 'now' : 'future';
          return (
            <div key={r.round} className={cx('disc', state)}
              title={`Cycle ${r.round}: ${r.food} food${r.harvest ? ', greenhouse yield' : ''}${r.townBuilds ? ', colony builds' : ''}; a ${SHIP_INFO[r.ship].name.toLowerCase()} lands`}>
              <span className="disc-n">{r.round}</span>
              <span className="disc-food">{r.food}🍽</span>
              <span className={cx('disc-ship', `s-${r.ship}`)}>{SHIP_INFO[r.ship].name[0]}</span>
              {r.townBuilds && <span className="disc-build">🏛</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Status({ game, you }: { game: GameView; you: string | null }) {
  if (game.phase === 'over') return <span className="pill">Game over</span>;
  if (game.phase === 'feed') {
    const waiting = Object.keys(game.feeding);
    if (you && waiting.includes(you)) return <span className="pill turn">{T.feeding}</span>;
    return <span className="muted">{T.feeding}: {waiting.map((id) => game.players.find((p) => p.id === id)?.name).join(', ')}</span>;
  }
  const current = game.players[game.current];
  return (
    <>
      {game.phase === 'final' && <span className="pill warn">Final actions</span>}
      {current.id === you ? <span className="pill turn">Your turn</span> : <span className="muted">{current.name}'s turn</span>}
    </>
  );
}

function Company({ game, player: p, flag, current, feeding, acting, seatInfo, canClaim, onClaim, onOpenBuilding }: {
  game: GameView;
  player: PlayerState;
  flag: Flag;
  current: boolean;
  feeding: boolean;
  acting: boolean;
  seatInfo?: RoomInfo['players'][number];
  canClaim: boolean;
  onClaim: () => void;
  onOpenBuilding: (id: string) => void;
}) {
  const w = wealth(game, p);
  const ids = buildingsOf(game, p.id);
  const goods = GOODS.filter((g) => g !== 'franc' && p.goods[g] > 0);
  const offline = !seatInfo?.connected;
  return (
    <div className={cx('company panel', current && 'current', acting && 'acting', offline && 'offline')}>
      <div className="co-head">
        <FlagIcon flag={flag} size={26} />
        <span className="co-name">{p.name}
          {seatInfo?.bot && <span className="tag muted bot-tag">{seatInfo.left ? 'left · bot' : BOT_LEVEL_INFO[seatInfo.level ?? 'normal'].rank}</span>}
        </span>
        {offline && <span className="tag muted">offline</span>}
        {(offline || seatInfo?.left) && canClaim && <button className="btn tiny" onClick={onClaim}>Take seat</button>}
        {feeding && <span className="tag">supplying…</span>}
        <span className="co-worth" title="Wealth if the game ended now">{w.total}{FRANC}</span>
      </div>
      <div className="co-money">
        <GoodCount good="franc" n={p.goods.franc} size={22} />
        {p.loans > 0 && <span className="tag warn" title={`Loans: −7${FRANC} each at the end`}>{p.loans} loan{p.loans > 1 ? 's' : ''}</span>}
        <span className="muted small" title="Food in hand / food due this cycle">🍽 {foodIn(p.goods)}/{foodDemand(game, p)}</span>
        {shipFood(p) > 0 && <span className="muted small" title="Food from rockets each cycle">🚀 {shipFood(p)}</span>}
        <span className="co-at" title={`${p.name}'s engineer`}><Engineer flag={flag} size={18} /> {p.at ? building(p.at).name : 'idle'}</span>
      </div>
      <div className="co-goods">
        {goods.length ? goods.map((g) => <GoodCount key={g} good={g} n={p.goods[g]} size={20} />) : <span className="muted small">no resources</span>}
      </div>
      {(ids.length > 0 || p.ships.length > 0) && (
        <div className="co-assets">
          {ids.map((id) => (
            <button key={id} type="button" className={cx('co-building', game.players.some((x) => x.at === id) && 'busy')} onClick={() => onOpenBuilding(id)} title={building(id).text}>
              {building(id).name}
            </button>
          ))}
          {p.ships.map((s) => <span key={s.id} className="co-ship" title={SHIP_INFO[s.kind].name}><RocketArt kind={s.kind} /></span>)}
        </div>
      )}
      {current && <div className="thinking-bar" />}
    </div>
  );
}

/** Your side of the table: what to do next, your engineer and your resources. */
function Dock({ dockRef, game, me, flag, myTurn, myFeed, offer, setOffer, canDragWorker, onWorkerDrag, onWorkerDragEnd, act, onShowFeed, onShowResults }: {
  dockRef: Ref<HTMLDivElement>;
  game: GameView;
  me: PlayerState;
  flag: Flag;
  myTurn: boolean;
  myFeed: boolean;
  offer: OfferGood | null;
  setOffer: (g: OfferGood | null) => void;
  canDragWorker: boolean;
  onWorkerDrag: (e: DragEvent) => void;
  onWorkerDragEnd: () => void;
  act: (a: Action) => void;
  onShowFeed: () => void;
  onShowResults: () => void;
}) {
  const w = wealth(game, me);
  let prompt;
  if (game.phase === 'over') {
    prompt = <><span>Game over.</span><button className="btn" onClick={onShowResults}>Show results</button></>;
  } else if (myFeed) {
    prompt = <><span><b className="accent">{T.feeding}.</b> Supply {game.feeding[me.id]} food to your colonists.</span><button className="btn primary" onClick={onShowFeed}>Supply food</button></>;
  } else if (game.phase === 'feed') {
    prompt = <span className="muted thinking">Waiting for the other colonies' life support</span>;
  } else if (!myTurn) {
    prompt = <span className="muted thinking">Waiting for {game.players[game.current].name}</span>;
  } else if (offer) {
    prompt = (
      <>
        <span>Take <BagView bag={{ [offer]: game.offers[offer] }} size={20} /> from the landing pad?</span>
        <button className="btn primary" onClick={() => { act({ type: 'take', good: offer }); setOffer(null); }}>Take</button>
        <button className="btn ghost" onClick={() => setOffer(null)}>Cancel</button>
      </>
    );
  } else {
    const loanButtons = (
      <>
        <button className="btn small" title="Take a loan of 4 credits (−7 at the end unless repaid)" onClick={() => act({ type: 'loan' })}>Loan +4{FRANC}</button>
        {me.loans > 0 && <button className="btn small" disabled={me.goods.franc < LOAN_REPAY} onClick={() => act({ type: 'repay' })}>Repay {LOAN_REPAY}{FRANC}</button>}
      </>
    );
    if (!game.mainDone) {
      prompt = (
        <>
          <span><b className="accent">{game.phase === 'final' ? 'Your final action!' : 'Your turn!'}</b> {game.phase === 'final'
            ? 'Send your engineer into any module, even an occupied one.'
            : 'Drag a landing pad onto your dock, or drag your engineer onto a module. Clicking works too.'}</span>
          {loanButtons}
          <button className="btn ghost small" onClick={() => confirm('End your turn without an action?') && act({ type: 'endTurn' })}>Pass</button>
        </>
      );
    } else {
      prompt = (
        <>
          <span>Buy or sell modules and rockets, settle loans, then end your turn.</span>
          {loanButtons}
          <button className="btn primary" onClick={() => act({ type: 'endTurn' })}>End turn</button>
        </>
      );
    }
  }

  return (
    <div className={cx('dock', (myTurn || myFeed) && 'active')} ref={dockRef}>
      <div className="prompt">{prompt}</div>
      <div className="tableau">
        <div className="me-id">
          <span
            className={cx('engineer-slot', canDragWorker && 'draggable')}
            draggable={canDragWorker}
            onDragStart={onWorkerDrag}
            onDragEnd={onWorkerDragEnd}
            title={canDragWorker ? 'Drag your engineer onto a module to use it' : 'Your engineer'}
          >
            <Engineer flag={flag} size={44} />
          </span>
          <div>
            <div className="me-name">{me.name}</div>
            <div className="me-meta">
              <span title="Wealth if the game ended now">Wealth <b>{w.total}{FRANC}</b></span>
              {me.loans > 0 && <span className="warn-text">{me.loans} loan{me.loans > 1 ? 's' : ''}</span>}
              <span title="Food in hand / due this cycle">🍽 {foodIn(me.goods)}/{foodDemand(game, me)}</span>
              {shipFood(me) > 0 && <span title="Food from rockets each cycle">🚀 {shipFood(me)}</span>}
              <span className="muted">Engineer: {me.at ? building(me.at).name : 'idle'}</span>
            </div>
          </div>
        </div>
        <div className="my-goods">
          {GOODS.map((g) => <GoodCount key={g} good={g} n={me.goods[g]} size={30} faded />)}
        </div>
      </div>
    </div>
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
        <h3>Colony log</h3>
        <button className="btn ghost tiny" onClick={onClose}>✕</button>
      </div>
      <ol className="log-list" ref={ref}>
        {entries.map((l, i) => <li key={i}>{l}</li>)}
      </ol>
    </aside>
  );
}

function Results({ game, you, isHost, flagOf, onLobby, onHide }: {
  game: GameView;
  you: string | null;
  isHost: boolean;
  flagOf: (id: string) => Flag;
  onLobby: () => void;
  onHide: () => void;
}) {
  const { ranking, winners } = game.results!;
  useEffect(() => fanfare(), []);
  const winnerNames = ranking.filter((r) => winners.includes(r.id)).map((r) => r.name).join(' & ');
  return (
    <div className="overlay">
      <div className="panel results">
        <h2>{you && winners.includes(you) ? 'You win!' : `${winnerNames} win${winners.length > 1 ? '' : 's'}!`}</h2>
        <table className="results-table">
          <thead>
            <tr><th /><th>Credits</th><th>Modules</th><th>Bonus</th><th>Rockets</th><th>Loans</th><th>Total</th></tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.id} className={winners.includes(r.id) ? 'winner' : ''}>
                <td className="res-name"><FlagIcon flag={flagOf(r.id)} size={22} />{i + 1}. {r.name}</td>
                <td>{r.francs}</td><td>{r.buildings}</td><td>{r.bonus}</td><td>{r.ships}</td><td>{r.loans ? `−${r.loans}` : 0}</td>
                <td><b>{r.total}{FRANC}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="results-actions">
          {isHost ? <button className="btn primary" onClick={onLobby}>Back to lobby</button> : <span className="muted">Waiting for the host…</span>}
          <button className="btn ghost" onClick={onHide}>View the board</button>
        </div>
      </div>
    </div>
  );
}
