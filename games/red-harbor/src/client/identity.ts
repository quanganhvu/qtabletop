import { randomFlag, sanitizeFlag, type Flag } from '../shared/flags';

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
  let id = read(session, 'havre.playerId');
  if (!id) {
    id = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    write(session, 'havre.playerId', id);
  }
  return id;
}

export const setPlayerId = (id: string) => write(session, 'havre.playerId', id);

/** Your company's house flag, remembered across visits. */
export function getFlag(): Flag {
  const saved = read(local, 'havre.flag');
  if (saved) {
    try {
      return sanitizeFlag(JSON.parse(saved));
    } catch {
      // fall through to a fresh one
    }
  }
  const flag = randomFlag();
  write(local, 'havre.flag', JSON.stringify(flag));
  return flag;
}
export const setFlag = (flag: Flag) => write(local, 'havre.flag', JSON.stringify(flag));
export const getName = () => read(local, 'havre.name') ?? '';
export const setName = (name: string) => write(local, 'havre.name', name);
export const getRoomCode = () => read(session, 'havre.room');
export const setRoomCode = (code: string | null) => write(session, 'havre.room', code);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function randomRoomCode(): string {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}
