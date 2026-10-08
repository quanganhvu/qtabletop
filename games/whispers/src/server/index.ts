import { Server, routePartykitRequest, type Connection, type WSMessage } from 'partyserver';
import { isBotLevel, type BotLevel } from '../shared/botLevels';
import { chooseBotMove } from '../shared/bot';
import { BOT_NAMES } from '../shared/theme';
import { PRESET_ARMS, sanitizeArms, type Arms } from '../shared/heraldry';
import { applyAction, closeVote, createGame, MIN_PLAYERS, pendingActors, RuleError, tick, viewFor, type GameState } from '../shared/game';
import { MAX_NAME_LENGTH, MAX_PLAYERS, type ClientMessage, type RoomInfo, type ServerMessage } from '../shared/protocol';

const ROOM_CODE = /^[A-Z]{4}$/;
const LOBBY_GRACE_MS = 30_000;
/** How long bots "think" before acting, by phase: by day they wait for the humans to talk first. */
const BOT_DELAY_MS: Record<string, [number, number]> = { night: [3000, 9000], witch: [2500, 6000], day: [15000, 45000], hunter: [2500, 6000] };
/** The fastest a player may post chat messages. */
const CHAT_GAP_MS = 600;

interface Seat {
  id: string;
  name: string;
  bot?: boolean;
  /** Bot difficulty; stand-in bots for players who left play at 'normal'. */
  level?: BotLevel;
  arms?: Arms;
  /** A human who left mid-game; a bot plays their seat until they come back. */
  left?: boolean;
}

interface RoomData {
  created: boolean;
  hostId: string | null;
  players: Seat[];
  game: GameState | null;
}

interface ConnState {
  playerId: string | null;
}

const emptyRoom = (): RoomData => ({ created: false, hostId: null, players: [], game: null });

/**
 * One Durable Object per room code. Its state is persisted to storage after
 * every change, so games survive hibernation and redeploys.
 */
export class VillageRoom extends Server<Env> {
  static options = { hibernate: true };

  data: RoomData = emptyRoom();
  /** When each bot will act in the current phase (in memory; after a wake-up, bots simply act at once). */
  private botDue = new Map<string, number>();
  private lastChat = new Map<string, number>();

  async onStart() {
    this.data = (await this.ctx.storage.get<RoomData>('room')) ?? emptyRoom();
    await this.schedule();
  }

