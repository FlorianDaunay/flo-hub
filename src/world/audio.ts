// Generative soundtrack, no files: a slow detuned synth pad (Vangelis-like), rain hiss,
// a sub drone and thunder. Web Audio only, a handful of nodes.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let stopPad: (() => void) | null = null;

function noiseBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function reverb(c: AudioContext, seconds = 5) {
  const conv = c.createConvolver();
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  conv.buffer = buf;
  return conv;
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
// Am9 – Fmaj7 – Dm9 – Em7(sus), voiced low and wide.
const CHORDS = [
  [45, 57, 60, 64, 71],
  [41, 57, 60, 64, 69],
  [38, 53, 57, 60, 64],
  [40, 55, 59, 62, 67],
];

export function startAudio(volume = 0.5) {
  if (ctx) {
    ctx.resume();
    master!.gain.setTargetAtTime(volume, ctx.currentTime, 0.8);
    return;
  }
  const c = new AudioContext();
  ctx = c;
  master = c.createGain();
  master.gain.value = 0;
  master.gain.setTargetAtTime(volume, c.currentTime, 1.5);
  const comp = c.createDynamicsCompressor();
  master.connect(comp).connect(c.destination);

  const verb = reverb(c);
  const wet = c.createGain();
  wet.gain.value = 0.55;
  verb.connect(wet).connect(master);

  // Rain: bright hiss + soft low wash.
  const rainSrc = c.createBufferSource();
  rainSrc.buffer = noiseBuffer(c, 4);
  rainSrc.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1400;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 7000;
  const rainGain = c.createGain();
  rainGain.gain.value = 0.07;
  rainSrc.connect(hp).connect(lp).connect(rainGain).connect(master);
  const washLp = c.createBiquadFilter();
  washLp.type = "lowpass";
  washLp.frequency.value = 380;
  const washGain = c.createGain();
  washGain.gain.value = 0.09;
  rainSrc.connect(washLp).connect(washGain).connect(master);
  rainSrc.start();

  // Pad: each chord fades in over the previous one.
  const padBus = c.createBiquadFilter();
  padBus.type = "lowpass";
  padBus.frequency.value = 900;
  padBus.Q.value = 2;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoAmt = c.createGain();
  lfoAmt.gain.value = 500;
  lfo.connect(lfoAmt).connect(padBus.frequency);
  lfo.start();
  const padGain = c.createGain();
  padGain.gain.value = 0.11;
  padBus.connect(padGain);
  padGain.connect(master);
  padGain.connect(verb);

  const CHORD_LEN = 9;
  let step = 0;
  let timer = 0;
  const playChord = () => {
    const t0 = c.currentTime + 0.05;
    for (const n of CHORDS[step % CHORDS.length]) {
      const env = c.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(n < 50 ? 0.55 : 0.32, t0 + 3.5);
      env.gain.setTargetAtTime(0, t0 + CHORD_LEN - 1, 1.6);
      env.connect(padBus);
      for (const det of [-7, 6]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midi(n);
        o.detune.value = det;
        o.connect(env);
        o.start(t0);
        o.stop(t0 + CHORD_LEN + 7);
      }
    }
    step++;
  };
  playChord();
  timer = window.setInterval(playChord, CHORD_LEN * 1000);

  // Sub drone.
  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = midi(33);
  const subGain = c.createGain();
  subGain.gain.value = 0.07;
  sub.connect(subGain).connect(master);
  sub.start();

  stopPad = () => clearInterval(timer);
}

export function thunder() {
  if (!ctx || !master || ctx.state !== "running") return;
  const c = ctx;
  const delay = 0.6 + Math.random() * 1.5;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 5);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 160;
  const g = c.createGain();
  const t = c.currentTime + delay;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.9, t + 0.15);
  g.gain.setTargetAtTime(0, t + 0.6, 1.1);
  src.connect(lp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 5);
}

export function muteAudio() {
  if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
}

export function stopAudio() {
  stopPad?.();
  stopPad = null;
  ctx?.close();
  ctx = null;
  master = null;
}
