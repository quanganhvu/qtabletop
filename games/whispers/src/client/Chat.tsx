import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CHAT_MAX, type Channel, type GameView } from '../shared/game';
import type { RoomInfo } from '../shared/protocol';
import { PRESET_ARMS } from '../shared/heraldry';
import { Crest, cx } from './pieces';
import { chatSound } from './sfx';

/** Why you can't speak right now, or null if you can. */
function silenced(game: GameView, channel: Channel): string | null {
  const me = game.players.find((p) => p.id === game.you);
  if (!me) return 'Spectators watch in silence.';
  if (game.phase === 'over') return null;
  if (!me.alive) return 'The dead watch in silence.';
  if (channel === 'coven') return game.phase === 'night' ? null : 'The coven speaks only at night.';
  return game.phase === 'night' || game.phase === 'brew' ? 'The village is asleep. Talk resumes at dawn.' : null;
}

/** The village's talk by day, and the coven's whispers by night (witches only). */
export function Chat({ game, room, send }: { game: GameView; room: RoomInfo; send: (channel: Channel, text: string) => void }) {
  const isWolf = game.myRole === 'coven'; // a witch of the coven
  const [tab, setTab] = useState<Channel>(isWolf && game.phase === 'night' ? 'coven' : 'day');
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const channel: Channel = isWolf || game.phase === 'over' ? tab : 'day';
  const messages = game.chat.filter((m) => m.channel === channel);
  const reason = silenced(game, channel);

  // Witches are switched to the coven's chat at nightfall and back to the village at dawn.
  useEffect(() => {
    if (isWolf) setTab(game.phase === 'night' ? 'coven' : 'day');
  }, [game.phase, isWolf]);

  // A quiet note for other people's messages.
  const lastId = useRef(game.chat.at(-1)?.id ?? 0);
  useEffect(() => {
    const fresh = game.chat.filter((m) => m.id > lastId.current);
    lastId.current = game.chat.at(-1)?.id ?? lastId.current;
    if (fresh.some((m) => m.from !== game.you)) chatSound();
  }, [game.chat, game.you]);

  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, channel]);

  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? '?';
  const armsOf = (id: string) => room.players.find((p) => p.id === id)?.arms ?? PRESET_ARMS[0];
  const unreadCoven = isWolf && channel === 'day' && game.phase === 'night';

  const submit = () => {
    const t = text.trim();
    if (!t || reason) return;
    send(channel, t);
    setText('');
  };

  return (
    <section className={cx('chat', channel === 'coven' && 'den')} aria-label="Chat">
      <div className="chat-tabs" role="tablist">
        <button role="tab" aria-selected={channel === 'day'} className={cx('chat-tab', channel === 'day' && 'on')} onClick={() => setTab('day')}>Village</button>
        {(isWolf || game.phase === 'over') && (
          <button role="tab" aria-selected={channel === 'coven'} className={cx('chat-tab', channel === 'coven' && 'on', unreadCoven && 'ping')} onClick={() => setTab('coven')}>
            The Coven
          </button>
        )}
      </div>
      <ol className="chat-list" ref={listRef}>
        {messages.length === 0 && (
          <li className="chat-empty">{channel === 'coven' ? 'Only the coven can read this. Choose your victim.' : 'Nothing said yet. Who do you suspect?'}</li>
        )}
        {messages.map((m) => (
          <li key={m.id} className={cx('chat-msg', m.from === game.you && 'mine')}>
            <Crest arms={armsOf(m.from)} size={20} />
            <div><b>{nameOf(m.from)}</b><span>{m.text}</span></div>
          </li>
        ))}
      </ol>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input
          value={text}
          maxLength={CHAT_MAX}
          disabled={!!reason}
          placeholder={reason ?? (channel === 'coven' ? 'Whisper to the coven…' : 'Speak to the village…')}
          onChange={(e) => setText(e.target.value)}
          aria-label="Message"
        />
        <button className="btn small" disabled={!!reason || !text.trim()}>Say</button>
      </form>
    </section>
  );
}
