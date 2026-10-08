import { useEffect } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, type Role } from '../shared/game';
import { GAME_NAME, ROLES, VILLAGE } from '../shared/theme';
import { RoleEmblem } from './pieces';

const ORDER: Role[] = ['coven', 'villager', 'seer', 'doctor', 'wisewoman', 'hunter'];

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
            A coven of witches hides among the villagers of {VILLAGE}. Each night they curse someone to death; each day the
            village hangs whoever it suspects. The <b>village</b> wins when the last witch is dead. The <b>coven</b> wins once
            it is as large as everyone else still alive. For {MIN_PLAYERS}–{MAX_PLAYERS} players; bots can fill the table.
          </p>
        </section>

        <section>
          <h3>A night and a day</h3>
          <ol className="rules-actions">
            <li><b>Night.</b> The witches choose a victim to curse together (they have their own chat). The Witchfinder questions someone; the Priest blesses someone.</li>
            <li><b>The Wise Woman</b>, told who was cursed, may save them with her one cure, and may use her one poison on anyone.</li>
            <li><b>Dawn.</b> The dead are revealed, with their roles.</li>
            <li><b>Day.</b> Everyone talks and votes. The player with the most votes is hanged and their role revealed. A tie, or more abstentions than votes for the leader, hangs no one.</li>
          </ol>
          <p className="rules-note">Every phase has a timer, so no one can stall the game. The host may close the day’s vote early. The dead see everything but cannot speak or vote.</p>
        </section>

        <section>
          <h3>The roles</h3>
          <div className="rules-roles">
            {ORDER.map((r) => (
              <div key={r} className="rules-role">
                <RoleEmblem role={r} size={52} />
                <div><h4>{ROLES[r].name}</h4><p>{ROLES[r].power}</p></div>
              </div>
            ))}
          </div>
          <p className="rules-note">The mix depends on the number of players and is shown in the lobby: one witch for 5–6 players, up to four for 15–16. The Hunter joins from 6 players, the Wise Woman from 8.</p>
        </section>

        <section className="rules-tips">
          <h3>Counsel for villagers</h3>
          <ul className="rules-list">
            <li>Watch who leads the vote, and who quietly follows it.</li>
            <li>A Witchfinder who speaks up helps the village, and becomes the coven’s next victim. Choose your moment.</li>
            <li>Witches see each other’s choices at night (the red mark on a villager).</li>
            <li>Your journal, under your role card, keeps everything only you know.</li>
          </ul>
        </section>

        <footer className="rules-foot">
          <button className="btn primary" onClick={onClose}>To the village</button>
        </footer>
      </article>
    </div>
  );
}
