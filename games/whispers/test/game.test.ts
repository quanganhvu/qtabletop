import { describe, expect, it } from 'vitest';
import {
  DAY_MS, NIGHT_MS, RuleError, applyAction, closeVote, createGame, pendingActors, rolesFor, tick, viewFor,
  type GameState, type Role,
} from '../src/shared/game';
import { chooseBotMove } from '../src/shared/bot';

function seeded(seed = 7) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const T0 = 1_000_000;

/** A game whose seats have chosen roles: a, b, c, ... in order. */
function table(roles: Role[]): GameState {
  const g = createGame(roles.map((_, i) => ({ id: 'abcdefghijklmnop'[i], name: 'ABCDEFGHIJKLMNOP'[i] })), seeded(), T0);
  g.players.forEach((p, i) => (p.role = roles[i]));
  g.notes = {};
  return g;
}

const act = (g: GameState, id: string, action: Parameters<typeof applyAction>[2]) => applyAction(g, id, action, T0, seeded());
const alive = (g: GameState) => g.players.filter((p) => p.alive).map((p) => p.id).join('');

describe('setup', () => {
  it('scales the roles with the table', () => {
    const count = (n: number) => rolesFor(n).reduce<Record<string, number>>((c, r) => ({ ...c, [r]: (c[r] ?? 0) + 1 }), {});
    expect(count(5)).toEqual({ coven: 1, seer: 1, doctor: 1, villager: 2 });
    expect(count(6)).toEqual({ coven: 1, seer: 1, doctor: 1, hunter: 1, villager: 2 });
    expect(count(8)).toEqual({ coven: 2, seer: 1, doctor: 1, hunter: 1, wisewoman: 1, villager: 2 });
    expect(count(16).coven).toBe(4);
    for (let n = 5; n <= 16; n++) expect(rolesFor(n)).toHaveLength(n);
  });

  it('starts at night and tells each witch their coven', () => {
    const g = createGame('abcdefgh'.split('').map((id) => ({ id, name: id.toUpperCase() })), seeded(), T0);
    expect(g.phase).toBe('night');
    expect(g.deadline).toBe(T0 + NIGHT_MS);
    const coven = g.players.filter((p) => p.role === 'coven');
    expect(g.notes[coven[0].id][0]).toContain(coven[1].name);
  });
});

