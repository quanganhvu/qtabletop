import type { Action, GameView } from './game';
import type { Arms } from './heraldry';
import type { BotLevel } from './botLevels';

export { MAX_PLAYERS } from './game';
export const PARTY = 'tile-room'; // kebab-case of the TileRoom Durable Object binding
export const MAX_NAME_LENGTH = 20;

export type ClientMessage =
  | { type: 'join'; playerId: string; name: string; arms?: Arms; create: boolean }
  | { type: 'setArms'; arms: Arms }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'action'; action: Action }
  | { type: 'backToLobby' }
  /** Host only: stop the game in progress and return everyone to the lobby. */
  | { type: 'endGame' }
  /** Host only, in the lobby. */
  | { type: 'addBot'; level?: BotLevel }
  | { type: 'removePlayer'; playerId: string }
  /** A spectator takes over the seat of a player who disconnected. */
  | { type: 'claimSeat'; seatId: string };

export interface RoomInfo {
  code: string;
  hostId: string | null;
  started: boolean;
  /** `left`: a human who left mid-game; a stand-in bot is playing their seat. */
  players: { id: string; name: string; connected: boolean; bot: boolean; level?: BotLevel; left: boolean; arms: Arms }[];
}

export type ServerMessage =
  | { type: 'state'; room: RoomInfo; game: GameView | null; you: string | null }
  | { type: 'error'; message: string; fatal?: boolean };