  async onMessage(conn: Connection<ConnState>, raw: WSMessage) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    try {
      await this.handle(conn, msg);
    } catch (err) {
      if (!(err instanceof RuleError)) throw err;
      this.send(conn, { type: 'error', message: err.message, fatal: err instanceof FatalError });
    }
  }

  async onClose(conn: Connection<ConnState>) {
    const playerId = conn.state?.playerId;
    if (playerId && !this.data.game && !this.isOnline(playerId, conn.id)) {
      // Give lobby players a moment to come back (e.g. a page refresh) before dropping their seat.
      await this.ctx.storage.setAlarm(Date.now() + LOBBY_GRACE_MS);
    }
    this.broadcastState(conn.id);
  }

  async onAlarm() {
    if (this.data.game) return this.runClock();
    for (const seat of [...this.data.players]) {
      if (!this.isOnline(seat.id)) this.removeSeat(seat.id);
    }
    // Bots alone don't keep a room alive.
    if (!this.data.players.some((p) => !p.bot)) this.data = emptyRoom();
    await this.save();
  }

  private async handle(conn: Connection<ConnState>, msg: ClientMessage) {
    const d = this.data;
    switch (msg.type) {
      case 'join': {
        const playerId = typeof msg.playerId === 'string' ? msg.playerId.slice(0, 64) : '';
        const name = String(msg.name ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
        if (!playerId) throw new FatalError('Missing player id');
        if (!name) throw new FatalError('Please enter a name');
        if (!d.created) {
          if (!msg.create) throw new FatalError('Room not found');
          d.created = true;
          d.hostId = playerId;
        } else if (msg.create) {
          throw new FatalError('Room code already in use');
        }

        const seat = d.players.find((p) => p.id === playerId);
        const arms = sanitizeArms(msg.arms);
        if (!d.game) {
          if (seat) Object.assign(seat, { name, arms });
          else if (d.players.length >= MAX_PLAYERS) throw new FatalError('Room is full');
          else d.players.push({ id: playerId, name, arms });
        } else if (seat) {
          seat.arms = arms;
          if (seat.left) {
            // Back from leaving: take the seat over from the stand-in bot.
            seat.left = false;
            seat.bot = false;
          }
        }
        // Anyone else joining a game in progress is a spectator.
        conn.setState({ playerId });
        break;
      }

      case 'leave': {
        const playerId = conn.state?.playerId;
        conn.setState({ playerId: null });
        if (!playerId || this.isOnline(playerId)) break; // still open in another tab
        const seat = this.seat(playerId);
        if (!d.game) {
          this.removeSeat(playerId);
        } else if (seat && !seat.bot) {
          // Mid-game: a bot takes over the seat so the others can play on.
          seat.bot = true;
          seat.left = true;
          if (d.hostId === playerId) d.hostId = d.players.find((p) => !p.bot)?.id ?? null;
        }
        // With no humans left at the table there is no one to play for.
        if (!this.data.players.some((p) => !p.bot)) this.data = emptyRoom();
        break;
      }

      case 'start': {
        this.requireHost(conn);
        if (d.game) throw new RuleError('The game has already started');
        if (d.players.length < MIN_PLAYERS) throw new RuleError(`Need at least ${MIN_PLAYERS} players`);
        // Random seating around the village square (roles are dealt at random anyway).
        for (let i = d.players.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [d.players[i], d.players[j]] = [d.players[j], d.players[i]];
        }
        d.game = createGame(d.players);
        this.botDue.clear();
        break;
      }

      case 'action': {
        if (!d.game) throw new RuleError('No game in progress');
        const playerId = conn.state?.playerId ?? '';
        if (msg.action?.type === 'chat') {
          const last = this.lastChat.get(playerId) ?? 0;
          if (Date.now() - last < CHAT_GAP_MS) throw new RuleError('Slow down a little');
          this.lastChat.set(playerId, Date.now());
        }
        applyAction(d.game, playerId, msg.action);
        break;
      }

      case 'closeVote': {
        this.requireHost(conn);
        if (!d.game) throw new RuleError('No game in progress');
        closeVote(d.game);
        break;
      }

      case 'backToLobby':
      case 'endGame': {
        this.requireHost(conn);
        if (!d.game) throw new RuleError('No game in progress');
        d.game = null;
        // Players who left (and their stand-in bots) don't come back to the lobby.
        d.players = d.players.filter((p) => !p.left && this.isOnline(p.id));
        break;
      }

      case 'addBot': {
        this.requireHost(conn);
        if (d.game) throw new RuleError('The game has already started');
        if (d.players.length >= MAX_PLAYERS) throw new RuleError('Room is full');
        const name = BOT_NAMES.find((n) => !d.players.some((p) => p.name === n)) ?? 'Bot';
        const taken = new Set(d.players.map((p) => JSON.stringify(p.arms)));
        const arms = PRESET_ARMS.find((a) => !taken.has(JSON.stringify(a))) ?? PRESET_ARMS[0];
        const level = isBotLevel(msg.level) ? msg.level : 'normal';
        d.players.push({ id: `bot-${crypto.randomUUID()}`, name, bot: true, level, arms });
        break;
      }

      case 'removePlayer': {
        this.requireHost(conn);
        if (d.game) throw new RuleError('The game has already started');
        if (msg.playerId === d.hostId) throw new RuleError("You can't remove yourself");
        this.removeSeat(msg.playerId);
        break;
      }

      case 'setArms': {
        const seat = d.players.find((p) => p.id === conn.state?.playerId);
        if (!seat) throw new RuleError('You are not seated in this room');
        seat.arms = sanitizeArms(msg.arms);
        break;
      }

      case 'claimSeat': {
        const me = conn.state?.playerId;
        if (!d.game) throw new RuleError('No game in progress');
        if (me && d.players.some((p) => p.id === me)) throw new RuleError('You already have a seat');
        const seat = d.players.find((p) => p.id === msg.seatId);
        // An offline seat, or one a stand-in bot is keeping warm, can be taken over.
        const humanThere = [...this.getConnections<ConnState>()].some((c) => c.state?.playerId === msg.seatId);
        if (!seat || humanThere || (seat.bot && !seat.left)) throw new RuleError('That seat is taken');
        seat.bot = false;
        seat.left = false;
        conn.setState({ playerId: seat.id });
        break;
      }

      default:
        return;
    }
    await this.save();
    this.broadcastState();
    await this.schedule();
  }

  /**
   * The game's clock: plays bots whose moment has come, and ends phases whose
   * deadline has passed. Driven by the storage alarm, which survives hibernation.
   */
  private async runClock() {
    const g = this.data.game;
    if (!g || g.phase === 'over') return;
    let changed = false;
    const over = () => g.phase === 'over'; // re-read each time: moves below change the phase
    for (let guard = 0; guard < 50 && !over(); guard++) {
      const now = Date.now();
      const bot = pendingActors(g).find((id) => this.seat(id)?.bot && (this.botDue.get(id) ?? Infinity) <= now);
      if (bot) {
        this.playBot(g, bot);
        changed = true;
        continue;
      }
      if (tick(g, now)) {
        changed = true;
        continue;
      }
      break;
    }
    if (changed) {
      await this.save();
      this.broadcastState();
    }
    await this.schedule();
  }

  private playBot(g: GameState, botId: string) {
    this.botDue.delete(botId);
    try {
      const move = chooseBotMove(g, botId);
      if (!move) return;
      if (move.say && g.phase === 'day') applyAction(g, botId, { type: 'chat', channel: 'day', text: move.say });
      applyAction(g, botId, move.action);
    } catch (err) {
      // Should never happen (bots are tested to move legally); the phase deadline still moves the game on.
      console.error('Bot move failed', err);
    }
  }

  /** Give each waiting bot a moment to act, and set the alarm for whatever comes first. */
  private async schedule() {
    const g = this.data.game;
    if (!g || g.phase === 'over') {
      this.botDue.clear();
      return;
    }
    const now = Date.now();
    const waiting = new Set(pendingActors(g).filter((id) => this.seat(id)?.bot));
    for (const id of [...this.botDue.keys()]) if (!waiting.has(id)) this.botDue.delete(id);
    const [lo, hi] = BOT_DELAY_MS[g.phase] ?? [3000, 6000];
    for (const id of waiting) if (!this.botDue.has(id)) this.botDue.set(id, now + lo + Math.random() * (hi - lo));
    const next = Math.min(g.deadline ?? Infinity, ...this.botDue.values());
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(Math.max(next, now + 50));
  }

  private seat(playerId: string): Seat | undefined {
    return this.data.players.find((p) => p.id === playerId);
  }

  private requireHost(conn: Connection<ConnState>) {
    if (!conn.state?.playerId || conn.state.playerId !== this.data.hostId) {
      throw new RuleError('Only the host can do that');
    }
  }

  private removeSeat(playerId: string) {
    const d = this.data;
    d.players = d.players.filter((p) => p.id !== playerId);
    if (d.hostId === playerId) d.hostId = d.players.find((p) => !p.bot)?.id ?? null;
  }

  private isOnline(playerId: string, excludeConnId?: string): boolean {
    if (this.seat(playerId)?.bot) return true;
    for (const c of this.getConnections<ConnState>()) {
      if (c.id !== excludeConnId && c.state?.playerId === playerId) return true;
    }
    return false;
  }

  private async save() {
    const d = this.data;
    if (d.hostId && !d.players.some((p) => p.id === d.hostId)) d.hostId = d.players.find((p) => !p.bot)?.id ?? null;
    await this.ctx.storage.put('room', d);
  }

  private roomInfo(excludeConnId?: string): RoomInfo {
    return {
      code: this.name,
      hostId: this.data.hostId,
      started: !!this.data.game,
      players: this.data.players.map((p) => ({
        id: p.id, name: p.name, bot: !!p.bot, level: p.bot ? (p.level ?? 'normal') : undefined, left: !!p.left, arms: sanitizeArms(p.arms), connected: this.isOnline(p.id, excludeConnId),
      })),
    };
  }

  private broadcastState(excludeConnId?: string) {
    const room = this.roomInfo(excludeConnId);
    for (const conn of this.getConnections<ConnState>()) {
      if (conn.id === excludeConnId || !conn.state?.playerId) continue;
      const you = conn.state.playerId;
      this.send(conn, { type: 'state', room, game: this.data.game ? viewFor(this.data.game, you) : null, you });
    }
  }

  private send(conn: Connection, msg: ServerMessage) {
    try {
      conn.send(JSON.stringify(msg));
    } catch {
      // Socket already closed.
    }
  }
}

class FatalError extends RuleError {}

export default {
  async fetch(request, env) {
    const response = await routePartykitRequest(request, env, {
      onBeforeConnect: (_req, lobby) => {
        if (!ROOM_CODE.test(lobby.name)) return new Response('Invalid room code', { status: 400 });
      },
    });
    return response ?? new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
