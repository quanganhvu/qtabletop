import { randomArms, sanitizeArms, type Arms } from '../shared/heraldry';

// The player id lives in sessionStorage, so each browser tab is its own player
// (handy for testing locally) and the id survives page refreshes. The name and
// the room are remembered so a refresh drops you straight back into the game.

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Storage unavailable (private mode etc.): identity just won't persist.
  }
}

const session = () => sessionStorage;
const local = () => localStorage;

export function getPlayerId(): string {
  let id = read(session, 'splendor.playerId');
  if (!id) {
    id = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    write(session, 'splendor.playerId', id);
  }
  return id;
}

export const setPlayerId = (id: string) => write(session, 'splendor.playerId', id);

/** Your coat of arms, remembered across visits. */
export function getArms(): Arms {
  const saved = read(local, 'splendor.arms');
  if (saved) {
    try {
      return sanitizeArms(JSON.parse(saved));
    } catch {
      // fall through to a fresh one
    }
  }
  const arms = randomArms();
  write(local, 'splendor.arms', JSON.stringify(arms));
  return arms;
}
export const setArms = (arms: Arms) => write(local, 'splendor.arms', JSON.stringify(arms));
export const getName = () => read(local, 'splendor.name') ?? '';
export const setName = (name: string) => write(local, 'splendor.name', name);
export const getRoomCode = () => read(session, 'splendor.room');
export const setRoomCode = (code: string | null) => write(session, 'splendor.room', code);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function randomRoomCode(): string {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}
