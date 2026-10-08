import { useEffect } from 'react';
import { MEEPLES } from '../shared/game';
import { FEATURE_NAMES, GAME_NAME } from '../shared/theme';
import { Banner, TileFace } from './pieces';

/** The rules of the game, styled as a parchment booklet. */
export function RuleBook({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const f = FEATURE_NAMES;
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
            Together you lay out a medieval land, one tile at a time. Send your followers into its cities, along its roads,
            into its abbeys and onto its farms. Whoever has the most points when the last tile is laid wins.
          </p>
        </section>

        <section>
          <h3>On your turn</h3>
          <ol className="rules-actions">
            <li>
              <b>Lay your tile.</b> It must touch the land, and every edge must continue what it meets: city to city,
              road to road, meadow to meadow. Turn it until it fits. A tile that fits nowhere is set aside and another drawn.
            </li>
            <li>
              <b>You may send one follower</b> (you have {MEEPLES}) onto a feature of the tile you just laid, but only if no
              follower stands anywhere on that city, road or farm already.
            </li>
            <li><b>Score</b> any city, road or abbey your tile has finished. Followers on it come home.</li>
          </ol>
        </section>

        <section className="rules-features">
          <div className="rules-feature">
            <TileFace tile="F" size={72} />
            <div>
              <h4>Cities · {f.city.followers}</h4>
              <p>Finished when wholly walled in: <b>2 points</b> per tile and per pennant <span className="pennant-mark" />. Unfinished at the end: 1 each.</p>
            </div>
          </div>
          <div className="rules-feature">
            <TileFace tile="U" rot={1} size={72} />
            <div>
              <h4>Roads · {f.road.followers}</h4>
              <p>Finished when both ends stop at a crossroads, city, abbey or loop: <b>1 point</b> per tile, finished or not.</p>
            </div>
          </div>
          <div className="rules-feature">
            <TileFace tile="B" size={72} />
            <div>
              <h4>Abbeys · {f.cloister.followers}</h4>
              <p>Finished when all eight squares around it are filled: <b>9 points</b>. Unfinished at the end: 1 for itself and 1 per neighbor.</p>
            </div>
          </div>
          <div className="rules-feature">
            <TileFace tile="E" size={72} />
            <div>
              <h4>Farms · {f.field.followers} <Banner seat={3} size={18} leaning /></h4>
              <p>
                A farmer's banner leans in its meadow and stays there for good. At the end, the farm scores <b>3 points</b> for every
                <i> finished</i> city it touches. Roads and city walls divide meadows.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3>Sharing</h3>
          <p>
            You can't send a follower onto a feature someone holds, but two features may later join into one. Then whoever
            has the <b>most followers</b> on it takes all the points; on a tie, each of them scores in full.
          </p>
        </section>

        <section className="rules-tips">
          <h3>Counsel for new lords</h3>
          <ul className="rules-list">
            <li>Choose a glowing square to lay your tile. Brighter squares fit the tile the way it is turned now.</li>
            <li>Turn the tile with the arrows, by clicking it again, or with <b>R</b>. Then tap a circle to send a follower.</li>
            <li>Drag to move around the land; pinch, scroll or use + and − to zoom.</li>
            <li>Keep a follower or two in hand: they are no use stuck in a city that will never close.</li>
            <li>Bots come in three ranks: a <b>Squire</b> is easy, a <b>Knight</b> a fair match, and a <b>Lord</b> plays its best every turn.</li>
          </ul>
        </section>

        <footer className="rules-foot">
          <button className="btn primary" onClick={onClose}>To the table</button>
        </footer>
      </article>
    </div>
  );
}
