import { useEffect } from 'react';
import { BONUS, COLORS, FLOOR_PENALTIES, type PlayerState } from '../shared/game';
import { GAME_NAME, colorName } from '../shared/theme';
import { Seal, Tile, PlayerBoard } from './pieces';

/** A sample board for the rule book: some rows filling, three tiles set, a broken one on the floor. */
const SAMPLE: PlayerState = {
  id: 'sample', name: 'Sample', score: 0,
  lines: [{ color: 'yellow', count: 1 }, { color: null, count: 0 }, { color: 'red', count: 2 }, { color: 'blue', count: 4 }, { color: null, count: 0 }],
  wall: [
    [false, false, false, false, false],
    [false, false, true, false, false],
    [false, false, true, true, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
  ],
  floor: ['first', 'black'],
  breakdown: { tiles: 0, broken: 0, rows: 0, columns: 0, colors: 0 },
};

/** The rules of the game, on a sheet of washi paper. */
export function RuleBook({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay rules-overlay" onClick={onClose}>
      <article className="rulebook" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Rule book">
        <header className="rules-head">
          <div>
            <div className="rules-kicker">The Rules of</div>
            <h2>{GAME_NAME}</h2>
          </div>
          <button className="btn ghost tiny" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <section>
          <h3>The aim</h3>
          <p>
            You are potters tiling the walls of a new tea house. Glazed tiles come out of the kilns a few at a time, and
            everyone wants the same colors. Score points for every tile you set, more when it joins others, and bonuses for
            finished rows, columns and glazes. Most points wins.
          </p>
          <div className="rules-tiles">
            {COLORS.map((c) => <span key={c} className="rules-tile"><Tile color={c} />{colorName(c)}</span>)}
          </div>
        </section>

        <section>
          <h3>Your board</h3>
          <div className="rules-board">
            <PlayerBoard player={SAMPLE} compact />
            <ul className="rules-list">
              <li><b>Work rows</b> on the left hold 1 to 5 tiles, each of a single glaze. Tiles gather here first.</li>
              <li><b>The wall</b> on the right: each row takes each glaze once, in its printed place.</li>
              <li><b>The floor</b> below catches tiles you can't use. Each one costs you: {FLOOR_PENALTIES.map((p) => `−${p}`).join(', ')}.</li>
            </ul>
          </div>
        </section>

        <section>
          <h3>On your turn</h3>
          <ol className="rules-actions">
            <li>
              <b>Take every tile of one glaze</b> from one kiln. The rest of that kiln slides onto the tray in the middle.
              Or take every tile of one glaze from the tray: the first to do so in a round also takes the
              master's seal <Seal />, which goes on their floor (−1) but lets them start the next round.
            </li>
            <li>
              <b>Put them all in one work row.</b> The row must be empty or already hold that glaze, and the matching wall
              row must not have that glaze yet. Whatever doesn't fit breaks on the floor. You may also drop them all on the floor.
            </li>
          </ol>
          <p>The round goes on until every kiln and the tray are empty.</p>
        </section>

        <section>
          <h3>Tiling the wall</h3>
          <p>
            At the end of each round, every <b>full</b> work row moves one tile into its place on the wall; the rest of
            that row is cleared away. Rows that aren't full keep their tiles for the next round.
          </p>
          <ul className="rules-list">
            <li>A tile with no neighbors scores <b>1</b>.</li>
            <li>Otherwise it scores the length of the <b>unbroken line</b> it joins across, plus the length of the line it joins down
              (if either is longer than itself).</li>
            <li>Then lose points for your floor. Your score never drops below zero.</li>
          </ul>
        </section>

        <section>
          <h3>The end</h3>
          <p>
            The game ends after the round in which someone finishes a whole wall row. Then each wall earns
            <b> {BONUS.row}</b> per finished row, <b>{BONUS.column}</b> per finished column, and <b>{BONUS.color}</b> for each
            glaze set all five times. On a tie, the most finished rows wins.
          </p>
        </section>

        <section className="rules-tips">
          <h3>Advice for new potters</h3>
          <ul className="rules-list">
            <li>Tap a glaze in a kiln or on the tray, then tap a glowing row of your board (or the floor).</li>
            <li>Set tiles next to each other: a tile joining a long line can be worth 5 or more.</li>
            <li>Watch what's left for your rivals: taking a glaze can leave them nothing but broken tiles.</li>
            <li>Columns are worth far more than rows at the end, and finishing a row ends the game for everyone.</li>
            <li>Bots come in three ranks: an <b>Apprentice</b> is easy, an <b>Artisan</b> a fair match, and a <b>Master</b> also plays to spoil your plans.</li>
          </ul>
        </section>

        <footer className="rules-foot">
          <button className="btn primary" onClick={onClose}>To the workshop</button>
        </footer>
      </article>
    </div>
  );
}
