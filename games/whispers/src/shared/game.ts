// Pure rules engine (a witch hunt: hidden-role social deduction), shared by the server
// (authoritative, and the game's moderator), the bots and the client. The
// server changes a GameState only through applyAction() and tick(); each
// client receives viewFor(), which strips every secret that player may not know.
//
// A game alternates nights and days. Night N: the coven chooses a victim to
// curse (and talks in its own chat), the Witchfinder questions someone, the
// Priest blesses someone; then the Wise Woman, told who was cursed, may cure
// them or poison someone. Dawn reveals the dead. Day N: everyone talks and
// votes; the most votes is hanged (a tie, or more abstentions, hangs no one).
// A dying Hunter shoots someone. Every phase has a deadline so no one can stall
// the game.

import { ROLES, roleName } from './theme';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 16;

export const NIGHT_MS = 60_000;
export const BREW_MS = 30_000;
export const DAY_MS = 180_000;
export const HUNTER_MS = 30_000;
export const CHAT_MAX = 200;

/** 'coven': a witch. 'seer': the Witchfinder. 'doctor': the Priest. 'wisewoman': the Wise Woman. */
export type Role = 'coven' | 'villager' | 'seer' | 'doctor' | 'wisewoman' | 'hunter';
export type Team = 'village' | 'coven';
export type Cause = 'curse' | 'poison' | 'lynch' | 'hunter';
export type Phase = 'night' | 'brew' | 'day' | 'hunter' | 'over';
export type Channel = 'day' | 'coven';

export const teamOf = (r: Role): Team => (r === 'coven' ? 'coven' : 'village');

export interface PlayerState {
  id: string;
  name: string;
  role: Role;
  alive: boolean;
  /** How and when they died (for the record and the results). */
  death?: { day: number; cause: Cause };
}

export interface ChatMessage {
  id: number;
  from: string;
  channel: Channel;
  text: string;
}

/** Public record of what happened, so clients can announce it. */
export type GameEvent = { seq: number } & (
  | { kind: 'nightfall'; day: number }
  | { kind: 'dawn'; day: number; deaths: { id: string; role: Role; cause: Cause }[] }
  | { kind: 'lynch'; day: number; id: string | null; role: Role | null }
  | { kind: 'shot'; by: string; id: string; role: Role }
  | { kind: 'over'; winner: Team }
);

type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'seq'> : never) : never;

export interface GameState {
  players: PlayerState[];
  phase: Phase;
  /** Night N is followed by Day N. */
  day: number;
  /** When the current phase ends on its own (ms since the epoch). */
  deadline: number | null;
  /** Tonight's choices, by player id. */
  covenVotes: Record<string, string>;
  seerPick: string | null;
  doctorPick: string | null;
  /** Whom the Priest blessed last night (may not repeat). */
  lastProtected: string | null;
  /** Who the coven chose tonight, once it has chosen (the Wise Woman is told). */
  victim: string | null;
  /** The Wise Woman's two potions, and what she brewed tonight. */
  wise: { heal: boolean; poison: boolean; healed: boolean; poisoned: string | null; done: boolean };
  /** Today's votes: voter → target, or 'skip'. */
  votes: Record<string, string>;
  /** Hunters who still owe their last shot, and where play goes afterwards. */
  hunters: string[];
  afterHunt: 'day' | 'night' | null;
  /** Things only one player knows (the Witchfinder's findings, the Wise Woman's news). */
  notes: Record<string, string[]>;
  /** The Witchfinder's findings: their id → (player id → is a witch). */
  visions: Record<string, Record<string, boolean>>;
  chat: ChatMessage[];
  winner: Team | null;
  log: string[];
  events: GameEvent[];
  seq: number;
  chatSeq: number;
}

export type Action =
  /** Night: a witch's choice of victim, the Witchfinder's or the Priest's choice. */
  | { type: 'night'; target: string }
  | { type: 'brew'; heal: boolean; poison: string | null }
  | { type: 'vote'; target: string }
  | { type: 'shoot'; target: string }
  | { type: 'chat'; channel: Channel; text: string };

export class RuleError extends Error {}

// ---- Setup ------------------------------------------------------------------------

/** Which roles a table of n players gets. Everyone may know the mix. */
export function rolesFor(n: number): Role[] {
  const witches = n <= 6 ? 1 : n <= 10 ? 2 : n <= 14 ? 3 : 4;
  const roles: Role[] = Array(witches).fill('coven');
  roles.push('seer', 'doctor');
  if (n >= 6) roles.push('hunter');
  if (n >= 8) roles.push('wisewoman');
  while (roles.length < n) roles.push('villager');
  return roles;
}

