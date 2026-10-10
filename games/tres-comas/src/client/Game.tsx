import { useEffect, useState, type CSSProperties } from 'react';
import {
  CHAINS, MAX_BUY, SAFE_SIZE, TIER, actorIndex, adjacentChains, bonusesFor, canDeclareEnd, chainSizes, priceFor, tileLabel, tileStatus,
  type Action, type Chain, type GameView, type PlayerView, type Shares,
} from '../shared/game';
import type { ClientMessage, RoomInfo } from '../shared/protocol';
import { BOT_LEVEL_INFO } from '../shared/botLevels';
import { CHAIN_INFO, GAME_NAME, PLAYER_COLORS, TIER_NAMES, chainName, money } from '../shared/theme';
import { Board, type Merging } from './Board';
import { MergeBanner } from './MergeBanner';
import { Change, Sparkline, TickerTape, usePriceHistory, type History } from './market';
import { chainStyle, cx } from './ui';
import { getFlatBoard, setFlatBoard } from './identity';
import { RuleBook } from './RuleBook';

export function Game({ room, game, you, act, send, leave }: {
  room: RoomInfo;
  game: GameView;
  you: string | null;
  act: (action: Action) => void;
  send: (msg: ClientMessage) => void;
  leave: () => void;
  notify: (msg: string) => void;
}) {
  const meIndex = game.players.findIndex((p) => p.id === you);
  const me = meIndex === -1 ? null : game.players[meIndex];
  const actor = game.phase === 'over' ? -1 : actorIndex(game);
  const myMove = !!me && actor === meIndex;
  const isHost = room.hostId === you;
  const history = usePriceHistory(game, room.code);
  const seat = (id: string) => room.players.find((p) => p.id === id);
  const sizes = chainSizes(game.board);

  // The shopping cart for the buy step is discarded whenever the turn or phase moves on.
  const key = `${game.turn}:${game.phase}`;
  const [rawCart, setCart] = useState<{ key: string; shares: Partial<Shares> }>({ key, shares: {} });
  const cart = rawCart.key === key ? rawCart.shares : {};
  const [hoverTile, setHoverTile] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [flat, setFlatState] = useState(getFlatBoard);
  const toggleFlat = () => {
    setFlatBoard(!flat);
    setFlatState(!flat);
  };
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showResults, setShowResults] = useState(true);

  useEffect(() => {
    document.title = myMove ? `● Your move · ${GAME_NAME}` : GAME_NAME;
  }, [myMove]);

  const myTiles = new Set(me?.tiles ?? []);
  const placing = myMove && game.phase === 'place';
  const buying = myMove && game.phase === 'buy';
  const cartCount = Object.values(cart).reduce((a, b) => a + (b ?? 0), 0);
  const cartCost = CHAINS.reduce((sum, c) => sum + (cart[c] ?? 0) * priceFor(c, sizes[c]), 0);

  const addToCart = (chain: Chain, delta: number) => {
    const n = (cart[chain] ?? 0) + delta;
    if (n < 0 || !me) return;
    if (delta > 0) {
      if (cartCount >= MAX_BUY || n > game.bank[chain] || cartCost + priceFor(chain, sizes[chain]) > me.cash) return;
    }
    setCart({ key, shares: { ...cart, [chain]: n } });
  };

  // While a merger is open, the board shows who is taking over whom.
  const merging: Merging | null = game.merger
    ? { tile: game.merger.tile, acquirers: [game.merger.survivor], doomed: game.merger.defuncts }
    : game.phase === 'survivor' && game.pending
      ? {
        tile: game.pending.tile,
        acquirers: game.pending.options,
        doomed: adjacentChains(game.board, game.pending.tile).filter((c) => !game.pending!.options.includes(c)),
      }
      : null;

  const placeTile = (t: number) => {
    if (placing && myTiles.has(t) && tileStatus(game.board, t) === 'ok') act({ type: 'place', tile: t });
  };

  const leaveGame = () => {
    const sure = !me || game.phase === 'over'
      || confirm('Leave the game? A bot will take over your seat so the others can finish. You can rejoin later with the room link.');
    if (sure) leave();
  };
  const endGame = () => {
    if (confirm('End this game for everyone and return to the lobby?')) send({ type: 'endGame' });
  };

  return (
    <div className={cx('game', myMove && 'my-move')}>
      <header className="topbar">
        <div className="brand"><Logo /> <span>{GAME_NAME}</span> <span className="room-tag">{room.code}</span></div>
        <div key={game.log.length} className="ticker">{game.log[game.log.length - 1]}</div>
        <div className="status"><Status game={game} meIndex={meIndex} /></div>
        <button className="btn ghost small" onClick={toggleFlat} title={flat ? 'Show the board in 3D' : 'Show the board flat'}>{flat ? '3D' : '2D'}</button>
        <button className="btn ghost small" onClick={() => setRulesOpen(true)}>Rules</button>
        <button className="btn ghost small" onClick={() => setLogOpen(!logOpen)}>Log</button>
        {isHost && game.phase !== 'over' && <button className="btn ghost small" onClick={endGame}>End game</button>}
        <button className="btn ghost small" onClick={leaveGame}>Leave</button>
      </header>
      <TickerTape game={game} history={history} />

      <div className="arena">
        <main className="board-wrap">
          <Board
            board={game.board}
            myTiles={myTiles}
            placing={placing}
            lastTile={game.lastTile}
            hoverTile={hoverTile}
            merging={merging}
            flat={flat}
            onPlace={placeTile}
            onHover={setHoverTile}
          />
          <MergeBanner game={game} you={you} />
          <div className="board-foot muted small">
            {game.bagCount} tiles left in the bag
            {canDeclareEnd(game.board) && game.phase !== 'over' && <span className="pill warn">The game can now be declared over</span>}
          </div>
        </main>

        <aside className="side">
          <ChainTable game={game} me={me} history={history} cart={cart} buying={buying} onCart={addToCart} />
          <section className="players">
            {game.players.map((p, i) => (
              <PlayerRow
                key={p.id}
                player={p}
                color={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                you={p.id === you}
                acting={actor === i}
                seat={seat(p.id)}
                canClaim={!me && !!seat(p.id) && (!seat(p.id)!.connected || !!seat(p.id)!.left)}
                onClaim={() => send({ type: 'claimSeat', seatId: p.id })}
              />
            ))}
          </section>
        </aside>
      </div>

      <footer className="dock">
        {me ? (
          <>
            <div className="hand">
              <div className="dock-label">Your tiles</div>
              <div className="hand-tiles">
                {me.tiles!.map((t) => {
                  const status = tileStatus(game.board, t);
                  return (
                    <button
                      key={t}
                      className={cx('tile', status !== 'ok' && status, placing && status === 'ok' && 'playable')}
                      disabled={!placing || status !== 'ok'}
                      title={status === 'dead' ? 'Can never be played: it would merge two startups too big to buy' : status === 'blocked' ? 'Unplayable for now: all seven startups are on the board' : undefined}
                      onClick={() => placeTile(t)}
                      onMouseEnter={() => setHoverTile(t)}
                      onMouseLeave={() => setHoverTile(null)}
                    >
                      {tileLabel(t)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="decision">
              <Decision game={game} me={me} myMove={myMove} act={act} cart={cart} cartCost={cartCost} cartCount={cartCount} />
            </div>
          </>
        ) : (
          <div className="decision muted">You are watching. Take the seat of a player who left to join in.</div>
        )}
      </footer>

      {logOpen && (
        <div className="drawer" role="log">
          <div className="drawer-head"><h3>Game log</h3><button className="btn tiny ghost" onClick={() => setLogOpen(false)}>✕</button></div>
          <ol>{[...game.log].reverse().map((line, i) => <li key={game.log.length - i}>{line}</li>)}</ol>
        </div>
      )}
      {rulesOpen && <RuleBook onClose={() => setRulesOpen(false)} />}
      {game.phase === 'over' && game.results && showResults && (
        <Results game={game} you={you} isHost={isHost} onClose={() => setShowResults(false)} send={send} />
      )}
      {game.phase === 'over' && !showResults && (
        <button className="btn primary results-reopen" onClick={() => setShowResults(true)}>Final standings</button>
      )}
    </div>
  );
}

function Logo() {
  return (
    <img className="brand-emblem" src="/tres-comas.svg" alt="" width={30} height={30} />
  );
}

function Status({ game, meIndex }: { game: GameView; meIndex: number }) {
  if (game.phase === 'over') return <span className="pill">Game over</span>;
  const i = actorIndex(game);
  const name = game.players[i].name;
  if (i === meIndex) return <span className="pill turn">Your move</span>;
  const doing: Record<string, string> = {
    place: 'is playing a tile',
    found: 'is founding a startup',
    survivor: 'is choosing the buyer',
    merge: `is settling ${game.merger ? chainName(game.merger.defuncts[0]) : ''} shares`,
    buy: 'is buying shares',
  };
  return <span className="pill">{name} {doing[game.phase]}</span>;
}

function ChainTable({ game, me, history, cart, buying, onCart }: {
  history: History;
  game: GameView;
  me: PlayerView | null;
  cart: Partial<Shares>;
  buying: boolean;
  onCart: (chain: Chain, delta: number) => void;
}) {
  const sizes = chainSizes(game.board);
  return (
    <section className="chains">
      <div className="market-head">
        <span className="market-title">Startup exchange</span>
        <span className="market-live"><i />live</span>
      </div>
      <table className="market">
        <thead>
          <tr>
            <th>Stock</th><th className="num">Price</th><th className="chart-col">Trend</th>
            {me && <th className="num" title="Your shares">You</th>}<th className="num" title="Majority / minority shareholder bonus if it's acquired">Bonus</th>{buying && <th>Buy</th>}
          </tr>
        </thead>
        <tbody>
          {CHAINS.map((c) => {
            const size = sizes[c];
            const price = priceFor(c, size || 2);
            const bonuses = bonusesFor(game.players, c, price);
            const myBonus = me && bonuses.find((b) => b.id === me.id);
            const series = history[c];
            return (
              <tr key={c} className={cx(!size && 'inactive')} style={chainStyle(c)}>
                <td>
                  <span className="chain-name">
                    <span className="logo" style={{ color: CHAIN_INFO[c].ink }} aria-hidden="true">{chainName(c)[0]}</span>
                    <span className="sym">{CHAIN_INFO[c].ticker}</span>
                    {size >= SAFE_SIZE && <span className="safe" title="Too big to buy: 11+ tiles, can't be acquired">TOO BIG</span>}
                  </span>
                  <span className="tier">{chainName(c)} · {size ? `${size} offices` : 'not listed'} · {TIER_NAMES[TIER[c]]}</span>
                </td>
                <td className="num price-cell">
                  {size
                    ? <><b key={price} className="px flash">{money(price)}</b><Change series={series} /></>
                    : <><span className="px muted">{money(price)}</span><span className="chg ipo-pending">IPO price</span></>}
                  <span className="bank" title="Shares left in the bank">{game.bank[c]} left</span>
                </td>
                <td className="chart-col">{size ? <Sparkline series={series} /> : null}</td>
                {me && <td className={cx('num', myBonus && 'leading')} title={myBonus ? `You'd get ${money(myBonus.amount)} if it were acquired now` : undefined}>{me.shares[c] || ''}</td>}
                <td className="num bonus">{money(price * 10)}<span className="muted"> / {money(price * 5)}</span></td>
                {buying && (
                  <td className="stepper">
                    {size > 0 && (
                      <>
                        <button className="btn tiny" onClick={() => onCart(c, -1)} disabled={!cart[c]} aria-label={`One less ${chainName(c)}`}>−</button>
                        <span>{cart[c] ?? 0}</span>
                        <button className="btn tiny" onClick={() => onCart(c, 1)} aria-label={`One more ${chainName(c)}`}>+</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function PlayerRow({ player, color, you, acting, seat, canClaim, onClaim }: {
  player: PlayerView;
  color: string;
  you: boolean;
  acting: boolean;
  seat: RoomInfo['players'][number] | undefined;
  canClaim: boolean;
  onClaim: () => void;
}) {
  const held = CHAINS.filter((c) => player.shares[c] > 0);
  return (
    <div className={cx('player', acting && 'acting', you && 'you', seat && !seat.connected && 'offline')} style={{ '--player': color } as CSSProperties}>
      <div className="player-head">
        <span className="dot" />
        <span className="player-name">{player.name}{you && <span className="muted"> (you)</span>}</span>
        {seat?.bot && <span className="tag muted">{seat.left ? 'bot stand-in' : `bot · ${BOT_LEVEL_INFO[seat.level ?? 'normal'].rank}`}</span>}
        {seat && !seat.connected && <span className="tag muted">offline</span>}
        {canClaim && <button className="btn tiny" onClick={onClaim}>Take seat</button>}
        <span className="cash">{money(player.cash)}</span>
      </div>
      <div className="holdings">
        {held.length ? held.map((c) => (
          <span key={c} className="share-chip" style={chainStyle(c)} title={`${player.shares[c]} ${chainName(c)}`}>
            {chainName(c)[0]}<b>{player.shares[c]}</b>
          </span>
        )) : <span className="muted small">No shares</span>}
        <span className="muted small tiles-count">{player.tileCount} tiles</span>
      </div>
    </div>
  );
}

function Decision({ game, me, myMove, act, cart, cartCost, cartCount }: {
  game: GameView;
  me: PlayerView;
  myMove: boolean;
  act: (action: Action) => void;
  cart: Partial<Shares>;
  cartCost: number;
  cartCount: number;
}) {
  if (game.phase === 'over') return <p className="muted">The game is over.</p>;
  if (!myMove) {
    if (game.phase === 'merge' && game.merger && me.shares[game.merger.defuncts[0]] > 0) {
      return <p className="muted">An acquisition is under way. You'll decide on your {chainName(game.merger.defuncts[0])} shares when it's your turn.</p>;
    }
    return <p className="muted">Waiting for {game.players[actorIndex(game)].name}…</p>;
  }

  switch (game.phase) {
    case 'place':
      return <p><strong>Play a tile.</strong> <span className="muted">Click one of your tiles, here or on the board.</span></p>;

    case 'found':
      return (
        <div className="choice">
          <p><strong>You founded a startup!</strong> <span className="muted">Pick which one. You get a free founder's share.</span></p>
          <div className="chain-buttons">
            {game.pending!.options.map((c) => (
              <button key={c} className="btn chain-btn" style={chainStyle(c)} onClick={() => act({ type: 'found', chain: c })}>
                {chainName(c)} <span className="tier">{TIER_NAMES[TIER[c]]} · {CHAIN_INFO[c].look}</span>
              </button>
            ))}
          </div>
        </div>
      );

    case 'survivor':
      return (
        <div className="choice">
          <p><strong>The startups are tied.</strong> <span className="muted">Pick the one that buys the other out.</span></p>
          <div className="chain-buttons">
            {game.pending!.options.map((c) => (
              <button key={c} className="btn chain-btn" style={chainStyle(c)} onClick={() => act({ type: 'survivor', chain: c })}>{chainName(c)}</button>
            ))}
          </div>
        </div>
      );

    case 'merge':
      return <MergeChoice key={game.merger!.defuncts[0]} game={game} me={me} act={act} />;

    case 'buy': {
      const canEnd = canDeclareEnd(game.board);
      return (
        <div className="choice">
          <p>
            <strong>Buy up to {MAX_BUY} shares</strong> <span className="muted">with the + buttons in the startup table.</span>
            {cartCount > 0 && <> Total: <strong>{money(cartCost)}</strong></>}
          </p>
          <div className="row-buttons">
            <button className="btn primary" onClick={() => act({ type: 'buy', shares: cart })}>
              {cartCount ? `Buy ${cartCount} & end turn` : 'End turn'}
            </button>
            {canEnd && (
              <button
                className="btn danger"
                onClick={() => confirm('Declare the game over? Final bonuses are paid and all shares sold.') && act({ type: 'buy', shares: cart, end: true })}
              >
                {cartCount ? 'Buy & end the game' : 'End the game'}
              </button>
            )}
          </div>
        </div>
      );
    }
  }
}

function MergeChoice({ game, me, act }: { game: GameView; me: PlayerView; act: (action: Action) => void }) {
  const m = game.merger!;
  const defunct = m.defuncts[0];
  const held = me.shares[defunct];
  const price = priceFor(defunct, chainSizes(game.board)[defunct]);
  const maxTrade = Math.min(Math.floor(held / 2), game.bank[m.survivor]) * 2;
  const [sell, setSell] = useState(0);
  const [trade, setTrade] = useState(0);
  const keep = held - sell - trade;

  return (
    <div className="choice merge-choice">
      <p>
        <strong style={chainStyle(defunct)} className="chain-text">{chainName(defunct)}</strong> is merging into{' '}
        <strong style={chainStyle(m.survivor)} className="chain-text">{chainName(m.survivor)}</strong>.
        You hold <strong>{held}</strong> {held === 1 ? 'share' : 'shares'} worth {money(price)} each.
      </p>
      <div className="merge-rows">
        <Counter label="Sell" value={sell} hint={money(sell * price)} onChange={(v) => setSell(Math.max(0, Math.min(v, held - trade)))} />
        <Counter label="Trade 2:1" value={trade} step={2} hint={`→ ${trade / 2} ${chainName(m.survivor)}`} onChange={(v) => setTrade(Math.max(0, Math.min(v, maxTrade, evenFloor(held - sell))))} />
        <div className="counter"><span className="counter-label">Keep</span><span className="counter-value">{keep}</span></div>
      </div>
      <div className="row-buttons">
        <button className="btn ghost small" onClick={() => { setTrade(0); setSell(held); }}>Sell all</button>
        {maxTrade > 0 && <button className="btn ghost small" onClick={() => { setTrade(maxTrade); setSell(held - maxTrade); }}>Trade max, sell rest</button>}
        <button className="btn primary" onClick={() => act({ type: 'dispose', sell, trade })}>Confirm</button>
      </div>
    </div>
  );
}

const evenFloor = (n: number) => n - (n % 2);

function Counter({ label, value, step = 1, hint, onChange }: { label: string; value: number; step?: number; hint: string; onChange: (v: number) => void }) {
  return (
    <div className="counter">
      <span className="counter-label">{label}</span>
      <button className="btn tiny" onClick={() => onChange(value - step)} aria-label={`${label} fewer`}>−</button>
      <span className="counter-value">{value}</span>
      <button className="btn tiny" onClick={() => onChange(value + step)} aria-label={`${label} more`}>+</button>
      <span className="muted small">{hint}</span>
    </div>
  );
}

function Results({ game, you, isHost, onClose, send }: {
  game: GameView;
  you: string | null;
  isHost: boolean;
  onClose: () => void;
  send: (msg: ClientMessage) => void;
}) {
  const r = game.results!;
  const won = !!you && r.winners.includes(you);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal results" onClick={(e) => e.stopPropagation()}>
        <h2>{won ? 'You win!' : 'Final standings'}</h2>
        <ol className="ranking">
          {r.ranking.map((p, i) => (
            <li key={p.id} className={cx(r.winners.includes(p.id) && 'winner', p.id === you && 'you')}>
              <span className="rank">{i + 1}</span>
              <span className="player-name">{p.name}</span>
              <span className="muted small">bonuses {money(r.payouts[p.id].bonuses)} · shares sold {money(r.payouts[p.id].sales)}</span>
              <span className="cash">{money(p.cash)}</span>
            </li>
          ))}
        </ol>
        <div className="row-buttons">
          <button className="btn ghost" onClick={onClose}>View board</button>
          {isHost && <button className="btn primary" onClick={() => send({ type: 'backToLobby' })}>Back to lobby</button>}
        </div>
      </div>
    </div>
  );
}
