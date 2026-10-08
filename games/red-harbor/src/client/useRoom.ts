import { useCallback, useEffect, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import type { Action, GameView } from '../shared/game';
import { PARTY, type ClientMessage, type RoomInfo, type ServerMessage } from '../shared/protocol';
import { getFlag, getName, getPlayerId, getRoomCode, randomRoomCode, setPlayerId, setRoomCode } from './identity';

export interface RoomState {
  room: RoomInfo;
  game: GameView | null;
  you: string | null;
}

/** Owns the WebSocket to a room's Durable Object and the latest state it pushed. */
export function useRoom(notify: (msg: string) => void) {
  const [state, setState] = useState<RoomState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setState(null);
    setConnecting(false);
    setRoomCode(null);
    history.replaceState(null, '', location.pathname);
  }, []);

  const connect = useCallback((code: string, create: boolean) => {
    socketRef.current?.close();
    setConnecting(true);
    const socket = new PartySocket({ host: location.host, party: PARTY, room: code });
    socketRef.current = socket;
    // Only the very first join creates the room; reconnects must not.
    let creating = create;

    const join = () => {
      const msg: ClientMessage = { type: 'join', playerId: getPlayerId(), name: getName(), flag: getFlag(), create: creating };
      socket.send(JSON.stringify(msg));
    };
    socket.addEventListener('open', join);

    socket.addEventListener('message', (event) => {
      if (socketRef.current !== socket) return;
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'state') {
        creating = false;
        if (msg.you && msg.you !== getPlayerId()) setPlayerId(msg.you); // took over a seat
        setRoomCode(msg.room.code);
        if (!location.search.includes(msg.room.code)) history.replaceState(null, '', `?room=${msg.room.code}`);
        setConnecting(false);
        setState({ room: msg.room, game: msg.game, you: msg.you });
      } else if (msg.fatal) {
        socket.close();
        if (creating && msg.message === 'Room code already in use') {
          connect(randomRoomCode(), true);
          return;
        }
        notifyRef.current(msg.message);
        disconnect();
      } else {
        notifyRef.current(msg.message);
      }
    });
  }, [disconnect]);

  // Rejoin the room this tab was in (page refresh), or one from a shared link.
  useEffect(() => {
    const code = getRoomCode() ?? new URLSearchParams(location.search).get('room')?.toUpperCase();
    if (code && getName()) connect(code, false);
    return () => socketRef.current?.close();
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const leave = useCallback(() => {
    send({ type: 'leave' });
    disconnect();
  }, [send, disconnect]);

  const act = useCallback((action: Action) => send({ type: 'action', action }), [send]);

  return { state, connecting, connect, send, act, leave };
}
