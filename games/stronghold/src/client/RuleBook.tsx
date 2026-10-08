import { useEffect } from 'react';
import { COLORS, MAX_RESERVED, MAX_TOKENS, WIN_POINTS, emptyGems, type Card } from '../shared/game';
import { HOUSE_ARMS } from '../shared/heraldry';
import { GAME_NAME, POINTS_SYMBOL, RESOURCES, TIER_NAMES } from '../shared/theme';
import { CardView, Crest, ResourceIcon } from './pieces';

// An example card for the "anatomy of a card" figure: the Tavern, 2 renown,
// gives a wine discount, costs 2 stone + 4 wine + 1 iron.
const EXAMPLE: Card = { id: 'rulebook-example', level: 2, color: 'red', points: 2, cost: { ...emptyGems(), white: 2, red: 4, black: 1 } };

/** The rules of the game, styled as a parchment booklet. */
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
            You are a lord or lady raising a realm. Gather resources, acquire <b>holdings</b> (the cards),
            and win the allegiance of the great <b>noble houses</b>. The first to reach <b>{WIN_POINTS} renown {POINTS_SYMBOL}</b> ends
            the game, and the round is finished so everyone has had the same number of turns.
          </p>
        </section>

        <section>
          <h3>Resources</h3>
          <div className="rules-resources">
            {COLORS.map((c) => (
              <div key={c} className="rules-res"><ResourceIcon color={c} /><span>{RESOURCES[c].name}</span></div>
            ))}
            <div className="rules-res wild"><ResourceIcon color="gold" /><span>gold crown · wild</span></div>
          </div>
          <p>
            Resources are the coins in the treasury. A <b>gold crown</b> can stand in for any resource. You only get crowns by
            reserving a card.
          </p>
        </section>

        <section className="rules-anatomy">
          <div className="anatomy-card"><CardView card={EXAMPLE} /></div>
          <div>
            <h3>Reading a card</h3>
            <ul className="rules-list">
              <li><b>Top left:</b> the renown it is worth ({EXAMPLE.points} here). Many cheap cards are worth none.</li>
              <li><b>Top right:</b> the resource it <i>produces</i>. Each holding is a permanent discount of one of that resource on every later purchase.</li>
              <li><b>Bottom left:</b> its price. This Tavern costs 2 stone, 4 wine and 1 iron. The circles list resources in the same order as the treasury.</li>
              <li><b>Tiers:</b> {TIER_NAMES[1]} (I) cards are cheap, {TIER_NAMES[2]} (II) cards are middling, {TIER_NAMES[3]} (III) cards are costly but rich in renown.</li>
            </ul>
          </div>
        </section>

        <section>
          <h3>On your turn, do one thing</h3>
          <ol className="rules-actions">
            <li><b>Take three different resources</b> from the treasury.</li>
            <li><b>Take two of the same resource</b>, but only if at least four of it are left.</li>
            <li>
              <b>Reserve a card</b>: take a card from the table, or the top card of a deck unseen, into your hand
              (at most {MAX_RESERVED}), and receive a gold crown if any remain. Only you can buy it later.
            </li>
            <li>
              <b>Buy a card</b> from the table or from your reserve. Your holdings reduce the price; pay the rest in resources,
              using crowns for anything you lack. Spent resources return to the treasury.
            </li>
          </ol>
          <p className="rules-note">You may never hold more than <b>{MAX_TOKENS} resources</b>. If you go over, return the extras at once.</p>
        </section>

        <section className="rules-nobles">
          <div className="rules-crests">
            {HOUSE_ARMS.slice(0, 3).map((a, i) => <Crest key={i} arms={a} size={44} />)}
          </div>
          <div>
            <h3>The noble houses</h3>
            <p>
              Each house asks for a certain number of holdings of particular resources (shown beside its shield). At the end
              of your turn, if you meet a house's demand it pledges allegiance to you automatically, worth <b>3 renown</b>.
              It costs nothing and is not an action. Should two houses qualify at once, you choose one.
            </p>
          </div>
        </section>

        <section>
          <h3>Winning</h3>
          <p>
            When someone reaches {WIN_POINTS} renown, play continues until the round is complete. The highest renown wins;
            on a tie, the player with <b>fewer holdings</b> wins.
          </p>
        </section>

        <section className="rules-tips">
          <h3>Counsel for new rulers</h3>
          <ul className="rules-list">
            <li>Early on, cheap holdings matter more than renown: every discount compounds.</li>
            <li>Watch which resources the noble houses want, and build toward two of them at once.</li>
            <li>Reserve a valuable card an opponent is about to buy: it denies them and earns you a crown.</li>
            <li>Green-ringed cards are ones you can afford right now.</li>
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
