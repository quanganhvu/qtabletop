// Village sound effects, synthesized with the Web Audio API: no audio files to
// ship or license. An owl calls and voices whisper as night falls, the church
// bell rings in the dawn and tolls for the dead, crows scatter at a curse, votes
// knock on the table, a lyre plucks softly for your own moves and new messages,
// and horns or a swelling chant end the game.
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
    return localStorage.getItem('whispers.muted') === '1';
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
    localStorage.setItem('whispers.muted', value ? '1' : '0');
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
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A swell of filtered noise: wind, breath, a knock's click. */
function hiss(ac: AudioContext, start: number, length: number, volume: number, type: BiquadFilterType, freq: number, q = 0.8, attack = 0.02) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + Math.min(attack, length / 2));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(amp).connect(out());
  src.start(start, Math.random() * 0.5);
  src.stop(start + length + 0.05);
}

// ---- Instruments -----------------------------------------------------------------

/** A tawny owl's call: a soft, hollow "hoo", then a longer wavering "hoo-oo". */
function owl(ac: AudioContext, start: number, volume: number) {
  const call = (at: number, length: number, from: number, to: number) => {
    const osc = ac.createOscillator();
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.linearRampToValueAtTime(to, at + length);
    const wobble = ac.createOscillator();
    const depth = ac.createGain();
    wobble.frequency.value = 9;
    depth.gain.value = length > 0.4 ? 6 : 0;
    wobble.connect(depth).connect(osc.frequency);
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(volume, at + 0.06);
    amp.gain.setValueAtTime(volume, at + length - 0.08);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 900;
    osc.connect(tone).connect(amp).connect(out());
    osc.start(at);
    wobble.start(at);
    osc.stop(at + length + 0.05);
    wobble.stop(at + length + 0.05);
    hiss(ac, at, length, volume * 0.12, 'bandpass', from * 2, 3, 0.05);
  };
  call(start, 0.32, 410, 395);
  call(start + 0.7, 0.9, 400, 360);
}

/**
 * Whispering: breath shaped by shifting vowel resonances, in short syllables,
 * like several voices muttering a chant just out of earshot.
 */
function whisper(ac: AudioContext, start: number, length: number, volume: number) {
  const syllables = Math.max(3, Math.round(length / 0.16));
  for (let i = 0; i < syllables; i++) {
    const at = start + i * (length / syllables) + Math.random() * 0.04;
    const dur = 0.09 + Math.random() * 0.08;
    // Two formants per syllable, picked from rough vowel shapes.
    const [f1, f2] = [[700, 1200], [400, 2200], [300, 900], [600, 1700], [500, 1000]][Math.floor(Math.random() * 5)];
    for (const [f, gain] of [[f1, 1], [f2, 0.6]]) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac);
      const band = ac.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = f;
      band.Q.value = 6;
      const amp = ac.createGain();
      amp.gain.setValueAtTime(0, at);
      amp.gain.linearRampToValueAtTime(volume * gain, at + dur * 0.3);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(band).connect(amp).connect(out());
      src.start(at, Math.random() * 1.5);
      src.stop(at + dur + 0.02);
    }
    // The hiss of an "s" now and then.
    if (Math.random() < 0.35) hiss(ac, at + dur, 0.07, volume * 0.5, 'highpass', 5000, 0.7, 0.01);
  }
}

/** A crow's harsh "caw": a rasping, falling tone. */
function crow(ac: AudioContext, start: number, volume: number) {
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(820, start);
  osc.frequency.exponentialRampToValueAtTime(560, start + 0.22);
  const rasp = ac.createOscillator();
  const raspDepth = ac.createGain();
  rasp.frequency.value = 70;
  raspDepth.gain.value = 120;
  rasp.connect(raspDepth).connect(osc.frequency);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1400;
  band.Q.value = 1.4;
  const amp = ac.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(volume, start + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
  osc.connect(band).connect(amp).connect(out());
  osc.start(start);
  rasp.start(start);
  osc.stop(start + 0.3);
  rasp.stop(start + 0.3);
}

/** A church bell: deep and long, with the bright, inharmonic strike of bronze. */
function churchBell(ac: AudioContext, freq: number, start: number, volume: number, length = 3.5) {
  for (const [ratio, level, decay] of [[0.5, 0.5, 1.3], [1, 0.7, 1], [1.2, 0.35, 0.7], [1.5, 0.25, 0.55], [2, 0.3, 0.45], [2.6, 0.12, 0.25]]) {
    const osc = ac.createOscillator();
    osc.frequency.value = freq * ratio;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(volume * level, start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + length * decay);
    osc.connect(amp).connect(out());
    osc.start(start);
    osc.stop(start + length * decay + 0.1);
  }
}

/** A lyre string plucked by hand (Karplus–Strong) through a hollow wooden body. */
function lyre(ac: AudioContext, freq: number, start: number, volume: number) {
  const key = Math.round(freq);
  let buffer = strings.get(key);
  if (!buffer) {
    const rate = ac.sampleRate;
    buffer = ac.createBuffer(1, Math.floor(rate * 1.4), rate);
    const data = buffer.getChannelData(0);
    const period = Math.max(2, Math.round(rate / freq));
    let last = 0;
    for (let i = 0; i < period; i++) data[i] = last = 0.6 * last + 0.4 * (Math.random() * 2 - 1);
    for (let i = period; i < data.length; i++) data[i] = 0.991 * 0.5 * (data[i - period] + data[i - period + 1]);
    strings.set(key, buffer);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2200;
  const amp = ac.createGain();
  amp.gain.value = volume;
  src.connect(tone).connect(amp).connect(out());
  src.start(start);
}

/** A cow horn: a buzzy, hollow tone that swells and bends up into pitch. */
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
  for (const [type, detune] of [['sawtooth', -4], ['triangle', 5]] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * 0.94, start);
    osc.frequency.exponentialRampToValueAtTime(freq, start + 0.14);
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + length + 0.3);
  }
  filter.connect(amp).connect(out());
}