describe('night', () => {
  // a: witch, b: Witchfinder, c: Priest, d, e: villagers
  const five = () => table(['coven', 'seer', 'doctor', 'villager', 'villager']);

  it('the coven’s curse kills at dawn', () => {
    const g = five();
    act(g, 'a', { type: 'night', target: 'd' });
    act(g, 'b', { type: 'night', target: 'a' });
    act(g, 'c', { type: 'night', target: 'e' });
    expect(g.phase).toBe('day');
    expect(alive(g)).toBe('abce');
    expect(g.events.at(-1)).toMatchObject({ kind: 'dawn', deaths: [{ id: 'd', role: 'villager', cause: 'curse' }] });
  });

  it('the Witchfinder learns the truth privately', () => {
    const g = five();
    act(g, 'b', { type: 'night', target: 'a' });
    expect(g.notes.b[0]).toContain('A IS a witch');
    expect(viewFor(g, 'b').visions).toEqual({ a: true });
    expect(viewFor(g, 'a').visions).toEqual({});
    expect(viewFor(g, 'b').notes).toHaveLength(1);
    expect(viewFor(g, 'd').notes).toHaveLength(0);
  });

  it('the Priest’s blessing saves the victim, but not the same player two nights running', () => {
    const g = five();
    act(g, 'a', { type: 'night', target: 'd' });
    act(g, 'b', { type: 'night', target: 'e' });
    act(g, 'c', { type: 'night', target: 'd' });
    expect(alive(g)).toBe('abcde');
    expect(g.events.at(-1)).toMatchObject({ kind: 'dawn', deaths: [] });
    closeVote(g, T0);
    expect(() => act(g, 'c', { type: 'night', target: 'd' })).toThrow(RuleError);
  });

  it('the coven may not curse its own, and villagers have nothing to do', () => {
    const g = table(['coven', 'coven', 'seer', 'doctor', 'villager', 'villager', 'villager']);
    expect(() => act(g, 'a', { type: 'night', target: 'b' })).toThrow(/own/);
    expect(() => act(g, 'e', { type: 'night', target: 'a' })).toThrow(RuleError);
    expect(pendingActors(g).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('the Wise Woman can cure the victim once and poison once', () => {
    // a, b: coven; c: Witchfinder; d: Priest; e: Hunter; f: Wise Woman; g, h: villagers
    const g = table(['coven', 'coven', 'seer', 'doctor', 'hunter', 'wisewoman', 'villager', 'villager']);
    act(g, 'a', { type: 'night', target: 'g' });
    act(g, 'b', { type: 'night', target: 'g' });
    act(g, 'c', { type: 'night', target: 'a' });
    act(g, 'd', { type: 'night', target: 'd' });
    expect(g.phase).toBe('brew');
    expect(viewFor(g, 'f').wise).toMatchObject({ victim: 'g', heal: true, poison: true });
    expect(viewFor(g, 'g').wise).toBeNull();
    act(g, 'f', { type: 'brew', heal: true, poison: 'a' });
    expect(g.phase).toBe('day');
    expect(alive(g)).toBe('bcdefgh');
    expect(g.wise).toMatchObject({ heal: false, poison: false });
  });

  it('a phase ends on its own at the deadline', () => {
    const g = five();
    act(g, 'a', { type: 'night', target: 'e' });
    expect(tick(g, T0 + NIGHT_MS - 1, seeded())).toBe(false);
    expect(tick(g, T0 + NIGHT_MS, seeded())).toBe(true);
    expect(g.phase).toBe('day');
    expect(alive(g)).toBe('abcd');
  });
});

describe('day', () => {
  const morning = () => {
    const g = table(['coven', 'seer', 'doctor', 'villager', 'villager', 'villager', 'villager']);
    tick(g, T0 + NIGHT_MS, seeded()); // a quiet night: no one acted
    return g;
  };

  it('the most votes is hanged and the role revealed', () => {
    const g = morning();
    for (const v of 'bcdef') act(g, v, { type: 'vote', target: 'a' });
    act(g, 'a', { type: 'vote', target: 'b' });
    act(g, 'g', { type: 'vote', target: 'b' });
    expect(g.phase).toBe('over');
    expect(g.winner).toBe('village');
    expect(g.events.find((e) => e.kind === 'lynch')).toMatchObject({ id: 'a', role: 'coven' });
  });

  it('a tie, or more abstentions than votes, hangs no one', () => {
    const g = morning();
    act(g, 'a', { type: 'vote', target: 'b' });
    act(g, 'b', { type: 'vote', target: 'a' });
    for (const v of 'cdefg') act(g, v, { type: 'vote', target: 'skip' });
    expect(g.phase).toBe('night');
    expect(alive(g)).toBe('abcdefg');
    expect(g.day).toBe(2);
  });

  it('nobody votes for themselves, and the dead cannot vote', () => {
    const g = morning();
    expect(() => act(g, 'b', { type: 'vote', target: 'b' })).toThrow(RuleError);
    g.players[6].alive = false;
    expect(() => act(g, 'g', { type: 'vote', target: 'a' })).toThrow(/dead/);
  });

  it('the day ends at its deadline with the votes cast so far', () => {
    const g = morning();
    act(g, 'b', { type: 'vote', target: 'c' });
    expect(g.deadline).toBe(T0 + NIGHT_MS + DAY_MS); // the day began when the night ended
    tick(g, g.deadline!, seeded());
    expect(alive(g)).toBe('abdefg');
  });
});

describe('the Hunter', () => {
  it('takes someone with them when hanged', () => {
    const g = table(['coven', 'seer', 'doctor', 'hunter', 'villager', 'villager']);
    tick(g, T0 + NIGHT_MS, seeded());
    for (const v of 'abcef') act(g, v, { type: 'vote', target: 'd' });
    act(g, 'd', { type: 'vote', target: 'a' });
    expect(g.phase).toBe('hunter');
    expect(viewFor(g, 'e').hunter).toBe('d');
    expect(() => act(g, 'e', { type: 'shoot', target: 'a' })).toThrow(RuleError);
    act(g, 'd', { type: 'shoot', target: 'a' });
    expect(g.winner).toBe('village');
  });
});

describe('winning', () => {
  it('the coven wins once it equals the rest', () => {
    const g = table(['coven', 'seer', 'doctor', 'villager', 'villager']);
    g.players[3].alive = false;
    g.players[4].alive = false;
    act(g, 'a', { type: 'night', target: 'b' });
    act(g, 'b', { type: 'night', target: 'a' });
    act(g, 'c', { type: 'night', target: 'c' });
    expect(g.winner).toBe('coven');
    expect(g.phase).toBe('over');
  });
});

describe('secrets and chat', () => {
  it('roles stay hidden, except your own, your coven, and the dead', () => {
    const g = table(['coven', 'coven', 'seer', 'doctor', 'villager', 'villager', 'villager']);
    const roles = (viewer: string) => viewFor(g, viewer).players.map((p) => p.role ?? '?').join(',');
    expect(roles('e')).toBe('?,?,?,?,villager,?,?');
    expect(roles('a')).toBe('coven,coven,?,?,?,?,?');
    g.players[2].alive = false;
    expect(roles('e')).toBe('?,?,seer,?,villager,?,?');
    expect(viewFor(g, 'e').covenVotes).toBeNull();
  });

  it('the coven talks only among itself at night; the village by day; the dead stay silent', () => {
    const g = table(['coven', 'coven', 'seer', 'doctor', 'villager', 'villager', 'villager']);
    act(g, 'a', { type: 'chat', channel: 'coven', text: 'the baker tonight' });
    expect(() => act(g, 'e', { type: 'chat', channel: 'coven', text: 'hi' })).toThrow(RuleError);
    expect(() => act(g, 'e', { type: 'chat', channel: 'day', text: 'hi' })).toThrow(/asleep/);
    expect(viewFor(g, 'b').chat).toHaveLength(1);
    expect(viewFor(g, 'e').chat).toHaveLength(0);
    tick(g, T0 + NIGHT_MS, seeded());
    act(g, 'e', { type: 'chat', channel: 'day', text: '  who   did it?  ' });
    expect(viewFor(g, 'c').chat.at(-1)?.text).toBe('who did it?');
    g.players[4].alive = false;
    expect(() => act(g, 'e', { type: 'chat', channel: 'day', text: 'boo' })).toThrow(/dead/);
  });
});

describe('bots', () => {
  /** Plays a whole game of bots, letting deadlines pass when nobody else will act. */
  function play(n: number, seed: number): GameState {
    const rng = seeded(seed);
    const g = createGame(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Bot ${i}` })), rng, T0);
    let now = T0;
    for (let step = 0; step < 2000 && g.phase !== 'over'; step++) {
      const moved = pendingActors(g).some((id) => {
        const move = chooseBotMove(g, id, rng);
        if (!move) return false;
        if (move.say && g.phase !== 'night') applyAction(g, id, { type: 'chat', channel: 'day', text: move.say }, now, rng);
        applyAction(g, id, move.action, now, rng);
        return true;
      });
      if (!moved) {
        now = g.deadline ?? now;
        tick(g, now, rng);
      }
    }
    return g;
  }

  it('finish games of every size with only legal moves', () => {
    for (let n = 5; n <= 16; n++) {
      for (const seed of [1, 2, 3]) {
        const g = play(n, seed * 100 + n);
        expect(g.phase, `${n} players, seed ${seed}`).toBe('over');
        expect(g.winner).not.toBeNull();
      }
    }
  });

  it('both sides win sometimes', () => {
    const winners = new Set(Array.from({ length: 40 }, (_, s) => play(8, 900 + s).winner));
    expect(winners).toEqual(new Set(['village', 'coven']));
  });
});
