// Medieval sound effects, synthesized with the Web Audio API: no audio files to
// ship or license. Tiles knock on the table, followers clink, a handbell
// announces your turn, a lute plucks when you score, and heralds sound the end.
//
// Browsers only allow audio after a user gesture, so the context is created lazily
// and unlocked on the first click; sounds before that are silently skipped.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let master: GainNode | null = null;
const plucks = new Map<number, AudioBuffer>();
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

// ---- Instruments -----------------------------------------------------------------

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

/** A plucked lute string (Karplus–Strong), rendered once per pitch. */
function pluck(ac: AudioContext, freq: number, start: number, volume: number) {
  const key = Math.round(freq);
  let buffer = plucks.get(key);
  if (!buffer) {
    const rate = ac.sampleRate;
    buffer = ac.createBuffer(1, Math.floor(rate * 1.6), rate);
    const data = buffer.getChannelData(0);
    const period = Math.max(2, Math.round(rate / freq));
    for (let i = 0; i < period; i++) data[i] = Math.random() * 2 - 1;
    for (let i = period; i < data.length; i++) data[i] = 0.994 * 0.5 * (data[i - period] + data[i - period + 1]);
    plucks.set(key, buffer);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3200;
  const amp = ac.createGain();
  amp.gain.value = volume;
  src.connect(tone).connect(amp).connect(out());
  src.start(start);
}

/** A herald's trumpet: bright sawtooths through an opening filter, with a little vibrato. */
function trumpet(ac: AudioContext, freq: number, start: number, length: number, volume: number) {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(500, start);
  filter.frequency.linearRampToValueAtTime(freq * 6, start + 0.06);
  filter.frequency.setTargetAtTime(freq * 4, start + 0.08, 0.1);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + 0.03);
  amp.gain.setValueAtTime(volume * 0.85, start + length - 0.06);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length + 0.12);
  const vibrato = ac.createOscillator();
  const vibratoDepth = ac.createGain();
  vibrato.frequency.value = 5.2;
  vibratoDepth.gain.value = freq * 0.006;
  vibrato.connect(vibratoDepth);
  for (const detune of [-6, 5]) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    vibratoDepth.connect(osc.frequency);
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + length + 0.2);
  }
  filter.connect(amp).connect(out());
  vibrato.start(start);
  vibrato.stop(start + length + 0.2);
}

/** A war drum: a falling low thump with a skin slap. */
function drum(ac: AudioContext, start: number, volume: number) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.frequency.setValueAtTime(130, start);
  osc.frequency.exponentialRampToValueAtTime(48, start + 0.35);
  amp.gain.setValueAtTime(volume, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
  osc.connect(amp).connect(out());
  osc.start(start);
  osc.stop(start + 0.55);
  const slap = ac.createBufferSource();
  slap.buffer = noiseBuffer(ac);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const slapAmp = ac.createGain();
  slapAmp.gain.setValueAtTime(volume * 0.5, start);
  slapAmp.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
  slap.connect(lp).connect(slapAmp).connect(out());
  slap.start(start, Math.random() * 0.5);
  slap.stop(start + 0.1);
}

// ---- Game sounds ------------------------------------------------------------------

/** Gold coins clinking onto a table, with a small bounce. */
export function chipSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const f = 2400 + Math.random() * 500;
  bell(ac, f, t, 0.22, 0.09, 1.4);
  bell(ac, f * 1.32, t + 0.005, 0.12, 0.05, 1.2);
  bell(ac, f * 0.97, t + 0.07 + Math.random() * 0.03, 0.12, 0.04, 1.2);
}

/** A sheet of parchment sliding and rustling. */
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
  // A crackly envelope: several quick swells rather than one smooth hiss.
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

/** A handbell's "ding-dong" announcing your turn. */
export function turnChime() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  bell(ac, 784, t, 1.4, 0.13);
  bell(ac, 587.3, t + 0.32, 1.8, 0.13);
}

/** A rising lute arpeggio for renown or a noble house's allegiance (D Dorian). */
export function sparkleSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [293.7, 349.2, 440, 587.3].forEach((f, i) => pluck(ac, f, t + i * 0.085, 0.35));
  pluck(ac, 880, t + 0.42, 0.22);
}

/** Herald trumpets and a war drum for the end of the game. */
export function fanfare() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  drum(ac, t, 0.5);
  const notes: [number, number, number][] = [
    [261.6, 0.0, 0.16], [261.6, 0.2, 0.16], [261.6, 0.4, 0.16], [392, 0.6, 0.5], [329.6, 1.15, 0.22], [392, 1.4, 0.22], [523.3, 1.65, 1.1],
  ];
  for (const [f, at, len] of notes) trumpet(ac, f, t + at, len, 0.07);
  for (const [f, at, len] of notes.slice(3)) trumpet(ac, f / 2, t + at, len, 0.04);
  drum(ac, t + 0.6, 0.4);
  drum(ac, t + 1.65, 0.55);
  drum(ac, t + 1.85, 0.35);
}

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
  const click = ac.createBufferSource();
  click.buffer = noiseBuffer(ac);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800;
  band.Q.value = 1.2;
  const clickAmp = ac.createGain();
  clickAmp.gain.setValueAtTime(0.25, t);
  clickAmp.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  click.connect(band).connect(clickAmp).connect(out());
  click.start(t, Math.random() * 0.5);
  click.stop(t + 0.05);
}
