import { MusicStyle } from '../types/studio';

export interface ScheduledBeatEngine {
  stop: () => void;
  stream: MediaStream | null;
  analyser: AnalyserNode | null;
}

function createNoiseBuffer(ctx: AudioContext, durationSec = 0.35): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function scheduleSnare(
  ctx: AudioContext,
  noiseBuffer: AudioBuffer,
  dest: AudioNode,
  time: number,
  gainAmount = 0.24
) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(1100, time);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(gainAmount, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);
  noise.start(time);
  noise.stop(time + 0.17);

  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(195, time);
  body.frequency.exponentialRampToValueAtTime(95, time + 0.08);
  bodyGain.gain.setValueAtTime(gainAmount * 0.85, time);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  body.connect(bodyGain);
  bodyGain.connect(dest);
  body.start(time);
  body.stop(time + 0.11);
}

function scheduleHiHat(
  ctx: AudioContext,
  noiseBuffer: AudioBuffer,
  dest: AudioNode,
  time: number,
  open = false,
  gainAmount = 0.075
) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(6500, time);
  const gain = ctx.createGain();
  const decay = open ? 0.14 : 0.035;
  gain.gain.setValueAtTime(gainAmount, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  noise.start(time);
  noise.stop(time + decay + 0.01);
}

function scheduleKick(ctx: AudioContext, dest: AudioNode, time: number, punch = 0.45) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(135, time);
  osc.frequency.exponentialRampToValueAtTime(36, time + 0.16);
  gain.gain.setValueAtTime(punch, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.25);
}

function scheduleWarmChord(
  ctx: AudioContext,
  dest: AudioNode,
  freqs: number[],
  startTime: number,
  durationSec: number,
  gainAmount = 0.09
) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(980, startTime);
  filter.frequency.exponentialRampToValueAtTime(560, startTime + durationSec);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, startTime);
  env.gain.linearRampToValueAtTime(gainAmount, startTime + 0.28);
  env.gain.setValueAtTime(gainAmount * 0.85, startTime + Math.max(0.3, durationSec - 0.35));
  env.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

  filter.connect(env);
  env.connect(dest);

  freqs.forEach((f, idx) => {
    const osc = ctx.createOscillator();
    osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(f, startTime);
    osc.detune.setValueAtTime((idx - 1) * 6, startTime);
    osc.connect(filter);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.04);
  });
}

/**
 * Schedules a full multi-track musical song (including 2026 slow-mo chill vibes or custom MP3/WAV)
 * mixed cleanly with loud, clear explainer voiceover audio into one unified AudioContext stream.
 */