export function createGame(players: { id: string; name: string }[], rng: () => number = Math.random, now = Date.now()): GameState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) throw new RuleError(`${MIN_PLAYERS}–${MAX_PLAYERS} players`);
  const roles = rolesFor(players.length);
  shuffle(roles, rng);
  const g: GameState = {
    players: players.map((p, i) => ({ id: p.id, name: p.name, role: roles[i], alive: true })),
    phase: 'night',
    day: 1,
    deadline: now + NIGHT_MS,
    covenVotes: {},
    seerPick: null,
    doctorPick: null,
    lastProtected: null,
    victim: null,
    wise: { heal: true, poison: true, healed: false, poisoned: null, done: false },
    votes: {},
    hunters: [],
    afterHunt: null,
    notes: {},
    visions: {},
    chat: [],
    winner: null,
    log: [],
    events: [],
    seq: 0,
    chatSeq: 0,
  };
  const coven = g.players.filter((p) => p.role === 'coven');
  for (const w of coven) {
    const others = coven.filter((o) => o !== w).map((o) => o.name);
    note(g, w.id, others.length ? `Your coven: ${others.join(', ')}.` : 'You work your curses alone.');
  }
  log(g, 'Night falls over the village. Doors are barred; something whispers in the dark…');
  emit(g, { kind: 'nightfall', day: 1 });
  return g;
}

