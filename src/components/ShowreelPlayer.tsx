import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  Film,
  Maximize2,
  MessageCircle,
  Mic,
  Music,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Square,
  Terminal,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AspectRatioMode, MusicStyle, ReelConfig, ReelScene } from '../types/studio';
import { startReelSoundtrack, ScheduledBeatEngine } from '../utils/reelAudio';

interface ShowreelPlayerProps {
  scenes: ReelScene[];
  config: ReelConfig;
  onChangeConfig: (patch: Partial<ReelConfig>) => void;
  exportTriggerNonce?: number;
}

interface ComputedSceneWindow {
  scene: ReelScene;
  start: number;
  end: number;
  duration: number;
}

const HEX_CHARS = '0123456789ABCDEF#$%/@';

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function formatTimecode(sec: number): string {
  const s = Math.max(0, sec);
  const whole = Math.floor(s);
  const frames = Math.floor((s - whole) * 30);
  const mins = Math.floor(whole / 60);
  const remSec = whole % 60;
  return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

/**
 * Deterministic cyber-decryption string scramble for crisp trailer text reveals.
 */
function decryptText(target: string, progress01: number, seed: number): string {
  if (progress01 >= 0.98) return target;
  const lockedCount = Math.floor(progress01 * target.length);
  let out = '';
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    if (ch === ' ' || ch === '·' || i < lockedCount) {
      out += ch;
    } else {
      const idx = Math.abs(Math.floor(seed * 17 + i * 13 + progress01 * 43)) % HEX_CHARS.length;
      out += HEX_CHARS[idx];
    }
  }
  return out;
}

/**
 * Wraps text into clean lines that never overflow maxWidth on 16:9 or 9:16 canvases.
 */
function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0 || !text.trim()) return [''];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        // Append remainder and let font auto-scale if needed
        const rest = words.slice(i + 1).join(' ');
        current = rest ? `${current} ${rest}` : current;
        break;
      }
    }
  }
  lines.push(current);
  return lines;
}

function fitFontAndWrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  fontSpec: (size: number) => string,
  maxLines = 2
): { fontSize: number; lines: string[] } {
  for (let size = startSize; size >= minSize; size -= 2) {
    ctx.font = fontSpec(size);
    const lines = wrapCanvasLines(ctx, text, maxWidth, maxLines);
    const allFit = lines.every((line) => ctx.measureText(line).width <= maxWidth);
    if (allFit || size === minSize) {
      return { fontSize: size, lines };
    }
  }
  ctx.font = fontSpec(minSize);
  return { fontSize: minSize, lines: wrapCanvasLines(ctx, text, maxWidth, maxLines) };
}

