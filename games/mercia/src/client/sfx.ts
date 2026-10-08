// Old English sound effects, synthesized with the Web Audio API: no audio files
// to ship or license. Tiles knock on the table, banners thud into the turf and
// flap, a cow horn calls your turn, an Anglo-Saxon lyre is plucked when you
// score, and war horns, a frame drum and a church bell sound the end.
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
    return localStorage.getItem('mercia.muted') === '1';
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
    localStorage.setItem('mercia.muted', value ? '1' : '0');
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

/** A burst of filtered noise: breath, cloth, a brush of turf. */
function hiss(ac: AudioContext, start: number, length: number, volume: number, type: BiquadFilterType, freq: number, q = 0.8) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + Math.min(0.02, length / 3));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(amp).connect(out());
  src.start(start, Math.random() * 0.5);
  src.stop(start + length + 0.05);
}

// ---- Instruments -----------------------------------------------------------------

/**
 * An Anglo-Saxon lyre string: gut plucked by hand (Karplus–Strong), darker and
 * shorter than a lute, through a hollow wooden body resonance.
 */
function lyre(ac: AudioContext, freq: number, start: number, volume: number) {
  const key = Math.round(freq);
  let buffer = strings.get(key);
  if (!buffer) {
    const rate = ac.sampleRate;
    buffer = ac.createBuffer(1, Math.floor(rate * 1.4), rate);
    const data = buffer.getChannelData(0);
    const period = Math.max(2, Math.round(rate / freq));
    // A soft finger pluck: smoothed noise rather than a sharp pick.
    let last = 0;
    for (let i = 0; i < period; i++) data[i] = last = 0.6 * last + 0.4 * (Math.random() * 2 - 1);
    for (let i = period; i < data.length; i++) data[i] = 0.991 * 0.5 * (data[i - period] + data[i - period + 1]);
    strings.set(key, buffer);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2000;
  const body = ac.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 260;
  body.Q.value = 1.4;
  body.gain.value = 7;
  const amp = ac.createGain();
  amp.gain.value = volume;
  src.connect(tone).connect(body).connect(amp).connect(out());
  src.start(start);
}

/**
 * A cow or war horn: a buzzy, hollow tone that swells, bends up into pitch at
 * the start, with a little breath on top.
 */
function horn(ac: AudioContext, freq: number, start: number, length: number, volume: number) {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 3;
  filter.frequency.setValueAtTime(freq * 1.5, start);
  filter.frequency.linearRampToValueAtTime(freq * 4.5, start + 0.18);
  filter.frequency.setTargetAtTime(freq * 3.2, start + 0.25, 0.2);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + 0.12);
  amp.gain.setValueAtTime(volume * 0.9, start + length - 0.15);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length + 0.25);
  for (const [type, detune, mix] of [['sawtooth', -4, 0.7], ['triangle', 5, 1]] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * 0.94, start);
    osc.frequency.exponentialRampToValueAtTime(freq, start + 0.14);
    osc.detune.value = detune;
    const g = ac.createGain();
    g.gain.value = mix;
    osc.connect(g).connect(filter);
    osc.start(start);
    osc.stop(start + length + 0.3);
  }
  filter.connect(amp).connect(out());
  hiss(ac, start, length * 0.6, volume * 0.25, 'bandpass', freq * 6, 1.5);
}

/** A church bell: deep and long, with the bright, inharmonic strike of bronze. */
function churchBell(ac: AudioContext, freq: number, start: number, volume: number) {
  // Bell partials: hum, prime, tierce, quint and nominal, each fading at its own pace.
  for (const [ratio, level, decay] of [[0.5, 0.5, 4.5], [1, 0.7, 3.5], [1.2, 0.35, 2.4], [1.5, 0.25, 2], [2, 0.3, 1.6], [2.6, 0.12, 0.9]]) {
    const osc = ac.createOscillator();
    osc.frequency.value = freq * ratio;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(volume * level, start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    osc.connect(amp).connect(out());
    osc.start(start);
    osc.stop(start + decay + 0.1);
  }
}

/** A frame drum struck with the hand: a soft low boom and a skin slap. */
function frameDrum(ac: AudioContext, start: number, volume: number) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.frequency.setValueAtTime(110, start);
  osc.frequency.exponentialRampToValueAtTime(55, start + 0.3);
  amp.gain.setValueAtTime(volume, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
  osc.connect(amp).connect(out());
  osc.start(start);
  osc.stop(start + 0.5);
  hiss(ac, start, 0.07, volume * 0.45, 'lowpass', 1200);
}

// ---- Game sounds ------------------------------------------------------------------

/** A wooden tile set down on the table: a dull knock with a short click. */
export function tileSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.09);
  amp.gain.setValueAtTime(0.32, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(amp).connect(out());
  osc.start(t);
  osc.stop(t + 0.18);
  hiss(ac, t, 0.04, 0.25, 'bandpass', 1800, 1.2);
}

/** A banner planted: the pole thuds into the turf and the cloth flaps twice. */
export function bannerSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
  amp.gain.setValueAtTime(0.3, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(amp).connect(out());
  osc.start(t);
  osc.stop(t + 0.22);
  hiss(ac, t + 0.08, 0.12, 0.12, 'bandpass', 900, 0.7);
  hiss(ac, t + 0.2, 0.1, 0.08, 'bandpass', 1100, 0.7);
}

/** A cow horn calls your turn: a low note rising to its fifth. */
export function turnChime() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  horn(ac, 146.8, t, 0.32, 0.11); // D3
  horn(ac, 220, t + 0.34, 0.6, 0.11); // A3
}

/** A rising run on the lyre when you score (D pentatonic, as an old harper might tune it). */
export function sparkleSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [293.7, 329.6, 392, 440, 587.3].forEach((f, i) => lyre(ac, f, t + i * 0.09, 0.42));
  lyre(ac, 440, t + 0.5, 0.28);
  lyre(ac, 587.3, t + 0.5, 0.22);
}

/** The end of the game: war horns answer each other over a frame drum, and the church bell tolls. */
export function fanfare() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  frameDrum(ac, t, 0.5);
  horn(ac, 110, t + 0.05, 0.9, 0.12); // A2, long
  frameDrum(ac, t + 0.6, 0.35);
  horn(ac, 146.8, t + 1.05, 0.5, 0.1); // D3 answers
  horn(ac, 164.8, t + 1.6, 1.2, 0.12); // E3, held
  frameDrum(ac, t + 1.2, 0.4);
  frameDrum(ac, t + 1.6, 0.55);
  churchBell(ac, 196, t + 2.3, 0.16);
  churchBell(ac, 196, t + 3.6, 0.12);
}
