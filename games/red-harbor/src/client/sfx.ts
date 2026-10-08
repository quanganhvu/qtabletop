// Harbour sound effects, synthesized with the Web Audio API: no audio files to
// ship or license. Coins clink, paper rustles, a ship's bell rings for your
// turn, and a steamer's horn sounds the end of the game.
//
// Browsers only allow audio after a user gesture, so the context is created lazily
// and unlocked on the first click; sounds before that are silently skipped.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let master: GainNode | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem('havre.muted') === '1';
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
    localStorage.setItem('havre.muted', value ? '1' : '0');
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

/** A struck metal bell (FM synthesis with an inharmonic modulator). */
function bell(ac: AudioContext, freq: number, start: number, length: number, volume: number, brightness = 2.2) {
  const carrier = ac.createOscillator();
  const modulator = ac.createOscillator();
  const depth = ac.createGain();
  const amp = ac.createGain();
  carrier.frequency.value = freq;
  modulator.frequency.value = freq * 1.41;
  depth.gain.setValueAtTime(freq * brightness, start);
  depth.gain.exponentialRampToValueAtTime(freq * 0.05, start + length);
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  modulator.connect(depth).connect(carrier.frequency);
  carrier.connect(amp).connect(out());
  modulator.start(start);
  carrier.start(start);
  modulator.stop(start + length + 0.05);
  carrier.stop(start + length + 0.05);
}

/** A steamer's horn: two low detuned sawtooths through a soft filter. */
function horn(ac: AudioContext, freq: number, start: number, length: number, volume: number) {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq * 3;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + 0.12);
  amp.gain.setValueAtTime(volume, start + length - 0.2);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length + 0.3);
  for (const [mult, detune] of [[1, -5], [1, 6], [1.5, 0]] as const) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq * mult;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + length + 0.35);
  }
  filter.connect(amp).connect(out());
}

/** Coins clinking onto a counter. */
export function chipSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const f = 2400 + Math.random() * 500;
  bell(ac, f, t, 0.22, 0.09, 1.4);
  bell(ac, f * 1.32, t + 0.005, 0.12, 0.05, 1.2);
  bell(ac, f * 0.97, t + 0.07 + Math.random() * 0.03, 0.12, 0.04, 1.2);
}

/** Paper sliding and rustling: a building deed changing hands. */
export function cardSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.8;
  band.frequency.setValueAtTime(1400, t);
  band.frequency.linearRampToValueAtTime(2600, t + 0.25);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, t);
  let at = t;
  for (let i = 0; i < 6; i++) {
    at += 0.03 + Math.random() * 0.025;
    amp.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.1, at);
    amp.gain.linearRampToValueAtTime(0.02, at + 0.015);
  }
  amp.gain.linearRampToValueAtTime(0, at + 0.06);
  src.connect(band).connect(amp).connect(out());
  src.start(t, Math.random() * 0.5);
  src.stop(at + 0.1);
}

/** Two strikes of a ship's bell: your turn. */
export function turnChime() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  bell(ac, 880, t, 1.2, 0.12);
  bell(ac, 880, t + 0.28, 1.6, 0.12);
}

/** A steamer's horn for the end of the game. */
export function fanfare() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  horn(ac, 98, t, 1.1, 0.09);
  horn(ac, 98, t + 1.5, 1.8, 0.09);
}
