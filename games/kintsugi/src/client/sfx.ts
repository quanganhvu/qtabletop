// Potters' sounds, synthesized with the Web Audio API: no audio files to ship
// or license. Ceramic tiles clack as they are gathered and set, crack when they
// break, a rin bell calls your turn, a koto rings in each new round, and taiko
// drums and a temple bell close the game.
//
// Browsers only allow audio after a user gesture, so the context is created lazily
// and unlocked on the first click; sounds before that are silently skipped.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let master: GainNode | null = null;
const strings = new Map<number, AudioBuffer>();
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem('kintsugi.muted') === '1';
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem('kintsugi.muted', value ? '1' : '0');
  } catch {
    // ignore
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx.state === 'running' ? ctx : null;
}

const out = () => master!;

// Unlock audio on the first interaction.
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (!muted) audio();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A burst of filtered noise. */
function hiss(ac: AudioContext, start: number, length: number, volume: number, type: BiquadFilterType, freq: number, q = 0.8) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + Math.min(0.004, length / 4));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(amp).connect(out());
  src.start(start, Math.random() * 0.5);
  src.stop(start + length + 0.05);
}

/** A sum of decaying sine partials: the ring of ceramic or bronze. */
function partials(ac: AudioContext, freq: number, start: number, volume: number, parts: [number, number, number][]) {
  for (const [ratio, level, decay] of parts) {
    const osc = ac.createOscillator();
    osc.frequency.value = freq * ratio;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(volume * level, start + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    osc.connect(amp).connect(out());
    osc.start(start);
    osc.stop(start + decay + 0.05);
  }
}

// ---- Instruments -----------------------------------------------------------------

/** Two glazed tiles knocking together: a dry, woody-bright clack. */
function clack(ac: AudioContext, start: number, volume: number) {
  const f = 1300 + Math.random() * 500;
  partials(ac, f, start, volume, [[1, 1, 0.07], [2.3, 0.45, 0.045], [3.9, 0.2, 0.03]]);
  hiss(ac, start, 0.025, volume * 0.8, 'bandpass', 3200, 1.2);
}

/** A rin: the small bronze singing bowl of a temple, struck once. */
function rin(ac: AudioContext, freq: number, start: number, volume: number) {
  partials(ac, freq, start, volume, [[1, 1, 3.2], [2.71, 0.5, 2.2], [5.15, 0.22, 1.2], [8.2, 0.08, 0.6]]);
}

/** A temple bell (bonshō): very deep and long. */
function templeBell(ac: AudioContext, freq: number, start: number, volume: number) {
  partials(ac, freq, start, volume, [[0.5, 0.6, 6], [1, 0.7, 5], [1.18, 0.3, 3.5], [1.52, 0.25, 2.5], [2.0, 0.2, 2], [2.7, 0.1, 1.2]]);
}

/** A koto string, plucked (Karplus–Strong): bright attack, quick shimmer, long ring. */
function koto(ac: AudioContext, freq: number, start: number, volume: number) {
  const key = Math.round(freq);
  let buffer = strings.get(key);
  if (!buffer) {
    const rate = ac.sampleRate;
    buffer = ac.createBuffer(1, Math.floor(rate * 1.8), rate);
    const data = buffer.getChannelData(0);
    const period = Math.max(2, Math.round(rate / freq));
    for (let i = 0; i < period; i++) data[i] = Math.random() * 2 - 1; // a plectrum's sharp pluck
    for (let i = period; i < data.length; i++) data[i] = 0.996 * 0.5 * (data[i - period] + data[i - period + 1]);
    strings.set(key, buffer);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const body = ac.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 900;
  body.Q.value = 1.2;
  body.gain.value = 5;
  const amp = ac.createGain();
  amp.gain.value = volume;
  src.connect(body).connect(amp).connect(out());
  src.start(start);
}

/** A taiko drum: a deep boom with the slap of the head. */
function taiko(ac: AudioContext, start: number, volume: number) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.frequency.setValueAtTime(95, start);
  osc.frequency.exponentialRampToValueAtTime(48, start + 0.4);
  amp.gain.setValueAtTime(volume, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
  osc.connect(amp).connect(out());
  osc.start(start);
  osc.stop(start + 0.75);
  hiss(ac, start, 0.08, volume * 0.5, 'lowpass', 900);
}

// In-scale (miyako-bushi) notes on D: D Eb G A Bb.
const SCALE = [293.7, 311.1, 392, 440, 466.2, 587.3, 622.3, 784];

// ---- Game sounds ------------------------------------------------------------------

/** Gathering tiles: a little run of clacks, one per tile. */
export function takeSound(count = 3) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < Math.min(count, 5); i++) clack(ac, t + i * 0.075 + Math.random() * 0.02, 0.12);
}

/** A tile pressed into place: a soft, low knock. */
export function setSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.07);
  amp.gain.setValueAtTime(0.22, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(amp).connect(out());
  osc.start(t);
  osc.stop(t + 0.14);
  hiss(ac, t, 0.03, 0.12, 'bandpass', 2400, 1);
}

/** A tile breaking on the floor: a sharp crack, then shards scattering. */
export function breakSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  hiss(ac, t, 0.09, 0.35, 'highpass', 1800, 0.7);
  for (let i = 0; i < 6; i++) clack(ac, t + 0.04 + Math.random() * 0.3, 0.04 + Math.random() * 0.04);
}

/** A rin bell calls your turn. */
export function turnChime() {
  const ac = audio();
  if (!ac) return;
  rin(ac, 1046.5, ac.currentTime, 0.1);
}

/** The walls are tiled: a koto run up the scale. */
export function roundSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [0, 1, 2, 3, 4, 5].forEach((n, i) => koto(ac, SCALE[n], t + i * 0.1, 0.32));
  koto(ac, SCALE[7], t + 0.7, 0.26);
}

/** The end of the game: taiko drums build, the koto answers, and the temple bell sounds. */
export function fanfare() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [0, 0.45, 0.9, 1.15, 1.4, 1.6].forEach((d, i) => taiko(ac, t + d, 0.35 + i * 0.05));
  [5, 4, 3, 2, 3, 5, 7].forEach((n, i) => koto(ac, SCALE[n], t + 1.9 + i * 0.16, 0.3));
  templeBell(ac, 146.8, t + 3.2, 0.16);
}