function shuffle<T>(list: T[], rng: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

// ---- Who must act ---------------------------------------------------------------------

const living = (g: GameState) => g.players.filter((p) => p.alive);
const find = (g: GameState, id: string) => g.players.find((p) => p.id === id);
const aliveWith = (g: GameState, role: Role) => living(g).filter((p) => p.role === role);

/** Players who still have something to do in the current phase. */
export function pendingActors(g: GameState): string[] {
  switch (g.phase) {
    case 'night':
      return living(g).filter((p) =>
        (p.role === 'coven' && !g.covenVotes[p.id])
        || (p.role === 'seer' && !g.seerPick)
        || (p.role === 'doctor' && !g.doctorPick)).map((p) => p.id);
    case 'brew':
      return aliveWith(g, 'wisewoman').filter(() => !g.wise.done).map((p) => p.id);
    case 'day':
      return living(g).filter((p) => !g.votes[p.id]).map((p) => p.id);
    case 'hunter':
      return g.hunters.slice(0, 1);
    case 'over':
      return [];
  }
}

// ---- Actions ----------------------------------------------------------------------------

export function applyAction(g: GameState, playerId: string, action: Action, now = Date.now(), rng: () => number = Math.random): void {
  const me = find(g, playerId);
  if (!me) throw new RuleError('You are not playing in this game');
  if (action?.type === 'chat') return chat(g, me, action);
  if (g.phase === 'over') throw new RuleError('The game is over');
  // Only a fallen Hunter acts from the grave: their last shot.
  if (!me.alive && action?.type !== 'shoot') throw new RuleError('The dead cannot act');

  switch (action?.type) {
    case 'night': {
      if (g.phase !== 'night') throw new RuleError('That can only be done at night');
      const target = find(g, action.target);
      if (!target?.alive) throw new RuleError('Choose a living player');
      if (me.role === 'coven') {
        if (target.role === 'coven') throw new RuleError('The coven will not curse its own');
        g.covenVotes[me.id] = target.id;
      } else if (me.role === 'seer') {
        if (g.seerPick) throw new RuleError('You have already questioned someone tonight');
        if (target.id === me.id) throw new RuleError('Question someone else');
        g.seerPick = target.id;
        (g.visions[me.id] ??= {})[target.id] = target.role === 'coven';
        note(g, me.id, `Night ${g.day}: ${target.name} ${target.role === 'coven' ? 'IS a witch!' : 'is not a witch.'}`);
      } else if (me.role === 'doctor') {
        if (g.doctorPick) throw new RuleError('You have already given your blessing tonight');
        if (target.id === g.lastProtected) throw new RuleError('You blessed them last night; choose someone else');
        g.doctorPick = target.id;
      } else {
        throw new RuleError('You sleep through the night');
      }
      break;
    }
    case 'brew': {
      if (g.phase !== 'brew' || me.role !== 'wisewoman' || g.wise.done) throw new RuleError('It is not the Wise Woman’s moment');
      if (action.heal) {
        if (!g.wise.heal) throw new RuleError('Your cure is spent');
        if (!g.victim) throw new RuleError('No one was cursed tonight');
        g.wise.heal = false;
        g.wise.healed = true;
      }
      if (action.poison !== null && action.poison !== undefined) {
        if (!g.wise.poison) throw new RuleError('Your poison is spent');
        const target = find(g, action.poison);
        if (!target?.alive || target.id === me.id) throw new RuleError('Choose someone else who is alive');
        g.wise.poison = false;
        g.wise.poisoned = target.id;
      }
      g.wise.done = true;
      break;
    }
    case 'vote': {
      if (g.phase !== 'day') throw new RuleError('Votes are cast by day');
      if (action.target !== 'skip') {
        const target = find(g, action.target);
        if (!target?.alive) throw new RuleError('Vote for a living player');
        if (target.id === me.id) throw new RuleError('You cannot vote for yourself');
      }
      g.votes[me.id] = action.target;
      break;
    }
    case 'shoot': {
      if (g.phase !== 'hunter' || g.hunters[0] !== me.id) throw new RuleError('It is not your shot');
      const target = find(g, action.target);
      if (!target?.alive || target.id === me.id) throw new RuleError('Choose a living player');
      shoot(g, me, target);
      afterShot(g, now, rng);
      return;
    }
    default:
      throw new RuleError('Unknown action');
  }
  advance(g, now, rng);
}

/** The phase ends early once everyone has acted. */
function advance(g: GameState, now: number, rng: () => number) {
  if (g.phase !== 'over' && pendingActors(g).length === 0) endPhase(g, now, rng);
}

/** Called by the server as time passes: ends the phase once its deadline is reached. */
export function tick(g: GameState, now = Date.now(), rng: () => number = Math.random): boolean {
  if (g.phase === 'over' || g.deadline === null || now < g.deadline) return false;
  endPhase(g, now, rng);
  return true;
}

/** The host closes the day's vote early, counting the votes cast so far. */
export function closeVote(g: GameState, now = Date.now(), rng: () => number = Math.random) {
  if (g.phase !== 'day') throw new RuleError('There is no vote to close');
  endPhase(g, now, rng);
}

function endPhase(g: GameState, now: number, rng: () => number) {
  switch (g.phase) {
    case 'night': return endNight(g, now, rng);
    case 'brew': return dawn(g, now);
    case 'day': return endDay(g, now, rng);
    case 'hunter': {
      // The Hunter hesitated too long; the shot is lost.
      const h = find(g, g.hunters.shift()!)!;
      log(g, `${h.name} could not bring themself to shoot.`);
      return afterShot(g, now, rng);
    }
  }
}

function endNight(g: GameState, now: number, rng: () => number) {
  // The coven's choice: the most-named victim; a tie is settled by chance.
  const tally = new Map<string, number>();
  for (const t of Object.values(g.covenVotes)) if (find(g, t)?.alive) tally.set(t, (tally.get(t) ?? 0) + 1);
  const top = Math.max(0, ...tally.values());
  const tied = [...tally].filter(([, c]) => c === top && top > 0).map(([id]) => id);
  g.victim = tied.length ? tied[Math.floor(rng() * tied.length)] : null;

  const wise = aliveWith(g, 'wisewoman')[0];
  if (wise && (g.wise.heal || g.wise.poison)) {
    g.phase = 'brew';
    g.deadline = now + BREW_MS;
    note(g, wise.id, g.victim
      ? `Night ${g.day}: the coven cursed ${find(g, g.victim)!.name}.`
      : `Night ${g.day}: the coven cursed no one tonight.`);
    return;
  }
  dawn(g, now);
}

function dawn(g: GameState, now: number) {
  const deaths: { id: string; role: Role; cause: Cause }[] = [];
  const saved = g.victim && (g.victim === g.doctorPick || g.wise.healed);
  if (g.victim && !saved) deaths.push({ id: g.victim, role: find(g, g.victim)!.role, cause: 'curse' });
  const poisoned = g.wise.poisoned;
  if (poisoned && !deaths.some((d) => d.id === poisoned)) deaths.push({ id: poisoned, role: find(g, poisoned)!.role, cause: 'poison' });
  for (const d of deaths) kill(g, find(g, d.id)!, d.cause);

  g.lastProtected = g.doctorPick;
  g.covenVotes = {};
  g.seerPick = null;
  g.doctorPick = null;
  g.victim = null;
  g.wise = { ...g.wise, healed: false, poisoned: null, done: false };

  log(g, deaths.length
    ? `Dawn breaks. ${deaths.map((d) => `${find(g, d.id)!.name} (${roleName(d.role)})`).join(' and ')} ${deaths.length > 1 ? 'were' : 'was'} found dead.`
    : 'Dawn breaks, and everyone is alive.');
  emit(g, { kind: 'dawn', day: g.day, deaths });
  if (checkWin(g)) return;
  if (startHunt(g, 'day', now)) return;
  startDay(g, now);
}

function startDay(g: GameState, now: number) {
  g.phase = 'day';
  g.votes = {};
  g.deadline = now + DAY_MS;
}

function endDay(g: GameState, now: number, rng: () => number) {
  const tally = new Map<string, number>();
  let skips = 0;
  for (const [voter, t] of Object.entries(g.votes)) {
    if (!find(g, voter)?.alive) continue;
    if (t === 'skip') skips++;
    else if (find(g, t)?.alive) tally.set(t, (tally.get(t) ?? 0) + 1);
  }
  const top = Math.max(0, ...tally.values());
  const leaders = [...tally].filter(([, c]) => c === top).map(([id]) => id);
  const hanged = top > 0 && leaders.length === 1 && top > skips ? find(g, leaders[0])! : null;

  if (hanged) {
    kill(g, hanged, 'lynch');
    log(g, `The village hanged ${hanged.name}. They were ${ROLES[hanged.role].a}.`);
    emit(g, { kind: 'lynch', day: g.day, id: hanged.id, role: hanged.role });
  } else {
    log(g, 'The village could not agree, and no one was hanged.');
    emit(g, { kind: 'lynch', day: g.day, id: null, role: null });
  }
  if (checkWin(g)) return;
  if (startHunt(g, 'night', now)) return;
  startNight(g, now, rng);
}

function startNight(g: GameState, now: number, _rng: () => number) {
  g.day++;
  g.phase = 'night';
  g.votes = {};
  g.deadline = now + NIGHT_MS;
  log(g, `Night ${g.day} falls.`);
  emit(g, { kind: 'nightfall', day: g.day });
}

function kill(g: GameState, p: PlayerState, cause: Cause) {
  p.alive = false;
  p.death = { day: g.day, cause };
  if (p.role === 'hunter') g.hunters.push(p.id);
}

/** Dead Hunters take their shot before play goes on. */
function startHunt(g: GameState, then: 'day' | 'night', now: number): boolean {
  if (!g.hunters.length) return false;
  g.phase = 'hunter';
  g.afterHunt = then;
  g.deadline = now + HUNTER_MS;
  return true;
}

function shoot(g: GameState, hunter: PlayerState, target: PlayerState) {
  g.hunters.shift();
  kill(g, target, 'hunter');
  log(g, `With their last breath, ${hunter.name} shot ${target.name}, who was ${ROLES[target.role].a}.`);
  emit(g, { kind: 'shot', by: hunter.id, id: target.id, role: target.role });
}

function afterShot(g: GameState, now: number, rng: () => number) {
  if (checkWin(g)) return;
  if (g.hunters.length) {
    g.deadline = now + HUNTER_MS;
    return;
  }
  if (g.afterHunt === 'night') startNight(g, now, rng);
  else startDay(g, now);
  g.afterHunt = null;
}

/** The village wins when the last witch dies; the coven wins once it is as large as the rest. */
function checkWin(g: GameState): boolean {
  const alive = living(g);
  const witches = alive.filter((p) => p.role === 'coven').length;
  const winner: Team | null = witches === 0 ? 'village' : witches >= alive.length - witches ? 'coven' : null;
  if (!winner) return false;
  g.winner = winner;
  g.phase = 'over';
  g.deadline = null;
  g.hunters = [];
  log(g, winner === 'village' ? 'The last witch is dead. The village is saved!' : 'The coven now rivals the living. The village is lost.');
  emit(g, { kind: 'over', winner });
  return true;
}

// ---- Chat ----------------------------------------------------------------------------------

function chat(g: GameState, me: PlayerState, action: Extract<Action, { type: 'chat' }>) {
  const text = String(action.text ?? '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (!text) return;
  if (action.channel === 'coven') {
    if (me.role !== 'coven' || !me.alive) throw new RuleError('Only the living coven may speak there');
    if (g.phase !== 'night' && g.phase !== 'over') throw new RuleError('The coven speaks only at night');
  } else if (action.channel === 'day') {
    if (g.phase !== 'over') {
      if (!me.alive) throw new RuleError('The dead watch in silence');
      if (g.phase === 'night' || g.phase === 'brew') throw new RuleError('The village is asleep');
    }
  } else {
    throw new RuleError('Unknown channel');
  }
  g.chat.push({ id: ++g.chatSeq, from: me.id, channel: action.channel, text });
  if (g.chat.length > 300) g.chat.splice(0, g.chat.length - 300);
}

// ---- Bookkeeping -----------------------------------------------------------------------------

function note(g: GameState, id: string, line: string) {
  (g.notes[id] ??= []).push(line);
}

function log(g: GameState, line: string) {
  g.log.push(line);
  if (g.log.length > 200) g.log.splice(0, g.log.length - 200);
}

function emit(g: GameState, e: NewEvent) {
  g.events.push({ ...e, seq: ++g.seq } as GameEvent);
  if (g.events.length > 40) g.events.splice(0, g.events.length - 40);
}

// ---- What each player may see ----------------------------------------------------------------

export interface PlayerView {
  id: string;
  name: string;
  alive: boolean;
  /** Only when this viewer may know it. */
  role: Role | null;
  death?: { day: number; cause: Cause };
}

export interface GameView {
  you: string | null;
  myRole: Role | null;
  players: PlayerView[];
  phase: Phase;
  day: number;
  deadline: number | null;
  /** Players who still need to act (anyone may see who has not voted; night actors are secret). */
  waitingOn: string[];
  /** Today's votes, voter → target or 'skip' (public, as in a show of hands). */
  votes: Record<string, string>;
  /** The coven's picks tonight (witches only). */
  covenVotes: Record<string, string> | null;
  /** Your own night choice, if any. */
  myPick: string | null;
  /** The Priest's last blessed player (the Priest only). */
  lastProtected: string | null;
  /** The Wise Woman's view: who was cursed and which potions remain. */
  wise: { victim: string | null; heal: boolean; poison: boolean; done: boolean } | null;
  /** The Hunter whose shot it is. */
  hunter: string | null;
  notes: string[];
  /** Your findings, if you are the Witchfinder: player id → is a witch. */
  visions: Record<string, boolean>;
  chat: ChatMessage[];
  winner: Team | null;
  log: string[];
  events: GameEvent[];
}

export function viewFor(g: GameState, viewerId: string | null): GameView {
  const me = viewerId ? find(g, viewerId) : undefined;
  const over = g.phase === 'over';
  const iAmWitch = me?.role === 'coven';
  const sees = (p: PlayerState) => over || !p.alive || p.id === viewerId || (iAmWitch && p.role === 'coven');
  const pending = pendingActors(g);
  return {
    you: me?.id ?? null,
    myRole: me?.role ?? null,
    players: g.players.map((p) => ({ id: p.id, name: p.name, alive: p.alive, role: sees(p) ? p.role : null, ...(p.death ? { death: p.death } : {}) })),
    phase: g.phase,
    day: g.day,
    deadline: g.deadline,
    // By day everyone sees who has yet to vote; at night only whether you yourself are awaited.
    waitingOn: g.phase === 'day' || g.phase === 'hunter' ? pending : pending.filter((id) => id === viewerId || (iAmWitch && find(g, id)?.role === 'coven')),
    votes: g.phase === 'day' ? g.votes : {},
    covenVotes: iAmWitch || over ? g.covenVotes : null,
    myPick: me ? (me.role === 'coven' ? g.covenVotes[me.id] ?? null : me.role === 'seer' ? g.seerPick : me.role === 'doctor' ? g.doctorPick : null) : null,
    lastProtected: me?.role === 'doctor' ? g.lastProtected : null,
    wise: me?.role === 'wisewoman' ? { victim: g.phase === 'brew' ? g.victim : null, heal: g.wise.heal, poison: g.wise.poison, done: g.wise.done } : null,
    hunter: g.phase === 'hunter' ? g.hunters[0] ?? null : null,
    notes: me ? g.notes[me.id] ?? [] : [],
    visions: me ? g.visions[me.id] ?? {} : {},
    chat: g.chat.filter((m) => m.channel === 'day' || over || iAmWitch),
    winner: g.winner,
    log: g.log,
    events: g.events,
  };
}
