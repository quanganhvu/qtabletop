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
  let id = read(session, 'skyline.playerId');
  if (!id) {
    id = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    write(session, 'skyline.playerId', id);
  }
  return id;
}

export const setPlayerId = (id: string) => write(session, 'skyline.playerId', id);

/** Whether you prefer the board flat instead of in 3D. */
export const getFlatBoard = () => read(local, 'skyline.flat') === '1';
export const setFlatBoard = (flat: boolean) => write(local, 'skyline.flat', flat ? '1' : null);
export const getName = () => read(local, 'skyline.name') ?? '';
export const setName = (name: string) => write(local, 'skyline.name', name);
export const getRoomCode = () => read(session, 'skyline.room');
export const setRoomCode = (code: string | null) => write(session, 'skyline.room', code);

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function randomRoomCode(): string {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}