export async function startReelSoundtrack(
  cutTimesSeconds: number[],
  totalDurationSeconds: number,
  options: {
    startOffsetSeconds?: number;
    captureStream?: boolean;
    muted?: boolean;
    musicStyle?: MusicStyle;
    musicVolume?: number;
    customAudioUrl?: string | null;
    voiceoverEnabled?: boolean;
    voiceVolume?: number;
    voiceoverAudioUrl?: string | null;
  } = {}
): Promise<ScheduledBeatEngine> {
  const {
    startOffsetSeconds = 0,
    captureStream = false,
    muted = false,
    musicStyle = 'slow-mo-2026',
    musicVolume = 0.2,
    customAudioUrl = null,
    voiceoverEnabled = true,
    voiceVolume = 1.0,
    voiceoverAudioUrl = null,
  } = options;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return { stop: () => {}, stream: null, analyser: null };
  }

  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }

  const masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.94;

  // Separate buses so music plays softly underneath loud, punchy voiceover narration
  const musicBus = ctx.createGain();
  const effectiveMusicGain =
    musicStyle === 'silent'
      ? 0
      : voiceoverEnabled
        ? Math.min(0.42, Math.max(0.05, musicVolume))
        : Math.max(0.25, Math.min(1, musicVolume * 2.1));
  musicBus.gain.value = effectiveMusicGain;

  const voiceBus = ctx.createGain();
  voiceBus.gain.value = voiceoverEnabled ? Math.min(1.8, Math.max(0.6, voiceVolume * 1.35)) : 0;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 16;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.14;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.78;

  musicBus.connect(masterGain);
  voiceBus.connect(masterGain);
  masterGain.connect(compressor);
  compressor.connect(analyser);

  let destNode: MediaStreamAudioDestinationNode | null = null;
  if (captureStream) {
    destNode = ctx.createMediaStreamDestination();
    analyser.connect(destNode);
  }
  if (!muted) {
    analyser.connect(ctx.destination);
  }

  const now = ctx.currentTime;
  const remaining = Math.max(0.25, totalDurationSeconds - startOffsetSeconds);
  const noiseBuffer = createNoiseBuffer(ctx, 0.35);

  // 1) Decode & schedule loud, clear Voiceover Audio if available
  if (voiceoverEnabled && voiceoverAudioUrl) {
    try {
      const voiceRes = await fetch(voiceoverAudioUrl);
      const voiceArr = await voiceRes.arrayBuffer();
      const decodedVoice = await ctx.decodeAudioData(voiceArr);
      const voiceSrc = ctx.createBufferSource();
      voiceSrc.buffer = decodedVoice;
      // Keep voice natural and relaxed; gently cap only if longer than the reel
      if (decodedVoice.duration > totalDurationSeconds - 0.2) {
        const speedRatio = Math.min(1.06, decodedVoice.duration / Math.max(4, totalDurationSeconds - 0.3));
        voiceSrc.playbackRate.value = speedRatio;
      } else {
        voiceSrc.playbackRate.value = 1.0;
      }

      // Crisp presence boost EQ on voiceover
      const presenceFilter = ctx.createBiquadFilter();
      presenceFilter.type = 'peaking';
      presenceFilter.frequency.value = 2800;
      presenceFilter.gain.value = 3.5;

      voiceSrc.connect(presenceFilter);
      presenceFilter.connect(voiceBus);

      const playbackOffset = startOffsetSeconds * voiceSrc.playbackRate.value;
      if (playbackOffset < decodedVoice.duration - 0.1) {
        voiceSrc.start(now, playbackOffset);
      }
    } catch {
      // Ignore invalid voice buffer gracefully
    }
  }

  // 2) Music Layer (Custom Song OR 2026 Slow-Mo Chill Vibe OR Cyberpunk/Phonk/Trailer)
  if (musicStyle !== 'silent') {
    let customLoaded = false;
    if (musicStyle === 'custom' && customAudioUrl) {
      try {
        const response = await fetch(customAudioUrl);
        const arrayBuf = await response.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        const songSource = ctx.createBufferSource();
        songSource.buffer = decoded;
        songSource.loop = true;

        const songGain = ctx.createGain();
        songGain.gain.setValueAtTime(0.01, now);
        songGain.gain.linearRampToValueAtTime(0.95, now + 0.3);
        songGain.gain.setValueAtTime(0.95, now + Math.max(0.35, remaining - 0.7));
        songGain.gain.linearRampToValueAtTime(0.001, now + remaining);

        songSource.connect(songGain);
        songGain.connect(musicBus);

        const offsetInTrack = startOffsetSeconds % Math.max(1, decoded.duration);
        songSource.start(now, offsetInTrack);
        songSource.stop(now + remaining + 0.05);
        customLoaded = true;
      } catch {
        customLoaded = false;
      }
    }

    if (!customLoaded) {
      const effectiveStyle = musicStyle === 'custom' ? 'slow-mo-2026' : musicStyle;

      if (effectiveStyle === 'slow-mo-2026') {
        // Trending 2026 Slowed + Reverb Atmospheric Chill Beat (86 BPM, soft ducked foundation)
        const bpm = 86;
        const beatSec = 60 / bpm;
        const eighth = beatSec / 2;
        const barSec = beatSec * 4;

        // Dreamy slowed Fm7 -> DbMaj7 -> AbMaj7 -> EbMaj7 chord progression
        const chords = [
          [174.61, 207.65, 261.63, 311.13],
          [138.59, 174.61, 207.65, 261.63],
          [207.65, 261.63, 311.13, 392.0],
          [155.56, 196.0, 233.08, 293.66],
        ];
        const subNotes = [87.31, 69.3, 103.83, 77.78];
        const bellMelody = [523.25, 622.25, 466.16, 415.3, 523.25, 392.0, 415.3, 466.16];

        const totalBars = Math.ceil(totalDurationSeconds / barSec);
        for (let b = 0; b < totalBars; b++) {
          const barStartAbs = b * barSec;
          const barEndAbs = Math.min(totalDurationSeconds, (b + 1) * barSec);
          if (barEndAbs <= startOffsetSeconds) continue;
          const relStart = Math.max(0, barStartAbs - startOffsetSeconds);
          const dur = Math.max(0.25, barEndAbs - Math.max(barStartAbs, startOffsetSeconds));
          const chordIdx = b % chords.length;
          scheduleWarmChord(ctx, musicBus, chords[chordIdx], now + relStart, dur, 0.16);
        }

        const totalEighths = Math.floor(totalDurationSeconds / eighth);
        for (let step = 0; step < totalEighths; step++) {
          const t = step * eighth;
          if (t < startOffsetSeconds || t >= totalDurationSeconds - 0.15) continue;
          const trig = now + (t - startOffsetSeconds);
          const stepInBar = step % 8;
          const barIdx = Math.floor(step / 8) % subNotes.length;

          // Deep Slow-Mo 808 Pulse
          if (stepInBar === 0 || stepInBar === 3 || stepInBar === 5) {
            scheduleKick(ctx, musicBus, trig, 0.34);
            const subOsc = ctx.createOscillator();
            const subGain = ctx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(subNotes[barIdx], trig);
            subGain.gain.setValueAtTime(0.22, trig);
            subGain.gain.exponentialRampToValueAtTime(0.001, trig + eighth * 2.2);
            subOsc.connect(subGain);
            subGain.connect(musicBus);
            subOsc.start(trig);
            subOsc.stop(trig + eighth * 2.3);
          }

          // Soft slowed rimshot/snare on beat 3
          if (stepInBar === 4) {
            scheduleSnare(ctx, noiseBuffer, musicBus, trig, 0.14);
          }

          // Silky gentle lo-fi hi-hats
          if (stepInBar % 2 === 0 || stepInBar === 7) {
            scheduleHiHat(ctx, noiseBuffer, musicBus, trig, stepInBar === 6, 0.032);
          }

          // Reverb-like slow-mo dreamy bell plucks
          if (stepInBar === 0 || stepInBar === 2 || stepInBar === 5) {
            const bellFreq = bellMelody[(step + barIdx) % bellMelody.length];
            const bellOsc = ctx.createOscillator();
            const bellGain = ctx.createGain();
            bellOsc.type = 'sine';
            bellOsc.frequency.setValueAtTime(bellFreq, trig);
            bellGain.gain.setValueAtTime(0.001, trig);
            bellGain.gain.linearRampToValueAtTime(0.065, trig + 0.03);
            bellGain.gain.exponentialRampToValueAtTime(0.001, trig + eighth * 2.4);
            bellOsc.connect(bellGain);
            bellGain.connect(musicBus);
            bellOsc.start(trig);
            bellOsc.stop(trig + eighth * 2.5);
          }
        }
      } else {
        const bpm =
          effectiveStyle === 'phonk-drive' ? 136 : effectiveStyle === 'trailer-score' ? 116 : 132;
        const beatSec = 60 / bpm;
        const sixteenth = beatSec / 4;

        const bassRoots = [73.42, 58.27, 65.41, 55.0];
        const arpNotes =
          effectiveStyle === 'phonk-drive'
            ? [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 329.63, 293.66]
            : [146.83, 220.0, 293.66, 349.23, 329.63, 293.66, 220.0, 261.63];

        const pad1 = ctx.createOscillator();
        const pad2 = ctx.createOscillator();
        const padFilter = ctx.createBiquadFilter();
        const padGain = ctx.createGain();
        pad1.type = effectiveStyle === 'trailer-score' ? 'sawtooth' : 'triangle';
        pad2.type = 'sawtooth';
        pad1.frequency.setValueAtTime(73.42, now);
        pad2.frequency.setValueAtTime(110.0, now);
        padFilter.type = 'lowpass';
        padFilter.frequency.setValueAtTime(240, now);
        padFilter.frequency.exponentialRampToValueAtTime(
          effectiveStyle === 'trailer-score' ? 780 : 520,
          now + Math.max(0.4, remaining * 0.85)
        );
        padGain.gain.setValueAtTime(0.001, now);
        padGain.gain.linearRampToValueAtTime(0.16, now + 0.35);
        padGain.gain.setValueAtTime(0.16, now + Math.max(0.4, remaining - 0.7));
        padGain.gain.exponentialRampToValueAtTime(0.001, now + remaining);
        pad1.connect(padFilter);
        pad2.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(musicBus);
        pad1.start(now);
        pad2.start(now);
        pad1.stop(now + remaining + 0.05);
        pad2.stop(now + remaining + 0.05);

        const totalSteps = Math.floor(totalDurationSeconds / sixteenth);
        for (let step = 0; step < totalSteps; step++) {
          const t = step * sixteenth;
          if (t < startOffsetSeconds || t >= totalDurationSeconds - 0.15) continue;
          const trig = now + (t - startOffsetSeconds);
          const stepInBar = step % 16;
          const barIndex = Math.floor(step / 16) % bassRoots.length;
          const rootFreq = bassRoots[barIndex];

          const isKick =
            effectiveStyle === 'trailer-score'
              ? stepInBar === 0 || stepInBar === 6 || stepInBar === 8
              : stepInBar === 0 || stepInBar === 3 || stepInBar === 8 || stepInBar === 11;
          if (isKick) {
            scheduleKick(ctx, musicBus, trig, effectiveStyle === 'phonk-drive' ? 0.5 : 0.42);
          }

          if (stepInBar === 4 || stepInBar === 12) {
            scheduleSnare(
              ctx,
              noiseBuffer,
              musicBus,
              trig,
              effectiveStyle === 'trailer-score' ? 0.16 : 0.24
            );
          }

          if (effectiveStyle !== 'trailer-score' || stepInBar % 2 === 0) {
            scheduleHiHat(
              ctx,
              noiseBuffer,
              musicBus,
              trig,
              stepInBar === 14,
              stepInBar % 2 === 0 ? 0.07 : 0.04
            );
          }

          if (stepInBar === 0 || stepInBar === 6 || stepInBar === 8 || stepInBar === 14) {
            const bassOsc = ctx.createOscillator();
            const bassFilter = ctx.createBiquadFilter();
            const bassGain = ctx.createGain();
            bassOsc.type = effectiveStyle === 'phonk-drive' ? 'sawtooth' : 'triangle';
            bassOsc.frequency.setValueAtTime(rootFreq, trig);
            bassFilter.type = 'lowpass';
            bassFilter.frequency.setValueAtTime(effectiveStyle === 'phonk-drive' ? 380 : 260, trig);
            bassGain.gain.setValueAtTime(0.22, trig);
            bassGain.gain.exponentialRampToValueAtTime(0.001, trig + sixteenth * 2.2);
            bassOsc.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(musicBus);
            bassOsc.start(trig);
            bassOsc.stop(trig + sixteenth * 2.3);
          }

          const playLead =
            effectiveStyle === 'phonk-drive'
              ? stepInBar % 2 === 0 || stepInBar === 11
              : effectiveStyle === 'cyberpunk-anthem'
                ? stepInBar % 2 === 0
                : stepInBar % 4 === 0;

          if (playLead) {
            const noteFreq = arpNotes[(step + barIndex * 2) % arpNotes.length];
            const leadOsc = ctx.createOscillator();
            const leadOsc2 = ctx.createOscillator();
            const leadFilter = ctx.createBiquadFilter();
            const leadGain = ctx.createGain();

            leadOsc.type = effectiveStyle === 'phonk-drive' ? 'square' : 'sawtooth';
            leadOsc2.type = 'triangle';
            leadOsc.frequency.setValueAtTime(noteFreq, trig);
            leadOsc2.frequency.setValueAtTime(noteFreq * 1.004, trig);

            leadFilter.type = 'lowpass';
            leadFilter.frequency.setValueAtTime(effectiveStyle === 'phonk-drive' ? 2200 : 1750, trig);
            leadFilter.frequency.exponentialRampToValueAtTime(480, trig + sixteenth * 1.8);

            leadGain.gain.setValueAtTime(effectiveStyle === 'phonk-drive' ? 0.1 : 0.08, trig);
            leadGain.gain.exponentialRampToValueAtTime(0.001, trig + sixteenth * 1.9);

            leadOsc.connect(leadFilter);
            leadOsc2.connect(leadFilter);
            leadFilter.connect(leadGain);
            leadGain.connect(musicBus);
            leadOsc.start(trig);
            leadOsc2.start(trig);
            leadOsc.stop(trig + sixteenth * 2);
            leadOsc2.stop(trig + sixteenth * 2);
          }
        }
      }
    }

    // Subtle soft UI click/impact synced to scene cuts
    cutTimesSeconds.forEach((cutSec, idx) => {
      if (cutSec < startOffsetSeconds - 0.05 || cutSec >= totalDurationSeconds) return;
      const hitTime = Math.max(now, now + (cutSec - startOffsetSeconds));
      const isOpeningOrFinale = idx === 0 || idx === cutTimesSeconds.length - 1;
      const impactOsc = ctx.createOscillator();
      const impactGain = ctx.createGain();
      impactOsc.type = 'triangle';
      impactOsc.frequency.setValueAtTime(isOpeningOrFinale ? 175 : 135, hitTime);
      impactOsc.frequency.exponentialRampToValueAtTime(34, hitTime + 0.36);
      impactGain.gain.setValueAtTime(isOpeningOrFinale ? 0.3 : 0.16, hitTime);
      impactGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.4);
      impactOsc.connect(impactGain);
      impactGain.connect(musicBus);
      impactOsc.start(hitTime);
      impactOsc.stop(hitTime + 0.42);
    });
  }

  return {
    stream: destNode ? destNode.stream : null,
    analyser,
    stop: () => {
      try {
        masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
        setTimeout(() => {
          ctx.close().catch(() => {});
        }, 70);
      } catch {
        ctx.close().catch(() => {});
      }
    },
  };
}