export function ShowreelPlayer({
  scenes,
  config,
  onChangeConfig,
  exportTriggerNonce = 0,
}: ShowreelPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const songFileRef = useRef<HTMLInputElement | null>(null);
  const voiceFileRef = useRef<HTMLInputElement | null>(null);
  const loadedImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const audioEngineRef = useRef<ScheduledBeatEngine | null>(null);
  const freqBinsRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(32)));
  const rafRef = useRef<number | null>(null);
  const playStartTimestampRef = useRef<number>(0);
  const playStartOffsetRef = useRef<number>(0);
  const lastSpokenSceneIdRef = useRef<string | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [imagesReadyCount, setImagesReadyCount] = useState(0);

  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const [renderedVideo, setRenderedVideo] = useState<{
    blob: Blob;
    url: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const sceneWindows: ComputedSceneWindow[] = useMemo(() => {
    const totalWeight = scenes.reduce((acc, s) => acc + s.weight, 0) || 1;
    let cursor = 0;
    return scenes.map((scene, idx) => {
      const dur =
        idx === scenes.length - 1
          ? config.durationSeconds - cursor
          : Number(((scene.weight / totalWeight) * config.durationSeconds).toFixed(2));
      const win: ComputedSceneWindow = {
        scene,
        start: cursor,
        end: cursor + dur,
        duration: dur,
      };
      cursor += dur;
      return win;
    });
  }, [scenes, config.durationSeconds]);

  const cutTimestamps = useMemo(() => sceneWindows.map((w) => w.start), [sceneWindows]);

  useEffect(() => {
    let cancelled = false;
    scenes.forEach((scene) => {
      const existing = loadedImagesRef.current[scene.imageUrl];
      if (existing && existing.complete && existing.naturalWidth > 0) {
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!cancelled) {
          loadedImagesRef.current[scene.imageUrl] = img;
          setImagesReadyCount((c) => c + 1);
        }
      };
      img.src = scene.imageUrl;
    });
    return () => {
      cancelled = true;
    };
  }, [scenes]);

  const renderFrameAtTime = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isVertical = config.aspectRatio === '9:16';
      const targetW = isVertical ? 1080 : 1920;
      const targetH = isVertical ? 1920 : 1080;

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const activeIdx = Math.max(
        0,
        sceneWindows.findIndex((w) => t >= w.start && t < w.end)
      );
      const win = sceneWindows[activeIdx] || sceneWindows[sceneWindows.length - 1];
      const prevWin = activeIdx > 0 ? sceneWindows[activeIdx - 1] : null;
      const localT = Math.max(0, t - win.start);
      const p = clamp01(localT / Math.max(0.01, win.duration));

      // Subtle camera bass-impact micro-shake on first 180ms of each cut
      const impactEnv = localT < 0.18 ? (1 - localT / 0.18) : 0;
      const shakeX = impactEnv * Math.sin(t * 140) * 14;
      const shakeY = impactEnv * Math.cos(t * 115) * 9;

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, targetW, targetH);

      const drawSceneVisual = (
        img: HTMLImageElement | undefined,
        scene: ReelScene,
        scale: number,
        offsetX: number,
        offsetY: number,
        alpha = 1
      ) => {
        if (!img || !img.complete || img.naturalWidth === 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = targetW / targetH;

        if (scene.isAppFrame) {
          // 1) Ambient blurred background fill
          ctx.save();
          ctx.filter = 'blur(34px) brightness(0.32) saturate(1.2)';
          let bgW = targetW;
          let bgH = targetH;
          if (imgRatio > canvasRatio) {
            bgH = targetH;
            bgW = targetH * imgRatio;
          } else {
            bgW = targetW;
            bgH = targetW / imgRatio;
          }
          ctx.drawImage(
            img,
            (targetW - bgW * 1.15) / 2 + offsetX * 0.3,
            (targetH - bgH * 1.15) / 2 + offsetY * 0.3,
            bgW * 1.15,
            bgH * 1.15
          );
          ctx.restore();

          // 2) Crisp uncropped phone/icon showcase frame in foreground
          const maxBoxW = targetW * (isVertical ? 0.84 : 0.72);
          const maxBoxH = targetH * (isVertical ? 0.66 : 0.72);
          let fitW = maxBoxW;
          let fitH = fitW / imgRatio;
          if (fitH > maxBoxH) {
            fitH = maxBoxH;
            fitW = fitH * imgRatio;
          }
          const cardScale = 0.94 + (scale - 1.0) * 0.45;
          const cardW = fitW * cardScale;
          const cardH = fitH * cardScale;
          const cardX = (targetW - cardW) / 2 + offsetX * 0.55 + shakeX;
          const cardY =
            (targetH - cardH) / 2 - (isVertical ? 45 : 32) + offsetY * 0.55 + shakeY;
          const radius = imgRatio > 0.9 && imgRatio < 1.1 ? 64 : 34;

          // Glow drop shadow behind device frame
          ctx.save();
          ctx.shadowColor = 'rgba(34, 211, 238, 0.32)';
          ctx.shadowBlur = 48;
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, radius);
          ctx.fillStyle = '#050505';
          ctx.fill();
          ctx.restore();

          // Clip & draw sharp app UI
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, radius);
          ctx.clip();
          ctx.drawImage(img, cardX, cardY, cardW, cardH);

          // Live interactive UI animations directly inside the phone screen!
          if (scene.liveAnimation === 'world-clock-tick') {
            // 1) Live ticking digital seconds (:41 -> :42 -> :43...)
            const addedSec = Math.floor(localT);
            const secVal = (41 + addedSec) % 60;
            const secStr = String(secVal).padStart(2, '0');
            const secBoxX = cardX + cardW * 0.506;
            const secBoxY = cardY + cardH * 0.312;
            const secBoxW = cardW * 0.044;
            const secBoxH = cardH * 0.062;
            ctx.fillStyle = '#15161B';
            ctx.fillRect(secBoxX, secBoxY, secBoxW, secBoxH);
            ctx.font = `400 ${Math.round(cardH * 0.045)}px "Outfit", sans-serif`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(secStr, secBoxX + 2, secBoxY + secBoxH * 0.54);

            // 2) Live sweeping orange analog second hand
            const dialCx = cardX + cardW * 0.5;
            const dialCy = cardY + cardH * 0.553;
            const dialR = cardH * 0.088;
            const smoothSec = 41 + localT;
            const angle = ((smoothSec % 60) / 60) * Math.PI * 2 - Math.PI / 2;
            ctx.save();
            ctx.strokeStyle = '#FF9F0A';
            ctx.lineWidth = Math.max(2, cardH * 0.004);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(dialCx - Math.cos(angle) * dialR * 0.18, dialCy - Math.sin(angle) * dialR * 0.18);
            ctx.lineTo(dialCx + Math.cos(angle) * dialR * 0.9, dialCy + Math.sin(angle) * dialR * 0.9);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(dialCx, dialCy, Math.max(3, cardH * 0.007), 0, Math.PI * 2);
            ctx.fillStyle = '#FF9F0A';
            ctx.fill();
            ctx.restore();
          } else if (scene.liveAnimation === 'stopwatch-tick') {
            // Live running millisecond stopwatch over pure black area
            const elapsedMs = Math.floor((4.74 + localT * 1.15) * 100);
            const mins = Math.floor(elapsedMs / 6000);
            const secs = Math.floor((elapsedMs % 6000) / 100);
            const centis = elapsedMs % 100;
            const swText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
            const swX = cardX + cardW * 0.38;
            const swY = cardY + cardH * 0.305;
            const swW = cardW * 0.24;
            const swH = cardH * 0.09;
            ctx.fillStyle = '#000000';
            ctx.fillRect(swX, swY, swW, swH);
            ctx.font = `400 ${Math.round(cardH * 0.052)}px "Outfit", sans-serif`;
            ctx.fillStyle = '#22D3EE';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(swText, cardX + cardW * 0.5, swY + swH * 0.52);
          } else if (scene.liveAnimation === 'timer-tick') {
            // Live ticking 25:00 -> 24:59 -> 24:58 inside amber ring
            const totalRemSec = Math.max(0, 25 * 60 - Math.floor(localT * 1.25));
            const remMin = Math.floor(totalRemSec / 60);
            const remSec = totalRemSec % 60;
            const tmStr = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
            const ringCx = cardX + cardW * 0.5;
            const ringCy = cardY + cardH * 0.39;
            const ringR = cardH * 0.105;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(ringCx, ringCy, ringR * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = `500 ${Math.round(cardH * 0.046)}px "Outfit", sans-serif`;
            ctx.fillStyle = '#FAFAFA';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tmStr, ringCx, ringCy - cardH * 0.008);
            // Sweeping cyan arc on outer amber ring
            const sweepEnd = -Math.PI / 2 + ((localT * 0.45) % 1) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(ringCx, ringCy, ringR * 0.96, -Math.PI / 2, sweepEnd);
            ctx.strokeStyle = '#22D3EE';
            ctx.lineWidth = Math.max(3, cardH * 0.008);
            ctx.stroke();
          } else if (scene.liveAnimation === 'focus-tick') {
            // Live ticking 12:15:12 -> 12:15:13... + moving cyan bar
            const secNow = (12 + Math.floor(localT)) % 60;
            const secStr = String(secNow).padStart(2, '0');
            const focusX = cardX + cardW * 0.58;
            const focusY = cardY + cardH * 0.43;
            const focusW = cardW * 0.19;
            const focusH = cardH * 0.2;
            ctx.fillStyle = '#000000';
            ctx.fillRect(focusX, focusY, focusW, focusH);
            ctx.font = `400 ${Math.round(cardH * 0.16)}px "Outfit", sans-serif`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(secStr, focusX + cardW * 0.012, focusY + focusH * 0.53);
            // Cyan seconds bar sweep
            const barLeft = cardX + cardW * 0.265;
            const barTop = cardY + cardH * 0.666;
            const barFullW = cardW * 0.468;
            ctx.fillStyle = '#27272A';
            ctx.fillRect(barLeft, barTop, barFullW, Math.max(3, cardH * 0.006));
            ctx.fillStyle = '#22D3EE';
            ctx.fillRect(barLeft, barTop, barFullW * ((secNow % 60) / 60), Math.max(3, cardH * 0.006));
          } else if (scene.liveAnimation === 'alarm-type') {
            // Cycle real voice alarm reminder labels inside the input pill
            const labels = ['पढ़ाई का समय', 'खाना खाने का समय', 'कोचिंग का समय'];
            const pick = labels[Math.floor(localT / 1.1) % labels.length];
            const boxX = cardX + cardW * 0.49;
            const boxY = cardY + cardH * 0.536;
            const boxW = cardW * 0.16;
            const boxH = cardH * 0.038;
            ctx.fillStyle = '#1E1E24';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 6);
            ctx.fill();
            ctx.font = `600 ${Math.round(cardH * 0.018)}px "Outfit", sans-serif`;
            ctx.fillStyle = '#F2B705';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(pick, boxX + boxW - 6, boxY + boxH * 0.52);
          } else if (scene.liveAnimation === 'chrome-search-flow') {
            // Live interactive Google Chrome phone flow: Search Link -> 3 Dots -> Add to Home Screen
            const padIn = cardW * 0.07;
            ctx.fillStyle = '#0B0D12';
            ctx.fillRect(cardX, cardY, cardW, cardH);

            // Top Chrome Address Bar
            const barY = cardY + padIn;
            const barH = cardH * 0.12;
            ctx.fillStyle = '#181B24';
            ctx.beginPath();
            ctx.roundRect(cardX + padIn, barY, cardW - padIn * 2, barH, 14);
            ctx.fill();

            const rawUrl = (config.appDownloadUrl || 'punit551020-ai.github.io/clock/').replace(
              /^https?:\/\//,
              ''
            );
            const typeProg = clamp01(localT / 1.15);
            const shownUrl = rawUrl.slice(0, Math.max(6, Math.floor(typeProg * rawUrl.length)));
            ctx.font = `600 ${Math.round(cardH * 0.036)}px "JetBrains Mono", monospace`;
            ctx.fillStyle = '#22D3EE';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`G  ${shownUrl}`, cardX + padIn + 14, barY + barH / 2);

            // Pulsing 3-dot menu icon on right of Chrome bar
            const dotX = cardX + cardW - padIn - 24;
            const dotY = barY + barH / 2;
            const menuOpenP = clamp01((localT - 1.1) / 0.35);
            ctx.fillStyle = menuOpenP > 0 ? 'rgba(242, 183, 5, 0.35)' : 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.arc(dotX, dotY, barH * 0.38, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#F2B705';
            ctx.textAlign = 'center';
            ctx.fillText('⋮', dotX, dotY);

            // Mini preview of Clock App below Chrome bar
            const appTop = barY + barH + padIn * 0.8;
            ctx.drawImage(
              img,
              cardX + (cardW - cardH * 0.28) / 2,
              appTop + cardH * 0.04,
              cardH * 0.28,
              cardH * 0.28
            );
            ctx.font = `700 ${Math.round(cardH * 0.045)}px "Outfit", sans-serif`;
            ctx.fillStyle = '#FAFAFA';
            ctx.textAlign = 'center';
            ctx.fillText(config.appTitle || 'Hacker Ankit Clock App', cardX + cardW / 2, appTop + cardH * 0.39);

            // Pop-up Chrome 3-Dot Menu showing "Add to Home Screen" click
            if (menuOpenP > 0.05) {
              const menuW = cardW * 0.72;
              const menuH = cardH * 0.36;
              const menuX = cardX + cardW - padIn - menuW;
              const menuY = barY + barH + 10;
              ctx.save();
              ctx.globalAlpha = menuOpenP;
              ctx.fillStyle = '#1E222D';
              ctx.beginPath();
              ctx.roundRect(menuX, menuY, menuW, menuH, 16);
              ctx.fill();
              ctx.strokeStyle = 'rgba(242, 183, 5, 0.8)';
              ctx.lineWidth = 2;
              ctx.stroke();

              const items = ['New tab', 'Share link...', 'Add to Home screen'];
              items.forEach((lbl, idx) => {
                const iy = menuY + 18 + idx * (menuH * 0.29);
                const isAddBtn = idx === 2;
                if (isAddBtn) {
                  ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
                  ctx.beginPath();
                  ctx.roundRect(menuX + 12, iy - 6, menuW - 24, menuH * 0.25, 10);
                  ctx.fill();
                  ctx.strokeStyle = '#34D399';
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                }
                ctx.font = `${isAddBtn ? 700 : 500} ${Math.round(cardH * 0.038)}px "Outfit", sans-serif`;
                ctx.fillStyle = isAddBtn ? '#34D399' : '#D4D4D8';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(isAddBtn ? `📲 ${lbl}` : lbl, menuX + 24, iy + menuH * 0.09);
              });
              ctx.restore();
            }

            // Bottom "Installed!" confirmation pill
            const doneP = clamp01((localT - 2.15) / 0.35);
            if (doneP > 0.05) {
              ctx.save();
              ctx.globalAlpha = doneP;
              const toastW = cardW * 0.84;
              const toastH = cardH * 0.13;
              const toastX = cardX + (cardW - toastW) / 2;
              const toastY = cardY + cardH - toastH - padIn;
              ctx.fillStyle = 'rgba(6, 78, 59, 0.95)';
              ctx.beginPath();
              ctx.roundRect(toastX, toastY, toastW, toastH, 14);
              ctx.fill();
              ctx.strokeStyle = '#34D399';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.font = `700 ${Math.round(cardH * 0.038)}px "Outfit", sans-serif`;
              ctx.fillStyle = '#ECFDF5';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('✓ App Installed on Home Screen!', cardX + cardW / 2, toastY + toastH / 2);
              ctx.restore();
            }
          }

          ctx.restore();

          // Crisp cyan/gold cyber rim border
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, radius);
          const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
          borderGrad.addColorStop(0, 'rgba(34, 211, 238, 0.75)');
          borderGrad.addColorStop(0.5, 'rgba(242, 183, 5, 0.55)');
          borderGrad.addColorStop(1, 'rgba(52, 211, 153, 0.75)');
          ctx.strokeStyle = borderGrad;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();

          ctx.restore();

          // Live Phone Interactive Finger Tap Ripple
          if (scene.tapAt && alpha > 0.7) {
            const pulse = (localT * 1.45) % 1;
            const tx = cardX + cardW * scene.tapAt.x;
            const ty = cardY + cardH * scene.tapAt.y;

            ctx.save();
            ctx.beginPath();
            ctx.arc(tx, ty, 14 + pulse * 36, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 211, 238, ${(1 - pulse) * 0.85})`;
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(tx, ty, 8 + pulse * 18, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(242, 183, 5, ${(1 - pulse) * 0.9})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(tx, ty, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#F2B705';
            ctx.fill();

            if (scene.tapAt.label) {
              ctx.font = `600 ${isVertical ? 18 : 16}px "JetBrains Mono", monospace`;
              const pillW = ctx.measureText(scene.tapAt.label).width + 24;
              const pillX = Math.min(cardX + cardW - pillW - 10, Math.max(cardX + 10, tx - pillW / 2));
              const pillY = Math.max(cardY + 14, ty - 48);
              ctx.fillStyle = 'rgba(5, 7, 10, 0.9)';
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillW, 30, 8);
              ctx.fill();
              ctx.strokeStyle = 'rgba(242, 183, 5, 0.75)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.fillStyle = '#F2B705';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(scene.tapAt.label, pillX + pillW / 2, pillY + 15);
            }
            ctx.restore();
          }

          ctx.restore();
          return;
        }

        // Standard full-bleed editorial photography
        let baseW = targetW;
        let baseH = targetH;
        if (imgRatio > canvasRatio) {
          baseH = targetH;
          baseW = targetH * imgRatio;
        } else {
          baseW = targetW;
          baseH = targetW / imgRatio;
        }
        const drawW = baseW * scale;
        const drawH = baseH * scale;
        const x = (targetW - drawW) / 2 + offsetX + shakeX;
        const y = (targetH - drawH) / 2 + offsetY + shakeY;
        ctx.drawImage(img, x, y, drawW, drawH);
        ctx.restore();
      };

      const punch = easeOutExpo(clamp01(localT / 0.48));
      const drift = easeInOutCubic(p);

      let camScale = 1.07;
      let camX = 0;
      let camY = 0;

      switch (win.scene.cameraMotion) {
        case 'dolly-in':
          camScale = 1.22 - 0.12 * punch + 0.08 * drift;
          camY = (1 - punch) * 24;
          break;
        case 'pan-right':
          camScale = 1.18 - 0.06 * punch;
          camX = -48 + 96 * drift;
          break;
        case 'orbit-zoom':
          camScale = 1.06 + 0.14 * drift;
          camX = Math.sin(p * Math.PI) * 26;
          camY = -12 + 24 * drift;
          break;
        case 'pull-back':
          camScale = 1.26 - 0.18 * easeOutExpo(p);
          camY = (1 - drift) * -18;
          break;
        case 'portrait-push':
          camScale = 1.14 - 0.07 * punch + 0.06 * drift;
          camY = isVertical ? -15 + 15 * punch : -42 + 18 * drift;
          break;
      }

      // Dynamic Scene Cut Transitions + Beat Chromatic Flash
      const transDur = 0.25;
      if (prevWin && localT < transDur) {
        const tp = easeOutExpo(localT / transDur);
        const prevImg = loadedImagesRef.current[prevWin.scene.imageUrl];
        const curImg = loadedImagesRef.current[win.scene.imageUrl];

        if (win.scene.transition === 'whip-pan') {
          drawSceneVisual(prevImg, prevWin.scene, 1.14, -targetW * tp, 0, 1 - tp * 0.4);
          drawSceneVisual(curImg, win.scene, camScale, targetW * (1 - tp) + camX, camY, 1);
        } else if (win.scene.transition === 'slide-up') {
          drawSceneVisual(prevImg, prevWin.scene, 1.1, 0, -targetH * 0.22 * tp, 1 - tp * 0.5);
          drawSceneVisual(curImg, win.scene, camScale, camX, targetH * (1 - tp) + camY, 1);
        } else {
          drawSceneVisual(prevImg, prevWin.scene, 1.16 + tp * 0.16, 0, 0, 1 - tp);
          drawSceneVisual(curImg, win.scene, camScale + (1 - tp) * 0.14, camX, camY, tp);
        }

        // Pro-editor RGB horizontal glitch slices during 140ms cut hit
        if (config.hackerHudEnabled && localT < 0.14) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
          ctx.fillRect(0, targetH * 0.28, targetW, 18);
          ctx.fillStyle = 'rgba(242, 183, 5, 0.22)';
          ctx.fillRect(0, targetH * 0.64, targetW, 12);
          ctx.restore();
        }

        const flashAlpha = (1 - tp) * 0.28;
        if (flashAlpha > 0.01) {
          ctx.fillStyle = `rgba(255, 250, 235, ${flashAlpha})`;
          ctx.fillRect(0, 0, targetW, targetH);
        }
      } else {
        const curImg = loadedImagesRef.current[win.scene.imageUrl];
        drawSceneVisual(curImg, win.scene, camScale, camX, camY, 1);
      }

      // Hacker Atmospheric Layer: Matrix Hex Columns + Subtle Scanlines
      if (config.hackerHudEnabled) {
        ctx.save();
        // Faint horizontal anamorphic scanlines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        for (let y = 0; y < targetH; y += 6) {
          ctx.fillRect(0, y, targetW, 2);
        }

        // Subtle falling emerald/gold terminal hex rain along edges
        ctx.font = `500 ${isVertical ? 16 : 15}px "JetBrains Mono", monospace`;
        const colCount = isVertical ? 10 : 18;
        for (let c = 0; c < colCount; c++) {
          const x = ((c + 0.5) / colCount) * targetW;
          // Keep center 55% clean so subject face/screens shine
          if (Math.abs(x - targetW / 2) < targetW * 0.26) continue;
          const speed = 130 + ((c * 37) % 110);
          const streamY = ((t * speed + c * 190) % (targetH + 260)) - 180;
          for (let k = 0; k < 7; k++) {
            const charY = streamY - k * 22;
            if (charY < 0 || charY > targetH) continue;
            const alpha = (1 - k / 7) * 0.24;
            ctx.fillStyle = k === 0 ? `rgba(242, 183, 5, ${alpha * 1.4})` : `rgba(52, 211, 153, ${alpha})`;
            const hexCode = HEX_CHARS[(c * 7 + k * 3 + Math.floor(t * 10)) % 16];
            ctx.fillText(hexCode, x, charY);
          }
        }
        ctx.restore();
      }

      // Specular light glint sweep on non-title shots
      if (!win.scene.isOpening && !win.scene.isFinale && localT > 0.25 && localT < 1.55) {
        const gp = (localT - 0.25) / 1.3;
        const glintX = -targetW * 0.4 + targetW * 1.8 * gp;
        const glintGrad = ctx.createLinearGradient(glintX - 180, 0, glintX + 180, targetH);
        glintGrad.addColorStop(0, 'rgba(255,255,255,0)');
        glintGrad.addColorStop(0.5, 'rgba(255,255,255,0.07)');
        glintGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glintGrad;
        ctx.fillRect(0, 0, targetW, targetH);
      }

      // Cinema Contrast Vignette & Scrim
      const vignette = ctx.createRadialGradient(
        targetW / 2,
        targetH * 0.48,
        targetW * 0.16,
        targetW / 2,
        targetH * 0.5,
        Math.max(targetW, targetH) * 0.78
      );
      vignette.addColorStop(0, win.scene.isOpening ? 'rgba(5,5,5,0.48)' : 'rgba(5,5,5,0.08)');
      vignette.addColorStop(1, 'rgba(5,5,5,0.82)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, targetW, targetH);

      const bottomScrim = ctx.createLinearGradient(0, targetH * 0.4, 0, targetH);
      bottomScrim.addColorStop(0, 'rgba(5,5,5,0)');
      bottomScrim.addColorStop(0.55, 'rgba(5,5,5,0.62)');
      bottomScrim.addColorStop(1, 'rgba(5,5,5,0.95)');
      ctx.fillStyle = bottomScrim;
      ctx.fillRect(0, targetH * 0.4, targetW, targetH * 0.6);

      // Letterbox Bars for 16:9 Cinema Frame
      const barH = isVertical ? 0 : Math.round(targetH * 0.055);
      if (barH > 0) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, targetW, barH);
        ctx.fillRect(0, targetH - barH, targetW, barH);
      }

      const padX = isVertical ? 56 : 84;
      const topY = isVertical ? 76 : barH + 36;
      const bottomY = isVertical ? targetH - 76 : targetH - barH - 36;

      // Top HUD Corners, Live Timecode & Beat-Reactive Equalizer Bars
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      const tick = 18;
      ctx.beginPath();
      ctx.moveTo(padX, topY + tick);
      ctx.lineTo(padX, topY);
      ctx.lineTo(padX + tick, topY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(targetW - padX - tick, topY);
      ctx.lineTo(targetW - padX, topY);
      ctx.lineTo(targetW - padX, topY + tick);
      ctx.stroke();

      ctx.font = `500 ${isVertical ? 22 : 20}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(250,250,250,0.8)';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(`REC · ${formatTimecode(t)} / ${formatTimecode(config.durationSeconds)}`, padX + 30, topY + 2);

      // Live Audio Spectrum Bars in top-right HUD
      const analyser = audioEngineRef.current?.analyser;
      let bins: Uint8Array | null = null;
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(freqBinsRef.current);
        bins = freqBinsRef.current;
      }

      const eqBars = 12;
      const eqStartX = targetW - padX - 30 - eqBars * 8;
      for (let b = 0; b < eqBars; b++) {
        const energy = bins
          ? bins[b + 1] / 255
          : 0.25 + 0.65 * Math.abs(Math.sin(t * 9 + b * 0.7));
        const barHeight = Math.max(4, Math.round(energy * 24));
        ctx.fillStyle = b % 3 === 0 ? '#F2B705' : 'rgba(250,250,250,0.75)';
        ctx.fillRect(eqStartX + b * 8, topY + 24 - barHeight, 5, barHeight);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = '#F2B705';
      ctx.fillText((config.creatorName || 'HACKER ANKIT').toUpperCase(), eqStartX - 18, topY + 2);
      ctx.restore();

      // Interactive App Usage Overlays (24H Clock, Voice Alarm Examples, Google Chrome 3-Dot Install)
      if (win.scene.demoOverlay === 'clock-24h') {
        ctx.save();
        const badgeW = isVertical ? 360 : 340;
        const badgeX = isVertical ? (targetW - badgeW) / 2 : targetW - padX - badgeW;
        const badgeY = topY + 46;
        ctx.fillStyle = 'rgba(5, 7, 12, 0.88)';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, 56, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = `700 ${isVertical ? 19 : 18}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#22D3EE';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('24×7 ALWAYS-ON SMART CLOCK', badgeX + badgeW / 2, badgeY + 28);
        ctx.restore();
      } else if (win.scene.demoOverlay === 'voice-alarm-examples') {
        const examples = [
          'Padhai ka time ho gaya!',
          'Khana khane ka time ho gaya!',
          'School / Coaching jaane ka time!',
        ];
        ctx.save();
        const boxW = isVertical ? targetW - padX * 2 : 520;
        const boxX = isVertical ? padX : targetW - padX - boxW;
        const baseCardY = isVertical ? topY + 52 : topY + 58;
        examples.forEach((line, idx) => {
          const itemReveal = easeOutExpo(clamp01((localT - idx * 0.25) / 0.35));
          if (itemReveal <= 0.02) return;
          const y = baseCardY + idx * 60 + (1 - itemReveal) * 16;
          ctx.globalAlpha = itemReveal;
          ctx.fillStyle = 'rgba(6, 10, 16, 0.9)';
          ctx.beginPath();
          ctx.roundRect(boxX, y, boxW, 48, 10);
          ctx.fill();
          ctx.strokeStyle = idx === 0 ? 'rgba(242, 183, 5, 0.8)' : 'rgba(34, 211, 238, 0.65)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.font = `600 ${isVertical ? 22 : 20}px "Outfit", sans-serif`;
          ctx.fillStyle = idx === 0 ? '#F2B705' : '#F4F4F5';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`VOICE ALARM ${idx + 1}: "${line}"`, boxX + 18, y + 24);
        });
        ctx.restore();
      } else if (win.scene.demoOverlay === 'chrome-install') {
        ctx.save();
        const cardW = isVertical ? targetW - padX * 2 : 640;
        const cardH = isVertical ? 320 : 295;
        const cardX = isVertical ? padX : targetW - padX - cardW;
        const cardY = isVertical ? topY + 52 : topY + 58;

        ctx.fillStyle = 'rgba(7, 10, 16, 0.94)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Chrome address bar mockup
        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.roundRect(cardX + 20, cardY + 20, cardW - 40, 48, 10);
        ctx.fill();

        const rawUrl = (config.appDownloadUrl || 'punit551020-ai.github.io/clock/')
          .replace(/^https?:\/\//, '');
        const typedChars = Math.max(8, Math.floor(clamp01(localT / 0.85) * rawUrl.length));
        const shownUrl = rawUrl.slice(0, typedChars);

        ctx.font = `600 ${isVertical ? 19 : 18}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#22D3EE';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`G  ${shownUrl}`, cardX + 36, cardY + 44);

        // Pulsing 3-dot highlight on right end of Chrome bar
        const pulseDot = 0.5 + 0.5 * Math.sin(t * 10);
        ctx.fillStyle = `rgba(242, 183, 5, ${0.35 + 0.5 * pulseDot})`;
        ctx.beginPath();
        ctx.arc(cardX + cardW - 44, cardY + 44, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F2B705';
        ctx.textAlign = 'center';
        ctx.fillText('⋮', cardX + cardW - 44, cardY + 44);

        // 3 Crisp Hindi/Hinglish Download Steps
        const steps = [
          '1. Google / Chrome par link search karo',
          '2. Upar 3 Dots (⋮) menu par click karo',
          '3. "Add to Home Screen" click → App Install!',
        ];
        steps.forEach((st, idx) => {
          const stepAlpha = easeOutExpo(clamp01((localT - idx * 0.28) / 0.35));
          const sy = cardY + 102 + idx * 60;
          ctx.globalAlpha = Math.max(0.25, stepAlpha);
          ctx.fillStyle = idx === 2 ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.05)';
          ctx.beginPath();
          ctx.roundRect(cardX + 20, sy, cardW - 40, 48, 10);
          ctx.fill();
          if (idx === 2) {
            ctx.strokeStyle = '#34D399';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.font = `700 ${isVertical ? 22 : 20}px "Outfit", sans-serif`;
          ctx.fillStyle = idx === 2 ? '#34D399' : '#FAFAFA';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(st, cardX + 36, sy + 24);
        });
        ctx.restore();
      }

      // Monumental Opening Slam OR Closing Signature Lockup
      const textReveal = easeOutExpo(clamp01((localT - 0.04) / 0.4));
      const exitFade = localT > win.duration - 0.22 ? clamp01((win.duration - localT) / 0.22) : 1;
      const textAlpha = textReveal * exitFade;
      const slideOffset = (1 - textReveal) * 30;
      const decryptProgress = clamp01(localT / 0.46);

      if (win.scene.isOpening || win.scene.isFinale) {
        const centerX = targetW / 2;
        const anchorY = win.scene.isOpening
          ? isVertical
            ? targetH * 0.72
            : targetH * 0.74
          : isVertical
            ? targetH * 0.68
            : targetH * 0.68;

        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        const rawName = (config.creatorName || 'HACKER ANKIT').toUpperCase();
        const displayName = win.scene.isOpening
          ? decryptText(rawName, clamp01(localT / 0.34), t * 3)
          : rawName;
        const bracketedName = `[ ${displayName} ]`;

        const nameFontSize = isVertical
          ? win.scene.isOpening
            ? 88
            : 84
          : win.scene.isOpening
            ? 126
            : 118;

        // Dark cyber glass plate behind title lockup for razor-sharp readability over app UI
        ctx.font = `800 ${nameFontSize}px "Outfit", sans-serif`;
        const textWidth = Math.min(targetW - 100, ctx.measureText(`[ ${rawName} ]`).width);
        const plateW = textWidth + (isVertical ? 84 : 130);
        const plateH = isVertical ? 260 : 255;
        const plateX = centerX - plateW / 2;
        const plateY = anchorY - (isVertical ? 148 : 154) + slideOffset * 0.5;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(plateX, plateY, plateW, plateH, 18);
        ctx.fillStyle = 'rgba(5, 7, 10, 0.78)';
        ctx.fill();
        const plateStroke = ctx.createLinearGradient(plateX, plateY, plateX + plateW, plateY + plateH);
        plateStroke.addColorStop(0, 'rgba(34, 211, 238, 0.65)');
        plateStroke.addColorStop(0.5, 'rgba(242, 183, 5, 0.65)');
        plateStroke.addColorStop(1, 'rgba(52, 211, 153, 0.65)');
        ctx.strokeStyle = plateStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Kicker eyebrow with terminal decryption
        ctx.font = `600 ${isVertical ? 22 : 21}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#22D3EE';
        const kickerText = decryptText(win.scene.kicker.toUpperCase(), decryptProgress, t + 1);
        ctx.fillText(kickerText, centerX, anchorY - (isVertical ? 105 : 106) + slideOffset * 0.5);

        // Khatarnak Hacker-Style Name Lockup: [ HACKER ANKIT ]
        ctx.font = `800 ${nameFontSize}px "Outfit", sans-serif`;

        // Cyber glitch RGB chromatic echo
        if (localT < 0.55) {
          const glitchShift = 9 * (1 - localT / 0.55);
          ctx.fillStyle = 'rgba(34, 211, 238, 0.6)';
          ctx.fillText(bracketedName, centerX - glitchShift, anchorY + slideOffset);
          ctx.fillStyle = 'rgba(52, 211, 153, 0.55)';
          ctx.fillText(bracketedName, centerX + glitchShift, anchorY + slideOffset);
        }

        // Main metallic white + cyan-gold gradient text fill
        const nameGrad = ctx.createLinearGradient(centerX - textWidth / 2, anchorY - nameFontSize, centerX + textWidth / 2, anchorY);
        nameGrad.addColorStop(0, '#FFFFFF');
        nameGrad.addColorStop(0.52, '#F2B705');
        nameGrad.addColorStop(1, '#22D3EE');

        ctx.shadowColor = 'rgba(34, 211, 238, 0.45)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = nameGrad;
        ctx.fillText(bracketedName, centerX, anchorY + slideOffset);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Sweeping horizontal laser scanline across the hero name
        if (localT > 0.15 && localT < 1.35) {
          const scanP = (localT - 0.15) / 1.2;
          const laserX = centerX - textWidth / 2 + textWidth * scanP;
          const laserGrad = ctx.createLinearGradient(laserX - 50, 0, laserX + 50, 0);
          laserGrad.addColorStop(0, 'rgba(34, 211, 238, 0)');
          laserGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
          laserGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
          ctx.fillStyle = laserGrad;
          ctx.fillRect(laserX - 50, anchorY - nameFontSize * 0.85 + slideOffset, 100, nameFontSize * 0.95);
        }

        // Expanding emerald-gold cyber underline bar
        const barWidth = textWidth * easeOutExpo(clamp01((localT - 0.14) / 0.42));
        const barGrad = ctx.createLinearGradient(centerX - barWidth / 2, 0, centerX + barWidth / 2, 0);
        barGrad.addColorStop(0, '#22D3EE');
        barGrad.addColorStop(0.5, '#F2B705');
        barGrad.addColorStop(1, '#34D399');
        ctx.fillStyle = barGrad;
        ctx.fillRect(centerX - barWidth / 2, anchorY + 20 + slideOffset, barWidth, 4);

        // App Title / Role Subtitle (Auto-wrapped so NEVER clipped)
        const subReveal = easeOutExpo(clamp01((localT - 0.2) / 0.4));
        ctx.globalAlpha = textAlpha * subReveal;
        const subLabel = win.scene.isOpening
          ? config.appTitle || win.scene.subCaption
          : win.scene.subCaption;
        const fittedHeroSub = fitFontAndWrap(
          ctx,
          subLabel,
          targetW - padX * 2,
          isVertical ? 28 : 30,
          20,
          (sz) => `600 ${sz}px "Outfit", sans-serif`,
          2
        );
        ctx.font = `600 ${fittedHeroSub.fontSize}px "Outfit", sans-serif`;
        ctx.fillStyle = '#F4F4F5';
        fittedHeroSub.lines.forEach((line, li) => {
          ctx.fillText(line, centerX, anchorY + 70 + li * (fittedHeroSub.fontSize + 8) + slideOffset * 0.6);
        });

        ctx.restore();
      } else {
        // Middle Scenes: Non-Clipped Auto-Wrapped Kinetic Captions + Frosted Readability Backdrop
        const maxTextW = targetW - padX * 2;

        const fittedTitle = fitFontAndWrap(
          ctx,
          win.scene.caption.toUpperCase(),
          maxTextW,
          isVertical ? 64 : 74,
          36,
          (sz) => `800 ${sz}px "Outfit", sans-serif`,
          2
        );

        const fittedSub = fitFontAndWrap(
          ctx,
          win.scene.subCaption,
          maxTextW,
          isVertical ? 28 : 27,
          20,
          (sz) => `500 ${sz}px "Outfit", sans-serif`,
          2
        );

        const subLineH = fittedSub.fontSize + 8;
        const titleLineH = fittedTitle.fontSize + 8;
        const totalBlockH =
          36 + fittedTitle.lines.length * titleLineH + 14 + fittedSub.lines.length * subLineH;
        const blockTopY = bottomY - 12 - totalBlockH;

        ctx.save();
        ctx.globalAlpha = textAlpha;

        // Clean subtle frosted gradient pill-free backdrop behind lower third
        const boxPad = 18;
        ctx.fillStyle = 'rgba(5, 7, 11, 0.72)';
        ctx.beginPath();
        ctx.roundRect(
          padX - boxPad,
          blockTopY - 14 + slideOffset * 0.4,
          maxTextW + boxPad * 2,
          totalBlockH + 22,
          12
        );
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Kicker eyebrow
        const fittedKicker = fitFontAndWrap(
          ctx,
          win.scene.kicker.toUpperCase(),
          maxTextW,
          isVertical ? 22 : 20,
          15,
          (sz) => `600 ${sz}px "JetBrains Mono", monospace`,
          1
        );
        ctx.font = `600 ${fittedKicker.fontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = '#F2B705';
        ctx.fillText(
          decryptText(fittedKicker.lines[0], decryptProgress, t),
          padX,
          blockTopY + slideOffset * 0.4
        );

        // Bold Main Caption (Wrapped cleanly, zero horizontal clipping)
        const titleStartY = blockTopY + 34;
        ctx.font = `800 ${fittedTitle.fontSize}px "Outfit", sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#FAFAFA';
        fittedTitle.lines.forEach((line, li) => {
          ctx.fillText(
            decryptText(line, clamp01(localT / 0.34), t + 5 + li),
            padX,
            titleStartY + li * titleLineH + slideOffset
          );
        });

        // Sub-Caption (Complete Hindi/Hinglish sentence, never cut off)
        const subStartY = titleStartY + fittedTitle.lines.length * titleLineH + 10;
        const subReveal = easeOutExpo(clamp01((localT - 0.14) / 0.42));
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = textAlpha * subReveal;
        ctx.font = `500 ${fittedSub.fontSize}px "Outfit", sans-serif`;
        ctx.fillStyle = '#E4E4E7';
        fittedSub.lines.forEach((line, li) => {
          ctx.fillText(line, padX, subStartY + li * subLineH + slideOffset * 0.5);
        });

        ctx.restore();
      }

      // Bottom Progress Track
      const overallProgress = clamp01(t / config.durationSeconds);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(padX, bottomY + 16, targetW - padX * 2, 3);
      ctx.fillStyle = '#F2B705';
      ctx.fillRect(padX, bottomY + 16, (targetW - padX * 2) * overallProgress, 3);

      // Final fade to black in last 0.35s
      if (t > config.durationSeconds - 0.35) {
        const fadeOut = clamp01((t - (config.durationSeconds - 0.35)) / 0.35);
        ctx.fillStyle = `rgba(5, 5, 5, ${fadeOut * 0.94})`;
        ctx.fillRect(0, 0, targetW, targetH);
      }
    },
    [config, isPlaying, sceneWindows]
  );

  useEffect(() => {
    if (!isPlaying && !isExporting) {
      renderFrameAtTime(currentTime);
    }
  }, [currentTime, isPlaying, isExporting, renderFrameAtTime, imagesReadyCount]);

  const stopPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioEngineRef.current) {
      audioEngineRef.current.stop();
      audioEngineRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    lastSpokenSceneIdRef.current = null;
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(
    async (fromTime = currentTime) => {
      stopPlayback();
      const startAt = fromTime >= config.durationSeconds - 0.05 ? 0 : fromTime;
      playStartOffsetRef.current = startAt;
      setIsPlaying(true);

      const shouldRunAudio =
        config.audioEnabled && (config.musicStyle !== 'silent' || config.voiceoverEnabled);

      if (shouldRunAudio) {
        audioEngineRef.current = await startReelSoundtrack(cutTimestamps, config.durationSeconds, {
          startOffsetSeconds: startAt,
          muted: false,
          musicStyle: config.musicStyle,
          musicVolume: config.musicVolume,
          customAudioUrl: config.customAudioUrl,
          voiceoverEnabled: config.voiceoverEnabled,
          voiceVolume: config.voiceVolume,
          voiceoverAudioUrl: config.voiceoverAudioUrl,
        });
      }

      // Smooth, relaxed Hindi Female browser speech fallback across the entire video (never cut off mid-sentence!)
      if (
        config.audioEnabled &&
        config.voiceoverEnabled &&
        !config.voiceoverAudioUrl &&
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        config.voiceoverScript.trim()
      ) {
        const speakTutorial = () => {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(config.voiceoverScript);
          const voices = window.speechSynthesis.getVoices();
          const preferFemale = config.voiceGender !== 'male';
          const matchedVoice =
            voices.find((v) => {
              const nm = `${v.name} ${v.lang}`.toLowerCase();
              const isHindiOrIndian = nm.includes('hi-in') || nm.includes('hi_in') || nm.includes('india');
              if (!isHindiOrIndian) return false;
              if (preferFemale) {
                return (
                  nm.includes('female') ||
                  nm.includes('swara') ||
                  nm.includes('lekha') ||
                  nm.includes('heera') ||
                  nm.includes('kalpana') ||
                  nm.includes('neerja') ||
                  nm.includes('google हिन्दी')
                );
              }
              return nm.includes('male') || nm.includes('hemant') || nm.includes('madhur') || nm.includes('prabhat');
            }) ||
            voices.find((v) => v.lang.toLowerCase().startsWith('hi')) ||
            voices.find((v) => v.lang.toLowerCase().includes('in'));

          if (matchedVoice) {
            utter.voice = matchedVoice;
          }
          utter.lang = config.captionPreset === 'english' ? 'en-IN' : 'hi-IN';
          utter.rate = 0.94; // Relaxed, easy-to-follow pace (never rushed)
          utter.pitch = config.voiceGender === 'female' ? 1.08 : 0.96;
          utter.volume = Math.min(1, config.voiceVolume);
          window.speechSynthesis.speak(utter);
        };
        speakTutorial();
      }

      playStartTimestampRef.current = performance.now();

      const tick = (nowMs: number) => {
        const elapsed = (nowMs - playStartTimestampRef.current) / 1000;
        const nextT = playStartOffsetRef.current + elapsed;

        if (nextT >= config.durationSeconds) {
          setCurrentTime(config.durationSeconds);
          renderFrameAtTime(config.durationSeconds);
          stopPlayback();
          return;
        }

        setCurrentTime(nextT);
        renderFrameAtTime(nextT);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [
      config.audioEnabled,
      config.captionPreset,
      config.customAudioUrl,
      config.durationSeconds,
      config.musicStyle,
      config.musicVolume,
      config.voiceGender,
      config.voiceVolume,
      config.voiceoverAudioUrl,
      config.voiceoverEnabled,
      config.voiceoverScript,
      currentTime,
      cutTimestamps,
      renderFrameAtTime,
      stopPlayback,
    ]
  );

  const togglePlay = () => {
    if (isExporting) return;
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback(currentTime);
    }
  };

  const handleRestart = () => {
    if (isExporting) return;
    setCurrentTime(0);
    startPlayback(0);
  };

  const handleSongUpload = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    stopPlayback();
    onChangeConfig({
      musicStyle: 'custom',
      customAudioUrl: url,
      customAudioName: file.name,
      audioEnabled: true,
    });
  };

  const handleVoiceUpload = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    stopPlayback();
    setVoiceNotice(`Attached voice file: ${file.name} (baked loud over soft background music)`);
    onChangeConfig({
      voiceoverEnabled: true,
      voiceoverAudioUrl: url,
      voiceoverAudioName: file.name,
      audioEnabled: true,
    });
  };

  const handleGenerateAiVoiceover = async () => {
    if (isGeneratingVoice || isExporting) return;
    stopPlayback();
    setIsGeneratingVoice(true);
    setVoiceNotice(
      `Generating relaxed ${config.voiceGender === 'female' ? 'Indian Female' : 'Male'} Hindi voiceover...`
    );
    try {
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText: config.voiceoverScript,
          voiceName: config.voiceGender === 'male' ? 'Puck' : 'Kore',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Voiceover generation failed.');
      }
      const byteChars = atob(data.audioBase64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        bytes[i] = byteChars.charCodeAt(i);
      }
      const wavBlob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const wavUrl = URL.createObjectURL(wavBlob);
      onChangeConfig({
        voiceoverEnabled: true,
        voiceoverAudioUrl: wavUrl,
        voiceoverAudioName: 'AI Hindi Voiceover (Ready for MP4 Export)',
        audioEnabled: true,
      });
      setVoiceNotice(
        'AI Hindi Voiceover ready! Song plays softly in background while voice speaks loud & clear — even inside downloaded MP4.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach TTS server.';
      setVoiceNotice(
        `${msg} Live Hindi Speech still works during preview — or click "Record Mic" to bake your own voice directly into MP4!`
      );
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleToggleMicRecord = async () => {
    if (isRecordingMic) {
      micRecorderRef.current?.stop();
      setIsRecordingMic(false);
      return;
    }
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(micStream);
      micRecorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      rec.onstop = () => {
        micStream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        onChangeConfig({
          voiceoverEnabled: true,
          voiceoverAudioUrl: url,
          voiceoverAudioName: 'My Recorded Voiceover (Baked in MP4)',
          audioEnabled: true,
        });
        setVoiceNotice('Voice recorded! Ready to export with soft 2026 background music.');
      };
      rec.start();
      setIsRecordingMic(true);
      setVoiceNotice('Recording mic... Speak your Clock App guide and click Stop Recording when done.');
    } catch {
      setVoiceNotice('Microphone permission unavailable — use AI Voiceover or Upload Audio.');
    }
  };

  // Clear cached rendered file whenever scenes or config change
  useEffect(() => {
    setRenderedVideo((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, [scenes, config]);

  // Reset playhead cleanly to 0 when switching app reel presets
  useEffect(() => {
    stopPlayback();
    setCurrentTime(0);
  }, [config.reelPreset, stopPlayback]);

  const triggerDownloadFromUrl = (url: string, filename: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const renderMasterVideoFile = useCallback(async (): Promise<{
    blob: Blob;
    url: string;
    filename: string;
    mimeType: string;
  } | null> => {
    if (isExporting) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;

    stopPlayback();
    setExportNotice(null);
    setShareFeedback(null);
    setIsExporting(true);
    setExportProgress(0);
    setCurrentTime(0);

    try {
      const canvasStream = canvas.captureStream(60);
      const shouldIncludeAudio =
        config.audioEnabled && (config.musicStyle !== 'silent' || config.voiceoverEnabled);
      let audioEngine: ScheduledBeatEngine | null = null;
      if (shouldIncludeAudio) {
        audioEngine = await startReelSoundtrack(cutTimestamps, config.durationSeconds, {
          startOffsetSeconds: 0,
          captureStream: true,
          muted: false,
          musicStyle: config.musicStyle,
          musicVolume: config.musicVolume,
          customAudioUrl: config.customAudioUrl,
          voiceoverEnabled: config.voiceoverEnabled,
          voiceVolume: config.voiceVolume,
          voiceoverAudioUrl: config.voiceoverAudioUrl,
        });
        audioEngineRef.current = audioEngine;
      }

      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
      if (audioEngine?.stream) {
        audioEngine.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
      }

      // Prefer MP4 for direct WhatsApp mobile playback when supported by browser
      const candidateMimes = [
        { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4', outMime: 'video/mp4' },
        { mime: 'video/mp4', ext: 'mp4', outMime: 'video/mp4' },
        { mime: 'video/webm;codecs=vp9,opus', ext: 'webm', outMime: 'video/webm' },
        { mime: 'video/webm;codecs=vp8,opus', ext: 'webm', outMime: 'video/webm' },
        { mime: 'video/webm', ext: 'webm', outMime: 'video/webm' },
      ];
      const selectedFormat =
        candidateMimes.find((c) => MediaRecorder.isTypeSupported(c.mime)) || candidateMimes[4];

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: selectedFormat.mime,
        videoBitsPerSecond: 8_500_000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const completedPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: selectedFormat.outMime }));
        };
      });

      recorder.start(100);
      const startMs = performance.now();

      await new Promise<void>((resolve) => {
        const renderStep = (nowMs: number) => {
          const t = (nowMs - startMs) / 1000;
          if (t >= config.durationSeconds) {
            renderFrameAtTime(config.durationSeconds);
            setCurrentTime(config.durationSeconds);
            setExportProgress(100);
            resolve();
            return;
          }
          renderFrameAtTime(t);
          setCurrentTime(t);
          setExportProgress(Math.round((t / config.durationSeconds) * 100));
          rafRef.current = requestAnimationFrame(renderStep);
        };
        rafRef.current = requestAnimationFrame(renderStep);
      });

      recorder.stop();
      if (audioEngine) {
        audioEngine.stop();
      }
      audioEngineRef.current = null;

      const videoBlob = await completedPromise;
      const downloadUrl = URL.createObjectURL(videoBlob);
      const safeName = (config.creatorName || 'Hacker_Ankit').replace(/\s+/g, '_');
      const filename = `${safeName}_Showreel_${config.durationSeconds}s_${config.aspectRatio.replace(':', 'x')}.${selectedFormat.ext}`;

      const result = {
        blob: videoBlob,
        url: downloadUrl,
        filename,
        mimeType: selectedFormat.outMime,
      };
      setRenderedVideo(result);
      return result;
    } catch (err) {
      setExportNotice(err instanceof Error ? err.message : 'Unable to export video in this browser.');
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [config, cutTimestamps, isExporting, renderFrameAtTime, stopPlayback]);

  const handleExportVideo = useCallback(async () => {
    const fileResult = renderedVideo || (await renderMasterVideoFile());
    if (!fileResult) return;
    triggerDownloadFromUrl(fileResult.url, fileResult.filename);
    setExportNotice(
      `Saved ${fileResult.filename} (${(fileResult.blob.size / (1024 * 1024)).toFixed(1)} MB) with synced soundtrack.`
    );
  }, [renderMasterVideoFile, renderedVideo]);

  const handleOpenWhatsAppShare = useCallback(async () => {
    if (isExporting) return;
    setShareFeedback(null);
    if (renderedVideo) {
      setIsWhatsAppModalOpen(true);
      return;
    }
    const fileResult = await renderMasterVideoFile();
    if (fileResult) {
      setIsWhatsAppModalOpen(true);
    }
  }, [isExporting, renderMasterVideoFile, renderedVideo]);

  const handleNativeShareFile = async () => {
    if (!renderedVideo) return;
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    const videoFile = new File([renderedVideo.blob], renderedVideo.filename, {
      type: renderedVideo.mimeType,
    });
    if (nav.share && nav.canShare?.({ files: [videoFile] })) {
      try {
        await nav.share({
          files: [videoFile],
          title: `${config.creatorName || 'Hacker Ankit'} Showreel`,
          text: `${config.creatorName || 'Hacker Ankit'} — ${config.durationSeconds}s Showreel`,
        });
        setShareFeedback('Opened system share sheet with your video attached.');
        return;
      } catch {
        setShareFeedback('System share cancelled — use "Save Video & Open WhatsApp Web" below.');
        return;
      }
    }
    setShareFeedback('Direct file share is not enabled in this desktop browser — click "Save Video & Open WhatsApp Web" below.');
  };

  const prevNonceRef = useRef(exportTriggerNonce);
  useEffect(() => {
    if (exportTriggerNonce > prevNonceRef.current) {
      prevNonceRef.current = exportTriggerNonce;
      handleExportVideo();
    }
  }, [exportTriggerNonce, handleExportVideo]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const activeSceneIndex = Math.max(
    0,
    sceneWindows.findIndex((w) => currentTime >= w.start && currentTime < w.end)
  );

  return (
    <div className="space-y-5">
      {/* Studio Viewport Stage */}
      <div className="relative bg-[#0B0B0E] border border-zinc-800 rounded-2xl overflow-hidden">
        <div
          className={`mx-auto flex items-center justify-center bg-[#050505] ${
            config.aspectRatio === '9:16' ? 'py-6 px-4' : ''
          }`}
        >
          <div
            className={`relative overflow-hidden bg-black ${
              config.aspectRatio === '9:16'
                ? 'w-full max-w-[340px] aspect-[9/16] rounded-xl border border-zinc-800'
                : 'w-full aspect-video'
            }`}
          >
            <canvas
              ref={canvasRef}
              onClick={togglePlay}
              className="w-full h-full object-contain cursor-pointer block"
            />

            {!isPlaying && !isExporting && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="Play Showreel"
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors group cursor-pointer"
              >
                <span className="w-16 h-16 rounded-full bg-[#F2B705] text-[#050505] flex items-center justify-center shadow-2xl transform group-hover:scale-105 transition-transform duration-150">
                  <Play className="w-7 h-7 fill-current ml-0.5" />
                </span>
              </button>
            )}

            {isExporting && (
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-200 mb-2">
                  <span>RENDERING MASTER VIDEO ({config.durationSeconds}s · 60 FPS)</span>
                  <span className="tabular-nums text-[#F2B705]">{exportProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F2B705] transition-all duration-100"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Scrubber & Transport Bar */}
        <div className="px-5 py-4 border-t border-zinc-800/80 bg-[#0D0D11] space-y-4">
          {/* 6-Scene Timeline Scrubber */}
          <div className="flex items-center gap-1">
            {sceneWindows.map((win, idx) => {
              const segProgress =
                currentTime >= win.end
                  ? 100
                  : currentTime <= win.start
                    ? 0
                    : ((currentTime - win.start) / win.duration) * 100;
              const isActive = idx === activeSceneIndex;
              return (
                <button
                  key={win.scene.id}
                  type="button"
                  disabled={isExporting}
                  onClick={() => {
                    stopPlayback();
                    setCurrentTime(win.start + 0.12);
                  }}
                  style={{ flexGrow: win.duration }}
                  className="group text-left cursor-pointer disabled:opacity-50 min-w-0"
                  title={`${win.scene.title} (${win.start.toFixed(1)}s)`}
                >
                  <div className="h-2 rounded-sm bg-zinc-800 overflow-hidden mb-1">
                    <div
                      className={`h-full transition-colors ${
                        isActive ? 'bg-[#F2B705]' : 'bg-zinc-500 group-hover:bg-zinc-200'
                      }`}
                      style={{ width: `${segProgress}%` }}
                    />
                  </div>
                  <span
                    className={`block text-[11px] truncate font-mono ${
                      isActive ? 'text-[#F2B705]' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')} · {win.scene.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Transport, Soundtrack & Format Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F2B705] text-[#050505] text-sm font-semibold hover:bg-[#eab004] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                {isPlaying ? 'Pause' : 'Play Cut'}
              </button>

              <button
                type="button"
                onClick={handleRestart}
                disabled={isExporting}
                aria-label="Restart Reel"
                className="p-2 rounded-lg border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  const nextEnabled = !config.audioEnabled;
                  onChangeConfig({
                    audioEnabled: nextEnabled,
                    musicStyle:
                      nextEnabled && config.musicStyle === 'silent'
                        ? 'slow-mo-2026'
                        : config.musicStyle,
                  });
                }}
                disabled={isExporting}
                aria-label={config.audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
                className="p-2 rounded-lg border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {config.audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <span className="ml-1 font-mono text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                {formatTimecode(currentTime)} / {formatTimecode(config.durationSeconds)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Song / Music Track Picker */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                <Music className="w-3.5 h-3.5 text-[#F2B705] shrink-0" />
                <select
                  value={config.musicStyle}
                  disabled={isExporting}
                  onChange={(e) => {
                    stopPlayback();
                    const nextStyle = e.target.value as MusicStyle;
                    onChangeConfig({
                      musicStyle: nextStyle,
                      audioEnabled: nextStyle !== 'silent' || config.voiceoverEnabled,
                    });
                  }}
                  aria-label="Select Song Style"
                  className="bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer"
                >
                  <option value="slow-mo-2026" className="bg-zinc-900">
                    Slow-Mo 2026 Chill Vibe (Soft BG)
                  </option>
                  <option value="cyberpunk-anthem" className="bg-zinc-900">
                    Cyberpunk Anthem (132 BPM)
                  </option>
                  <option value="phonk-drive" className="bg-zinc-900">
                    Phonk Bass Drive (136 BPM)
                  </option>
                  <option value="trailer-score" className="bg-zinc-900">
                    Cinema Trailer Score
                  </option>
                  <option value="silent" className="bg-zinc-900">
                    No Song (Silent — Add Own Song)
                  </option>
                  {config.customAudioUrl && (
                    <option value="custom" className="bg-zinc-900">
                      Custom: {config.customAudioName?.slice(0, 18) || 'Uploaded Song'}
                    </option>
                  )}
                </select>
              </div>

              <input
                ref={songFileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => handleSongUpload(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={isExporting}
                onClick={() => songFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-200 hover:border-[#F2B705] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-[#F2B705]" />
                Upload Song
              </button>

              {/* Hacker HUD Toggle */}
              <button
                type="button"
                disabled={isExporting}
                onClick={() => onChangeConfig({ hackerHudEnabled: !config.hackerHudEnabled })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  config.hackerHudEnabled
                    ? 'border-[#F2B705]/60 bg-zinc-900 text-[#F2B705]'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Hacker FX
              </button>

              {/* Duration Segmented Switch (20s / 25s / 30s) */}
              <div className="inline-flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                {([20, 25, 30] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    disabled={isExporting}
                    onClick={() => {
                      stopPlayback();
                      setCurrentTime(0);
                      onChangeConfig({ durationSeconds: sec });
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      config.durationSeconds === sec
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              {/* Aspect Ratio Segmented Switch */}
              <div className="inline-flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                {(['16:9', '9:16'] as AspectRatioMode[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    disabled={isExporting}
                    onClick={() => {
                      stopPlayback();
                      onChangeConfig({ aspectRatio: ratio });
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      config.aspectRatio === ratio
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Maximize2 className="w-3 h-3" />
                    {ratio}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExportVideo}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-xs font-semibold hover:border-[#F2B705] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-[#F2B705]" />
                {isExporting ? `Rendering ${exportProgress}%` : 'Download Video'}
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsAppShare}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#25D366] text-[#050505] text-xs font-bold hover:bg-[#20bd5a] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <MessageCircle className="w-3.5 h-3.5 fill-current" />
                Send to WhatsApp
              </button>
            </div>
          </div>

          {/* Hindi Explainer Voiceover + Soft Slow-Mo Music Mixer Strip */}
          <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-6 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="vo-script" className="text-[11px] font-mono text-[#F2B705]">
                  VOICEOVER SCRIPT (LOUD VOICE + SOFT 18% SLOW-MO 2026 SONG)
                </label>
                <span className="text-[11px] font-mono text-zinc-400">
                  {config.voiceoverAudioName || 'Live Hindi Preview Active'}
                </span>
              </div>
              <textarea
                id="vo-script"
                rows={2}
                value={config.voiceoverScript}
                onChange={(e) => onChangeConfig({ voiceoverScript: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#050505] border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-[#F2B705] resize-none"
              />
            </div>

            <div className="lg:col-span-6 flex flex-wrap items-center lg:justify-end gap-2">
              <div className="inline-flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                {(['female', 'male'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onChangeConfig({ voiceGender: g })}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 cursor-pointer ${
                      config.voiceGender === g
                        ? 'bg-zinc-800 text-[#F2B705]'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {g === 'female' ? 'Girl Voice' : 'Boy Voice'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onChangeConfig({ voiceoverEnabled: !config.voiceoverEnabled })}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  config.voiceoverEnabled
                    ? 'border-[#F2B705]/70 bg-zinc-900 text-[#F2B705]'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                {config.voiceoverEnabled ? 'Voice ON (100%)' : 'Voice OFF'}
              </button>

              <button
                type="button"
                disabled={isGeneratingVoice || isExporting}
                onClick={handleGenerateAiVoiceover}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F2B705] text-[#050505] text-xs font-bold hover:bg-[#eab004] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isGeneratingVoice ? 'Generating Voice...' : 'Generate AI Hindi Voice'}
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleToggleMicRecord}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isRecordingMic
                    ? 'border-red-500 bg-red-500/20 text-red-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-[#F2B705]'
                }`}
              >
                {isRecordingMic ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5 text-[#F2B705]" />}
                {isRecordingMic ? 'Stop Mic' : 'Record Mic'}
              </button>

              <input
                ref={voiceFileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => handleVoiceUpload(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={isExporting}
                onClick={() => voiceFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:border-[#F2B705] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Voice
              </button>
            </div>
          </div>

          {voiceNotice && (
            <p className="text-xs font-mono text-cyan-300 bg-cyan-950/30 border border-cyan-900/50 rounded-lg px-3 py-2">
              {voiceNotice}
            </p>
          )}
        </div>
      </div>

      {exportNotice && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-200">
          <Film className="w-4 h-4 text-[#F2B705] shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Laptop-to-Mobile WhatsApp Share Modal */}
      {isWhatsAppModalOpen && renderedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Send Showreel to WhatsApp"
        >
          <div className="w-full max-w-lg bg-[#0D0D11] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                <h3 className="text-base font-bold text-white">Send Video to WhatsApp</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(false)}
                aria-label="Close WhatsApp share"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Ready File Summary + Inline Preview */}
              <div className="rounded-xl overflow-hidden bg-black border border-zinc-800">
                <video
                  src={renderedVideo.url}
                  controls
                  playsInline
                  className="w-full max-h-52 object-contain bg-black"
                />
                <div className="px-3.5 py-2.5 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-300 truncate max-w-[260px]">
                    {renderedVideo.filename}
                  </span>
                  <span className="font-mono text-[#F2B705] tabular-nums shrink-0">
                    {(renderedVideo.blob.size / (1024 * 1024)).toFixed(1)} MB · Ready
                  </span>
                </div>
              </div>

              {/* Optional Phone Number for Direct Laptop -> Mobile Self Chat */}
              <div className="space-y-1.5">
                <label htmlFor="wa-phone" className="block text-xs font-mono text-zinc-400">
                  YOUR MOBILE WHATSAPP NUMBER (OPTIONAL, WITH COUNTRY CODE)
                </label>
                <input
                  id="wa-phone"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="e.g. 919876543210 (leave blank to pick any chat on WhatsApp Web)"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#050505] border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#25D366]"
                />
              </div>

              {/* 1-Click Actions */}
              <div className="space-y-2.5">
                {(() => {
                  const cleanedPhone = whatsappNumber.replace(/\D/g, '');
                  const waText = encodeURIComponent(
                    `${config.creatorName || 'Hacker Ankit'} — ${config.durationSeconds}s Showreel`
                  );
                  const waHref = cleanedPhone
                    ? `https://wa.me/${cleanedPhone}?text=${waText}`
                    : 'https://web.whatsapp.com/';
                  return (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        triggerDownloadFromUrl(renderedVideo.url, renderedVideo.filename);
                        setShareFeedback(
                          'Video saved to Downloads & WhatsApp Web opened — attach or drag the downloaded video file into your chat!'
                        );
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#25D366] text-[#050505] font-bold text-sm hover:bg-[#20bd5a] transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                      Save Video &amp; Open WhatsApp Web
                    </a>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleNativeShareFile}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-semibold text-white hover:border-[#F2B705] transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#F2B705]" />
                    System Share Sheet
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerDownloadFromUrl(renderedVideo.url, renderedVideo.filename);
                      setShareFeedback(`Saved ${renderedVideo.filename} to your Downloads folder.`);
                    }}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-semibold text-white hover:border-[#F2B705] transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#F2B705]" />
                    Save File Again
                  </button>
                </div>
              </div>

              {shareFeedback && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 leading-relaxed">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{shareFeedback}</span>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Tip: On laptop, clicking <strong className="text-zinc-300">Save Video &amp; Open WhatsApp Web</strong> downloads the video and opens your WhatsApp chat — just drag &amp; drop the downloaded file into your own chat (&quot;You&quot;) to receive it instantly on your mobile phone.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
