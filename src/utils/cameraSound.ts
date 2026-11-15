let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => undefined);
  }
  return sharedAudioCtx;
}

export function playShutterClick(enabled: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.055), ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.01));
    channel[i] = (Math.random() * 2 - 1) * env;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2400, now);
  filter.Q.setValueAtTime(1.4, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.42, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);

  const thumpOsc = ctx.createOscillator();
  const thumpGain = ctx.createGain();
  thumpOsc.type = 'triangle';
  thumpOsc.frequency.setValueAtTime(210, now);
  thumpOsc.frequency.exponentialRampToValueAtTime(55, now + 0.045);
  thumpGain.gain.setValueAtTime(0.24, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  thumpOsc.connect(thumpGain);
  thumpGain.connect(ctx.destination);
  thumpOsc.start(now);
  thumpOsc.stop(now + 0.05);
}

export function playCountdownBeep(enabled: boolean, finalBeep = false) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(finalBeep ? 1120 : 780, now);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

export function playRecordTone(enabled: boolean, starting: boolean) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  if (starting) {
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.07);
  } else {
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(523.25, now + 0.07);
  }
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.19);
}
