import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import {
  COLORS, MAX_RESERVED, MAX_TOKENS, TOKEN_COLORS, WIN_POINTS, emptyTokens, isHidden, meetsNoble, paymentFor, tokenTotal,
  type Action, type Card, type Color, type GameView, type Level, type PlayerView, type TokenColor, type Tokens,
} from '../shared/game';
import type { ClientMessage, RoomInfo } from '../shared/protocol';
import { Announcer, useAnnouncements } from './Announcer';
import { Confetti, useFx } from './fx';
import { fanfare, isMuted, setMuted } from './sfx';
import { CardPeek, CardView, Chip, ChipStack, Crest, DeckView, NobleView, Num, ResourceIcon, cx } from './pieces';
import { PRESET_ARMS, type Arms } from '../shared/heraldry';
import { GAME_NAME, POINTS_SYMBOL, RESOURCES, resource } from '../shared/theme';

interface Selection {
  key: string;
  tokens: Color[];
  cardId: string | null;
  deck: Level | null;
  discard: Tokens;
}

const freshSelection = (key: string): Selection => ({ key, tokens: [], cardId: null, deck: null, discard: emptyTokens() });

const NARROW = '(max-width: 860px)';

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

export function Game({ room, game, you, act, send, leave, notify }: {
  room: RoomInfo;
  game: GameView;
  you: string | null;
  act: (action: Action) => void;
  send: (msg: ClientMessage) => void;
  leave: () => void;
  notify: (msg: string) => void;
}) {
  // Any selection is discarded as soon as the turn or phase moves on.
  const key = `${game.turn}:${game.phase}`;
  const [rawSel, setSel] = useState(() => freshSelection(key));
  const sel = rawSel.key === key ? rawSel : freshSelection(key);
  const update = (patch: Partial<Selection>) => setSel({ ...sel, ...patch });
  const reset = () => setSel(freshSelection(key));

  const [showResults, setShowResults] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const narrow = useNarrow();
  const dockRef = useDockHeight();
  const meIndex = game.players.findIndex((p) => p.id === you);
  const me = meIndex === -1 ? null : game.players[meIndex];
  const myTurn = !!me && game.phase !== 'over' && meIndex === game.current;
  const choosing = myTurn && game.phase === 'turn';
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
  const fx = useFx(game);
  const [muted, setMutedState] = useState(isMuted);
  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };
  const actingId = announcement?.kind === 'event' ? announcement.event.playerId : null;

  // Opponents are listed in turn order starting after you, like seats around a table.
  const opponents = me ? [...game.players.slice(meIndex + 1), ...game.players.slice(0, meIndex)] : game.players;

  useEffect(() => {
    document.title = myTurn ? `● Your turn · ${GAME_NAME}` : GAME_NAME;
  }, [myTurn]);

  const doAction = (action: Action) => {
    act(action);
    reset();
  };

  const pickToken = (color: Color) => {
    const picked = sel.tokens;
    const tokens = [...picked];
    if (picked.includes(color)) {
      // Clicking a picked color again turns a single pick into a pair; otherwise it unpicks it.
      if (picked.length === 1) {
        if (game.bank[color] < 4) return notify(`You can only take 2 ${resource(color, 2)} when 4 or more are left`);
        tokens.push(color);
      } else {
        tokens.splice(tokens.indexOf(color), 1);
      }
    } else if (game.bank[color] === 0) {
      return notify('None left');
    } else if (picked.length === 2 && picked[0] === picked[1]) {
      return notify('You already picked 2 of the same resource');
    } else if (picked.length >= 3) {
      return notify('You can take at most 3 resources');
    } else {
      tokens.push(color);
    }
    update({ tokens, cardId: null, deck: null });
  };

  const selectCard = (id: string) => update({ tokens: [], deck: null, cardId: sel.cardId === id ? null : id });
  const selectDeck = (level: Level) => update({ tokens: [], cardId: null, deck: sel.deck === level ? null : level });

  return (
    <div className={cx('game', myTurn && 'my-turn', !me && 'spectating')}>
      <header className="topbar">
        <div className="brand"><ResourceIcon color="gold" /> <span>{GAME_NAME}</span> <span className="room-tag">{room.code}</span></div>
        <div key={game.log.length} className="ticker">{game.log[game.log.length - 1]}</div>
        <div className="status"><Status game={game} myTurn={myTurn} /></div>
        <button className="btn ghost small" onClick={toggleMute} title={muted ? 'Sound off' : 'Sound on'}>{muted ? '🔇' : '🔊'}</button>
        <button className="btn ghost small" onClick={() => setLogOpen(!logOpen)}>📜 Log</button>
        {isHost && game.phase !== 'over' && (
          <button className="btn ghost small" title="Stop this game and return everyone to the lobby" onClick={endGame}>End game</button>
        )}
        <button className="btn ghost small" title={me ? 'Leave the table; a bot takes over your seat' : 'Stop watching'} onClick={leaveGame}>⎋ Leave</button>
      </header>

      <div className="arena">
      <section className="opponents">
        {opponents.map((p) => (
          <OpponentPanel
            key={p.id}
            player={p}
            isCurrent={game.phase !== 'over' && game.players[game.current].id === p.id}
            acting={actingId === p.id}
            offline={!seat(p.id)?.connected}
            left={!!seat(p.id)?.left}
            bot={!!seat(p.id)?.bot}
            arms={armsOf(p.id)}
            canClaim={!me}
            onClaim={() => send({ type: 'claimSeat', seatId: p.id })}
          />
        ))}
      </section>

      <main className="table">
        <div className="board">
          <section className="nobles">
            {game.nobles.map((n) => {
              const eligible = myTurn && game.phase === 'noble' && !!me && meetsNoble(me.bonuses, n);
              return <NobleView key={n.id} noble={n} fly={`noble-${n.id}`} highlight={eligible} onClick={eligible ? () => doAction({ type: 'noble', nobleId: n.id }) : undefined} />;
            })}
          </section>
          <section className="rows">
            {([3, 2, 1] as Level[]).map((level) => (
              <div className="row" key={level}>
                <DeckView
                  level={level}
                  fly={`deck-${level}`}
                  count={game.deckCounts[level]}
                  selected={sel.deck === level}
                  onClick={choosing && game.deckCounts[level] > 0 ? () => selectDeck(level) : undefined}
                />
                {game.board[level].map((card, i) => (
                  <CardView
                    key={card?.id ?? `empty-${i}`}
                    card={card}
                    fly={`slot-${level}-${i}`}
                    hidden={!!card && fx.incoming.has(card.id)}
                    selected={!!card && sel.cardId === card.id}
                    highlight={choosing && !!card && !!me && !!paymentFor(me.tokens, me.bonuses, card)}
                    onClick={choosing && card ? () => selectCard(card.id) : undefined}
                  />
                ))}
              </div>
            ))}
          </section>
        </div>

        <section className="bank" aria-label="Treasury">
          {TOKEN_COLORS.map((color) => {
            const picked = sel.tokens.filter((c) => c === color).length;
            const clickable = choosing && color !== 'gold';
            return (
              <div className="bank-slot" key={color}>
                <ChipStack
                  color={color}
                  fly={`bank-${color}`}
                  count={game.bank[color] - picked}
                  size={narrow ? 46 : 58}
                  picked={picked > 0}
                  onClick={clickable ? () => pickToken(color) : undefined}
                  title={color === 'gold' ? 'Gold crowns are wild: you receive one when you reserve a card' : `${RESOURCES[color].plural}: click to take`}
                />
                {picked > 0 && <span className="badge"><Num>+{picked}</Num></span>}
              </div>
            );
          })}
        </section>
      </main>
      </div>

      {me ? (
        <Dock
          dockRef={dockRef}
          narrow={narrow}
          game={game}
          me={me}
          arms={armsOf(me.id)}
          myTurn={myTurn}
          sel={sel}
          update={update}
          reset={reset}
          doAction={doAction}
          selectCard={choosing ? selectCard : undefined}
          onShowResults={() => setShowResults(true)}
        />
      ) : (
        <div className="dock spectator" ref={dockRef}>
          <div className="prompt"><span className="muted">You are spectating. If a player has left, you can take their seat.</span></div>
        </div>
      )}

      {fx.layer}

      <Announcer item={announcement} game={game} you={you} armsOf={armsOf} />

      {logOpen && <LogDrawer entries={game.log} onClose={() => setLogOpen(false)} />}

      {/* Let the final moves play out before the results appear. */}
      {game.phase === 'over' && game.results && showResults && !announcement && (
        <Results
          game={game}
          you={you}
          isHost={room.hostId === you}
          armsOf={armsOf}
          onLobby={() => send({ type: 'backToLobby' })}
          onHide={() => setShowResults(false)}
        />
      )}
    </div>
  );
}