// ---- Game sounds ------------------------------------------------------------------

/** Night falls: a cold wind, an owl calls, and something whispers in the dark. */
export function nightSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  hiss(ac, t, 3, 0.08, 'bandpass', 500, 0.6, 1);
  owl(ac, t + 0.3, 0.11);
  whisper(ac, t + 1.6, 1.4, 0.07);
}

/** Dawn: the church bell rings twice, gently. */
export function dawnSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  churchBell(ac, 330, t, 0.1, 3);
  churchBell(ac, 262, t + 0.6, 0.1, 3.5);
}

/** A death: one low toll. */
export function deathSound() {
  const ac = audio();
  if (!ac) return;
  churchBell(ac, 147, ac.currentTime, 0.16, 5);
}

/** A vote cast: a knock on the table. */
export function voteSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.09);
  amp.gain.setValueAtTime(0.3, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  osc.connect(amp).connect(out());
  osc.start(t);
  osc.stop(t + 0.17);
  hiss(ac, t, 0.04, 0.2, 'bandpass', 1800, 1.2, 0.004);
}

/** Your move made, or your moment to act: a soft rising pair on the lyre. */
export function chimeSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  lyre(ac, 440, t, 0.32);
  lyre(ac, 659.3, t + 0.12, 0.28);
}

/** A new chat message: one quiet high note. */
export function chatSound() {
  const ac = audio();
  if (!ac) return;
  lyre(ac, 880, ac.currentTime, 0.12);
}

/** The village wins: horns answer each other and the bell rings out. */
export function villageWinSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  horn(ac, 146.8, t, 0.5, 0.11);
  horn(ac, 196, t + 0.55, 0.5, 0.11);
  horn(ac, 220, t + 1.1, 1.1, 0.12);
  churchBell(ac, 262, t + 1.4, 0.12, 3.5);
  churchBell(ac, 330, t + 2.1, 0.1, 3);
}

/** The coven wins: the whispered chant swells, crows scatter, and a bell tolls once. */
export function covenWinSound() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  hiss(ac, t, 3.6, 0.07, 'bandpass', 450, 0.6, 1);
  whisper(ac, t, 2.4, 0.09);
  whisper(ac, t + 0.2, 2.2, 0.06);
  [1.6, 1.85, 2.3, 2.5].forEach((d) => crow(ac, t + d, 0.09));
  churchBell(ac, 110, t + 2.8, 0.14, 5);
}

/** A sting of dread for a death: a deep boom and a dissonant shriek, tuned to how they died. */
export function stingSound(cause: 'curse' | 'poison' | 'lynch' | 'hunter') {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  // The boom.
  const boom = ac.createOscillator();
  const boomAmp = ac.createGain();
  boom.frequency.setValueAtTime(90, t);
  boom.frequency.exponentialRampToValueAtTime(32, t + 0.9);
  boomAmp.gain.setValueAtTime(0.5, t);
  boomAmp.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  boom.connect(boomAmp).connect(out());
  boom.start(t);
  boom.stop(t + 1.5);
  // A dissonant cluster of strings, scraping in.
  for (const f of cause === 'poison' ? [233, 247, 349] : [311, 330, 466]) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f * 1.02, t);
    osc.frequency.linearRampToValueAtTime(f, t + 1.2);
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = f * 3;
    filter.Q.value = 2;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.05, t + 0.08);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    osc.connect(filter).connect(amp).connect(out());
    osc.start(t);
    osc.stop(t + 1.9);
  }
  // Claws tear, the arrow whooshes, the trapdoor drops.
  if (cause === 'curse') {
    whisper(ac, t, 0.8, 0.12);
    crow(ac, t + 0.5, 0.1);
    crow(ac, t + 0.75, 0.08);
  }
  if (cause === 'hunter') hiss(ac, t, 0.3, 0.2, 'bandpass', 1500, 1, 0.25);
  if (cause === 'lynch') hiss(ac, t, 0.12, 0.3, 'lowpass', 600, 0.7, 0.005);
}
