// Sound effects synthesized with the Web Audio API: no audio files to ship or license.
// Browsers only allow audio after a user gesture, so the context is created lazily
// and unlocked on the first click; sounds before that are silently skipped.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem('splendor.muted') === '1';
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
    localStorage.setItem('splendor.muted', value ? '1' : '0');
  } catch {
    // ignore
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx.state === 'running' ? ctx : null;
}

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
    noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function tone(ac: AudioContext, freq: number, start: number, length: number, volume: number, type: OscillatorType = 'sine') {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

function hiss(ac: AudioContext, start: number, length: number, volume: number, fromHz: number, toHz: number) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(fromHz, start);
  filter.frequency.exponentialRampToValueAtTime(toHz, start + length);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(start);
  src.stop(start + length);
}

/** Clay chips clicking together. */
export function chipSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  hiss(ac, t, 0.04, 0.35, 4000, 2500);
  tone(ac, 2400 + Math.random() * 400, t, 0.07, 0.12, 'triangle');
  tone(ac, 3600 + Math.random() * 500, t + 0.012, 0.05, 0.06, 'triangle');
}

/** A card sliding across the table. */
export function cardSound() {
  const ac = audio();
  if (!ac) return;
  hiss(ac, ac.currentTime, 0.22, 0.25, 900, 3500);
}

/** Bright "it's your turn" chime. */
export function turnChime() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [1046.5, 1318.5, 1568].forEach((f, i) => tone(ac, f, t + i * 0.09, 0.6, 0.12));
}

/** Sparkle for scoring points or a noble visit. */
export function sparkleSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [1568, 2093, 2637, 3136].forEach((f, i) => tone(ac, f, t + i * 0.05, 0.35, 0.07));
}

/** End-of-game fanfare. */
export function fanfare() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, f, t + i * 0.14, 0.5, 0.14, 'triangle'));
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(ac, f, t + 0.62, 1.4, 0.07, 'triangle'));
}
