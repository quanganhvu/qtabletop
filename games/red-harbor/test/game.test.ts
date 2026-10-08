import { describe, expect, it } from 'vitest';
import { applyAction, createGame, viewFor, wealth, TOWN, type GameState } from '../src/shared/game';
import { emptyGoods } from '../src/shared/goods';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const two = () => createGame([{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }], seeded(1));

describe('setup', () => {
  it('starts with francs, coal, the starting buildings and the first supply', () => {
    const g = two();
    expect(g.players[0].goods.franc).toBe(5);
    expect(g.players[0].goods.coal).toBe(1);
    expect(g.owner).toEqual({ firm1: TOWN, firm2: TOWN, construction: TOWN });
    expect(g.step).toBe(1);
    expect(g.chits[0].revealed).toBe(true);
    expect(g.stacks.map((s) => s[0])).toEqual(['marketplace', 'fishery', 'claymound']);
    expect(g.rounds).toHaveLength(14);
  });

  it('hides unrevealed chits in views', () => {
    const v = viewFor(two());
    expect(v.chits[0].id).not.toBe('?');
    expect(v.chits.slice(1).every((c) => c.id === '?')).toBe(true);
  });
});

describe('turns', () => {
  it('takes a whole offer space and passes the turn on', () => {
    const g = two();
    const fish = g.offers.fish;
    applyAction(g, 'a', { type: 'take', good: 'fish' });
    expect(g.players[0].goods.fish).toBe(fish);
    expect(g.offers.fish).toBe(0);
    expect(() => applyAction(g, 'a', { type: 'take', good: 'wood' })).toThrow(/already/);
    applyAction(g, 'a', { type: 'endTurn' });
    expect(g.current).toBe(1);
    expect(g.step).toBe(2);
  });

  it('rejects moves out of turn and leaves the state untouched on errors', () => {
    const g = two();
    expect(() => applyAction(g, 'b', { type: 'take', good: 'fish' })).toThrow(/not your turn/);
    const before = JSON.stringify(g);
    expect(() => applyAction(g, 'a', { type: 'use', buildingId: 'firm1', choice: { build: ['bank'] } })).toThrow();
    expect(JSON.stringify(g)).toBe(before);
  });

  it('builds with a building firm, paying materials and the entry fee', () => {
    const g = two();
    g.players[0].goods = { ...emptyGoods(), franc: 5, fish: 2, wood: 3 };
    applyAction(g, 'a', { type: 'use', buildingId: 'firm1', choice: { build: ['claymound'] } });
    const a = g.players[0];
    expect(g.owner.claymound).toBe('a');
    expect(a.goods.wood).toBe(0);
    expect(a.goods.fish).toBe(1); // 1 food fee
    expect(a.at).toBe('firm1');
    expect(g.stacks[2][0]).not.toBe('claymound');
  });

  it("pays entry fees to the owner and blocks occupied buildings", () => {
    const g = two();
    g.owner.fishery = 'b';
    g.stacks[1].shift();
    g.players[0].goods.fish = 1;
    applyAction(g, 'a', { type: 'use', buildingId: 'fishery' });
    expect(g.players[0].goods.fish).toBe(3); // paid 1, got 3
    expect(g.players[1].goods.fish).toBe(1);
    applyAction(g, 'a', { type: 'endTurn' });
    expect(() => applyAction(g, 'b', { type: 'use', buildingId: 'fishery' })).toThrow(/working there/);
  });

  it('converts goods with energy', () => {
    const g = two();
    g.owner.smokehouse = 'a';
    g.players[0].goods = { ...emptyGoods(), fish: 5, wood: 1 };
    applyAction(g, 'a', { type: 'use', buildingId: 'smokehouse', choice: { n: 5 } });
    const p = g.players[0];
    expect(p.goods.smokedFish).toBe(5);
    expect(p.goods.wood).toBe(0);
    expect(p.goods.franc).toBe(2);
  });

  it('buys and sells buildings and ships, and handles loans', () => {
    const g = two();
    const a = () => g.players[0]; // the engine replaces state objects on every move
    applyAction(g, 'a', { type: 'buyBuilding', buildingId: 'claymound' });
    expect(g.owner.claymound).toBe('a');
    expect(a().goods.franc).toBe(3);
    applyAction(g, 'a', { type: 'sellBuilding', buildingId: 'claymound' });
    expect(g.owner.claymound).toBe(TOWN);
    expect(a().goods.franc).toBe(4);
    applyAction(g, 'a', { type: 'loan' });
    expect(a().loans).toBe(1);
    expect(a().goods.franc).toBe(8);
    expect(() => applyAction(g, 'a', { type: 'buyBuilding', buildingId: 'firm1' })).toThrow(/starting/);
  });
});

function playRound(g: GameState) {
  while (g.phase === 'turn') applyAction(g, g.players[g.current].id, { type: 'endTurn' });
}

describe('rounds', () => {
  it('ends after 7 turns with harvest, feeding (with loans) and a new ship', () => {
    const g = two();
    g.players[0].goods.grain = 1;
    playRound(g);
    expect(g.phase).toBe('feed');
    expect(g.players[0].goods.grain).toBe(2);
    const due = g.feeding.a;
    expect(due).toBeGreaterThan(0);
    const francs = g.players[0].goods.franc;
    applyAction(g, 'a', { type: 'feed', payment: { franc: 0 } });
    expect(g.players[0].loans).toBe(Math.ceil(due / 4));
    expect(g.players[0].goods.franc).toBe(francs + Math.ceil(due / 4) * 4 - due);
    applyAction(g, 'b', { type: 'feed', payment: { franc: due } });
    expect(g.phase).toBe('turn');
    expect(g.round).toBe(2);
    expect(g.harbour).toHaveLength(1);
    expect(g.current).toBe(1); // 7 turns: seat 0 had turns 1,3,5,7
  });

  it('finishes with final actions and scores wealth', () => {
    const g = two();
    for (let r = 0; r < 14; r++) {
      playRound(g);
      for (const p of g.players) if (g.feeding[p.id]) applyAction(g, p.id, { type: 'feed', payment: {} });
    }
    expect(g.phase).toBe('final');
    applyAction(g, g.players[g.current].id, { type: 'endTurn' });
    applyAction(g, g.players[g.current].id, { type: 'endTurn' });
    expect(g.phase).toBe('over');
    const w = wealth(g, g.players[0]);
    expect(w.total).toBe(w.francs + w.buildings + w.bonus + w.ships - w.loans);
    expect(g.results!.ranking).toHaveLength(2);
  });
});