function Status({ game, myTurn }: { game: GameView; myTurn: boolean }) {
  if (game.phase === 'over') return <span className="pill">Game over</span>;
  return (
    <>
      {game.finalRound && <span className="pill warn">Final round</span>}
      {myTurn ? <span className="pill turn">Your turn</span> : <span className="muted">{game.players[game.current].name}'s turn</span>}
    </>
  );
}

function OpponentPanel({ player: p, isCurrent, acting, offline, left, bot, arms, canClaim, onClaim }: {
  player: PlayerView;
  left: boolean;
  arms: Arms;
  isCurrent: boolean;
  acting: boolean;
  offline: boolean;
  bot: boolean;
  canClaim: boolean;
  onClaim: () => void;
}) {
  return (
    <div className={cx('opponent', isCurrent && 'current', acting && 'acting', offline && 'offline')}>
      <div className="opp-head">
        <Crest arms={arms} size={24} />
        <span className="opp-name">{p.name}{bot && <span className="tag muted bot-tag" title={left ? 'Left the game; a bot is playing for them' : undefined}>{left ? 'left · bot' : 'bot'}</span>}</span>
        {offline && <span className="tag muted">offline</span>}
        {(offline || left) && canClaim && <button className="btn tiny" onClick={onClaim}>Take seat</button>}
        {p.nobles.length > 0 && <span className="opp-nobles" title={`${p.nobles.length} noble house(s)`}>{p.nobles.map((n) => <NobleView key={n.id} noble={n} size="mini" />)}</span>}
        <span key={p.points} className="opp-pts pop" data-fly={`points-${p.id}`} title="Renown"><Num>{p.points}{POINTS_SYMBOL}</Num></span>
      </div>
      <div className="opp-assets">
        {TOKEN_COLORS.map((c) => (
          <div className="opp-asset" key={c}>
            {c === 'gold'
              ? <span className="mini-bonus placeholder" />
              : <span className={cx('mini-bonus', c, !p.bonuses[c] && 'zero')} title={`${c} cards`} data-fly={`bonus-${p.id}-${c}`}><Num>{p.bonuses[c]}</Num></span>}
            <Chip color={c} count={p.tokens[c]} faded={!p.tokens[c]} fly={`tok-${p.id}-${c}`} />
          </div>
        ))}
      </div>
      <div className="opp-foot">
        <span className="muted small">{tokenTotal(p.tokens)}/{MAX_TOKENS} resources · {p.cardCount} holdings</span>
        <span className="opp-reserved" data-fly={`reserve-${p.id}`}>
          {p.reserved.map((c, i) => (isHidden(c)
            ? <CardView key={`h${i}`} card={c} size="mini" />
            : <CardPeek key={c.id} card={c} fly={`card-${c.id}`} />))}
        </span>
      </div>
      {isCurrent && <div className="thinking-bar" />}
    </div>
  );
}

/** Your side of the table: prompt, renown, resource coins with your holdings, and reserved cards. */
function Dock({ dockRef, narrow, game, me, arms, myTurn, sel, update, reset, doAction, selectCard, onShowResults }: {
  dockRef: Ref<HTMLDivElement>;
  narrow: boolean;
  game: GameView;
  me: PlayerView;
  arms: Arms;
  myTurn: boolean;
  sel: Selection;
  update: (patch: Partial<Selection>) => void;
  reset: () => void;
  doAction: (action: Action) => void;
  selectCard?: (id: string) => void;
  onShowResults: () => void;
}) {
  const discarding = myTurn && game.phase === 'discard';
  const excess = tokenTotal(me.tokens) - MAX_TOKENS;
  const adjustDiscard = (c: TokenColor, delta: number) => update({ discard: { ...sel.discard, [c]: sel.discard[c] + delta } });

  return (
    <div className={cx('dock', myTurn && 'active')} ref={dockRef}>
      <div className="prompt">
        <ActionBar game={game} me={me} myTurn={myTurn} sel={sel} reset={reset} doAction={doAction} adjustDiscard={adjustDiscard} onShowResults={onShowResults} />
      </div>
      <div className="tableau">
        <div className="me-id">
          <div className="me-crest"><Crest arms={arms} size={narrow ? 44 : 72} /></div>
          <div className="me-info">
            <div className="me-name" title={me.name}>{me.name}</div>
            <div className="me-row">
              <div className="me-points" title="Your renown" data-fly={`points-${me.id}`}>
                <span key={me.points} className="pop"><Num>{me.points}{POINTS_SYMBOL}</Num></span>
                <small>/{WIN_POINTS}</small>
              </div>
              <div className="me-stats">
                <div className="stat" title={`Resources in your coffers (at most ${MAX_TOKENS})`}>
                  <span className={cx('stat-value', tokenTotal(me.tokens) >= 9 && 'warn')}>{tokenTotal(me.tokens)}<small>/{MAX_TOKENS}</small></span>
                  <span className="stat-label">Coffers</span>
                </div>
                <div className="stat" title="Places you own (each is a permanent discount)">
                  <span className="stat-value">{me.cardCount}</span>
                  <span className="stat-label">Holdings</span>
                </div>
              </div>
              {me.nobles.length > 0 && <span className="me-nobles" title="Noble houses pledged to you">{me.nobles.map((n) => <NobleView key={n.id} noble={n} size="mini" />)}</span>}
            </div>
          </div>
        </div>

        <div className="slots">
          {TOKEN_COLORS.map((c) => {
            const held = me.tokens[c] - (discarding ? sel.discard[c] : 0);
            const canDiscard = discarding && held > 0 && tokenTotal(sel.discard) < excess;
            return (
              <div className={cx('slot', c)} key={c}>
                {c === 'gold'
                  ? <div className="bonus-pile placeholder" title="Gold crowns are wild: they stand in for any resource">wild</div>
                  : <BonusPile color={c} count={me.bonuses[c]} fly={`bonus-${me.id}-${c}`} />}
                <ChipStack
                  color={c}
                  fly={`tok-${me.id}-${c}`}
                  count={held}
                  size={narrow ? 38 : 50}
                  onClick={canDiscard ? () => adjustDiscard(c, 1) : undefined}
                  title={canDiscard ? `Return one ${resource(c)}` : resource(c, 2)}
                />
                {c !== 'gold' && <div className="power" title="Buying power: holdings + coins">={me.bonuses[c] + me.tokens[c]}</div>}
              </div>
            );
          })}
        </div>

        <div className="my-reserved" aria-label="Reserved cards" data-fly={`reserve-${me.id}`}>
          {Array.from({ length: MAX_RESERVED }, (_, i) => {
            const c = me.reserved[i];
            if (!c) return <div key={`empty${i}`} className="card small reserve-slot">reserve</div>;
            if (isHidden(c)) return <CardView key={`h${i}`} card={c} size="small" />;
            return (
              <CardView
                key={c.id}
                card={c}
                size="small"
                fly={`card-${c.id}`}
                selected={sel.cardId === c.id}
                highlight={!!selectCard && !!paymentFor(me.tokens, me.bonuses, c)}
                onClick={selectCard ? () => selectCard(c.id) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The development cards you own of one color, drawn as a little pile. */
function BonusPile({ color, count, fly }: { color: Color; count: number; fly: string }) {
  return (
    <div
      data-fly={fly}
      className={cx('bonus-pile', color, !count && 'zero')}
      style={{ '--depth': Math.min(count, 5) } as CSSProperties}
      title={`${count} ${resource(color)} holding${count === 1 ? '' : 's'}: a permanent discount`}
    >
      <span key={count} className="pop"><Num>{count}</Num></span>
      <ResourceIcon color={color} />
    </div>
  );
}

function ActionBar({ game, me, myTurn, sel, reset, doAction, adjustDiscard, onShowResults }: {
  game: GameView;
  me: PlayerView;
  myTurn: boolean;
  sel: Selection;
  reset: () => void;
  doAction: (action: Action) => void;
  adjustDiscard: (c: TokenColor, delta: number) => void;
  onShowResults: () => void;
}) {
  if (game.phase === 'over') {
    return <><span>Game over.</span><button className="btn" onClick={onShowResults}>Show results</button></>;
  }
  if (!myTurn) return <span className="muted thinking">Waiting for {game.players[game.current].name}</span>;

  if (game.phase === 'discard') {
    const excess = tokenTotal(me.tokens) - MAX_TOKENS;
    const chosen = tokenTotal(sel.discard);
    return (
      <>
        <span>Your coffers are full! <b>Click your coins below</b> to return {excess - chosen > 0 ? <b>{excess - chosen} more</b> : 'them'}.</span>
        {chosen > 0 && (
          <span className="chips">
            {TOKEN_COLORS.filter((c) => sel.discard[c] > 0).map((c) => (
              <Chip key={c} color={c} count={sel.discard[c]} onClick={() => adjustDiscard(c, -1)} />
            ))}
          </span>
        )}
        <button className="btn primary" disabled={chosen !== excess} onClick={() => doAction({ type: 'discard', tokens: sel.discard })}>
          Return coins
        </button>
      </>
    );
  }

  if (game.phase === 'noble') {
    return <span>Several noble houses wish to pledge to you. <b>Pick one</b> at the top of the board.</span>;
  }

  if (sel.tokens.length) {
    return (
      <>
        <span>Take:</span>
        <span className="chips">{sel.tokens.map((c, i) => <Chip key={i} color={c} />)}</span>
        <button className="btn primary" onClick={() => doAction({ type: 'take', colors: sel.tokens })}>Take resources</button>
        <button className="btn ghost" onClick={reset}>Cancel</button>
      </>
    );
  }

  const goldNote = game.bank.gold > 0 ? ' (+1 gold crown)' : '';
  const reserveFull = me.reserved.length >= MAX_RESERVED;

  if (sel.cardId) {
    const onBoard = ([1, 2, 3] as Level[]).flatMap((l) => game.board[l]).find((c) => c?.id === sel.cardId);
    const reserved = me.reserved.find((c): c is Card => !isHidden(c) && c.id === sel.cardId);
    const card = onBoard ?? reserved;
    if (card) {
      const pay = paymentFor(me.tokens, me.bonuses, card);
      return (
        <>
          {pay ? (
            <>
              <span>Pay:</span>
              <span className="chips">
                {tokenTotal(pay) === 0
                  ? <span className="muted">free!</span>
                  : TOKEN_COLORS.filter((c) => pay[c] > 0).map((c) => <Chip key={c} color={c} count={pay[c]} />)}
              </span>
            </>
          ) : <span className="muted">You can't afford this card yet.</span>}
          <button className="btn primary" disabled={!pay} onClick={() => doAction({ type: 'buy', cardId: card.id })}>Buy</button>
          {onBoard && (
            <button className="btn" disabled={reserveFull} title={reserveFull ? 'You can hold at most 3 reserved cards' : ''}
              onClick={() => doAction({ type: 'reserve', cardId: card.id })}>
              Reserve{goldNote}
            </button>
          )}
          <button className="btn ghost" onClick={reset}>Cancel</button>
        </>
      );
    }
  }

  if (sel.deck) {
    const level = sel.deck;
    return (
      <>
        <span>Secretly reserve the top card of the tier {level} deck?</span>
        <button className="btn primary" disabled={reserveFull} onClick={() => doAction({ type: 'reserveDeck', level })}>Reserve{goldNote}</button>
        <button className="btn ghost" onClick={reset}>Cancel</button>
      </>
    );
  }

  return (
    <>
      <span><b className="accent">Your turn!</b> Take resources from the treasury, or click a card to buy or reserve it.</span>
      <button
        className="btn ghost small"
        title="Only if you can't do anything else"
        onClick={() => confirm('Pass your turn without doing anything?') && doAction({ type: 'pass' })}
      >
        Pass
      </button>
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
        <div className="results-gems">{COLORS.map((c) => <ResourceIcon key={c} color={c} />)}</div>
        <h2>{you && winners.includes(you) ? 'You win!' : `${winnerNames} win${winners.length > 1 ? '' : 's'}!`}</h2>
        <ol>
          {ranking.map((r, i) => (
            <li key={r.id} className={winners.includes(r.id) ? 'winner' : ''}>
              <span className="res-name"><Crest arms={armsOf(r.id)} size={26} />{i + 1}. {r.name}</span>
              <span><b>{r.points}{POINTS_SYMBOL}</b> · {r.cards} holdings</span>
            </li>
          ))}
        </ol>
        <p className="muted small">Ties go to the player with fewer holdings.</p>
        <div className="results-actions">
          {isHost ? <button className="btn primary" onClick={onLobby}>Back to lobby</button> : <span className="muted">Waiting for the host…</span>}
          <button className="btn ghost" onClick={onHide}>View board</button>
        </div>
      </div>
    </div>
  );
}
