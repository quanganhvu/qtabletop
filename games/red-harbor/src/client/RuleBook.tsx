import { useEffect } from 'react';
import { LOAN_AMOUNT, LOAN_PENALTY, LOAN_REPAY, SHIP_ENERGY, SHIP_INFO, SHIP_KINDS, TURNS_PER_ROUND } from '../shared/data';
import { BASIC, FOOD, ENERGY, FOOD_GOODS, FUEL_GOODS, UPGRADE_OF, type Good } from '../shared/goods';
import { GoodIcon, MODULE_ICON } from './pieces';
import { FRANC, GAME_NAME, GOOD_NAMES } from '../shared/theme';

export function RuleBook({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const per = (goods: readonly Good[], table: Partial<Record<Good, number>>) => (
    <span className="rule-goods">
      {goods.map((g) => <span key={g} className="bag-item"><GoodIcon good={g} size={18} /> {table[g]}</span>)}
    </span>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <article className="panel rulebook" onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost tiny close" onClick={onClose} aria-label="Close">✕</button>
        <h2>How to play {GAME_NAME}</h2>
        <p className="lead">You run a corporation in the first colony on Mars. The richest corporation at the end wins: credits, plus the value of your modules and rockets, minus {LOAN_PENALTY}{FRANC} for every unpaid loan.</p>

        <h3>A turn</h3>
        <ol>
          <li><b>Supply drop.</b> The supply shuttle moves to the next spot in orbit and drops 1 of each of the two goods shown onto the landing pads. A spot marked % charges <b>interest</b>: everyone with a loan pays 1{FRANC}.</li>
          <li><b>One main action</b>, either:
            <ul>
              <li><b>Take a landing pad:</b> every good piled on it. Drag the pad onto your dock, or click it.</li>
              <li><b>Use a module:</b> send your engineer into it (drag, or click the module) and use its effect. Pay its entry fee unless it's yours; fees go to the owner. You can't enter a module where another engineer is working, or stay where you are.</li>
            </ul>
          </li>
          <li><b>Any time on your turn:</b> buy a module (from the Colony Authority, or the top of a blueprint stack) or a rocket for its value; sell one to the colony for half; take a loan (+{LOAN_AMOUNT}{FRANC}) or repay one ({LOAN_REPAY}{FRANC}).</li>
        </ol>

        <h3>Sol cycles</h3>
        <p>A cycle is {TURNS_PER_ROUND} turns, passing around the table. At its end:</p>
        <ol>
          <li><b>Greenhouse yield</b> (most cycles): 1+ crops grow 1 more; 2+ insect colonies breed 1 more.</li>
          <li><b>Life support:</b> every corporation supplies the food shown on the cycle card, less what its rockets bring in. Anything you can't supply becomes loans.</li>
          <li>On some cycles the <b>Colony Authority builds</b> the lowest-numbered blueprint. Then a new <b>rocket lands</b> at the spaceport, ready to buy or assemble.</li>
        </ol>
        <p>After the last cycle, everyone takes <b>one final action</b> and may enter any module, occupied or not.</p>

        <h3>Resources</h3>
        <p>Each raw resource has a refined form you make in modules:</p>
        <ul className="rule-chain">
          {BASIC.map((g) => (
            <li key={g}><GoodIcon good={g} size={18} /> {GOOD_NAMES[g][1]} → <GoodIcon good={UPGRADE_OF[g]} size={18} /> {GOOD_NAMES[UPGRADE_OF[g]][1]}</li>
          ))}
        </ul>
        <p><b>Food:</b> {per(FOOD_GOODS, FOOD)}</p>
        <p><b>Energy:</b> {per(FUEL_GOODS, ENERGY)}</p>
        <p>Resources are worth nothing at the end. Turn them into modules, rockets or credits; the Earth Export Line pays their credit value.</p>

        <h3>Modules</h3>
        <p>Construction bays build the top blueprint of a stack, paid for in materials (biomass, regolith, blocks, iron ore, steel). Each card shows its materials, entry fee and value. Module types {MODULE_ICON.craft} workshop, {MODULE_ICON.industry} industry and {MODULE_ICON.fishing} farm boost other modules.</p>

        <h3>Rockets</h3>
        <ul>
          {SHIP_KINDS.map((k) => (
            <li key={k}><b>{SHIP_INFO[k].name}</b>: worth {SHIP_INFO[k].value}{FRANC}, brings {SHIP_INFO[k].food} food each cycle{SHIP_INFO[k].capacity ? `, exports ${SHIP_INFO[k].capacity} goods` : ''}. A launch pad assembles one from {Object.entries(SHIP_INFO[k].materials).map(([g, n]) => `${n} ${GOOD_NAMES[g as Good][1]}`).join(', ')} and {SHIP_ENERGY} energy.</li>
          ))}
        </ul>
        <p className="muted small">Game engine inspired by Uwe Rosenberg's Le Havre.</p>
      </article>
    </div>
  );
}
