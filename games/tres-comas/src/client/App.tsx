import { useCallback, useRef, useState } from 'react';
import { Game } from './Game';
import { Home } from './Home';
import { Lobby } from './Lobby';
import { useRoom } from './useRoom';

export function App() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const { state, connecting, connect, send, act, leave } = useRoom(notify);

  let screen;
  if (!state) screen = <Home connect={connect} notify={notify} busy={connecting} />;
  else if (!state.game) screen = <Lobby room={state.room} you={state.you} send={send} leave={leave} notify={notify} />;
  else screen = <Game room={state.room} game={state.game} you={state.you} act={act} send={send} leave={leave} notify={notify} />;

  return (
    <>
      {screen}
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
