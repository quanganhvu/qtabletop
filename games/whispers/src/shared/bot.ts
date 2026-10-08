// Simple bots to fill a table or test alone. They act sensibly at night and
// vote on simple suspicion by day; they say little. A bot only uses what its
// own player could know: its role, its private notes, and public information.

import { pendingActors, type Action, type GameState, type PlayerState } from './game';

export interface BotMove {
  action: Action;
  /** Something to say in the village chat first. */
  say?: string;
}

const pick = <T>(list: T[], rng: () => number): T | undefined => list[Math.floor(rng() * list.length)];

export function chooseBotMove(g: GameState, botId: string, rng: () => number = Math.random): BotMove | null {
  const me = g.players.find((p) => p.id === botId);
  if (!me?.alive || !pendingActors(g).includes(botId)) return null;
  const others = g.players.filter((p) => p.alive && p.id !== botId);
  const villagers = others.filter((p) => p.role !== 'coven');

  switch (g.phase) {
    case 'night': {
      if (me.role === 'coven') {
        // Go along with the coven if someone has already chosen.
        const chosen = Object.values(g.covenVotes).filter((id) => villagers.some((v) => v.id === id));
        const target = chosen.length ? pick(chosen, rng)! : pick(villagers, rng)!.id;
        return { action: { type: 'night', target } };
      }
      if (me.role === 'seer') {
        const seen = (g.notes[me.id] ?? []).join(' ');
        const unseen = others.filter((p) => !seen.includes(p.name));
        return { action: { type: 'night', target: pick(unseen.length ? unseen : others, rng)!.id } };
      }
      if (me.role === 'doctor') {
        const choices = g.players.filter((p) => p.alive && p.id !== g.lastProtected);
        const self = choices.find((p) => p.id === me.id);
        const target = self && rng() < 0.3 ? self : pick(choices, rng)!;
        return { action: { type: 'night', target: target.id } };
      }
      return null;
    }

    case 'brew': {
      const heal = !!g.victim && g.wise.heal && (g.victim === me.id || rng() < 0.75);
      const known = knownWitches(g, me);
      const poison = g.wise.poison && known.length ? known[0].id : null;
      return { action: { type: 'brew', heal, poison } };
    }

    case 'day': {
      // A Witchfinder who has found a witch speaks up and votes against them.
      const exposed = me.role === 'seer' ? knownWitches(g, me) : [];
      if (exposed.length) {
        const witch = exposed[0];
        const alreadySaid = g.chat.some((m) => m.from === me.id && m.text.includes(witch.name));
        return {
          action: { type: 'vote', target: witch.id },
          say: alreadySaid ? `My vote stays on ${witch.name}.` : `I am the Witchfinder. ${witch.name} is a witch, I have proof. Hang them!`,
        };
      }
      const pool = me.role === 'coven' ? villagers : others;
      const leader = leadingSuspect(g, pool);
      const target = leader && rng() < 0.7 ? leader : pick(pool, rng);
      if (!target) return { action: { type: 'vote', target: 'skip' } };
      return { action: { type: 'vote', target: target.id }, say: rng() < 0.5 ? `I vote for ${target.name}.` : undefined };
    }

    case 'hunter': {
      const suspects = me.role === 'coven' ? villagers : others;
      const target = knownWitches(g, me)[0] ?? leadingSuspect(g, suspects) ?? pick(suspects, rng);
      return target ? { action: { type: 'shoot', target: target.id } } : null;
    }

    default:
      return null;
  }
}

/** Living players this bot knows to be witches (from its own findings as Witchfinder). */
function knownWitches(g: GameState, me: PlayerState): PlayerState[] {
  const notes = (g.notes[me.id] ?? []).filter((n) => n.includes('IS a witch'));
  return g.players.filter((p) => p.alive && p.id !== me.id && notes.some((n) => n.includes(`${p.name} IS`)));
}

/** Whoever has the most votes today, among the given players. */
function leadingSuspect(g: GameState, among: PlayerState[]): PlayerState | undefined {
  const tally = new Map<string, number>();
  for (const t of Object.values(g.votes)) if (t !== 'skip') tally.set(t, (tally.get(t) ?? 0) + 1);
  let best: PlayerState | undefined;
  let most = 0;
  for (const p of among) {
    const n = tally.get(p.id) ?? 0;
    if (n > most) [best, most] = [p, n];
  }
  return best;
}
