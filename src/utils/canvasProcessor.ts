import {
  ArOverlayId,
  AspectRatioPreset,
  BackgroundBackdropId,
  CameraSettings,
  FILTER_PRESETS,
  IPHONE_LOOKS,
} from '../types/camera';
import { TrackedFacePose } from './offlineVisionAi';

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
}

export interface RenderFrameOptions {
  targetCanvas: HTMLCanvasElement;
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null;
  sourceWidth: number;
  sourceHeight: number;
  isFrontCamera: boolean;
  settings: CameraSettings;
  backdropImage: HTMLImageElement | null;
  referenceBgPixels: Uint8ClampedArray | null;
  sampledBgColor: RgbaColor;
  arOffset: { x: number; y: number };
  aiPersonMask?: HTMLCanvasElement | null;
  trackedFace?: TrackedFacePose | null;
  applySharpnessPass?: boolean;
  timeMs?: number;
}

const workCanvasA = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const workCanvasB = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const maskCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const segSampleCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const featheredMaskCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const glareWorkCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const sharpWorkCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

export function getTargetAspectNumeric(
  aspectRatio: AspectRatioPreset,
  sourceWidth: number,
  sourceHeight: number
): number {
  switch (aspectRatio) {
    case '9:16':
      return 9 / 16;
    case '3:4':
      return 3 / 4;
    case '1:1':
      return 1;
    case '16:9':
      return 16 / 9;
    case 'full':
    default:
      return sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
  }
}

export function prepareCroppedFrameCanvas(
  aiCanvas: HTMLCanvasElement,
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: AspectRatioPreset,
  zoom: number,
  mirror: boolean
): boolean {
  if (sourceWidth <= 0 || sourceHeight <= 0) return false;
  const aspect = getTargetAspectNumeric(aspectRatio, sourceWidth, sourceHeight);
  const shortSide = 288;
  let w = shortSide;
  let h = Math.round(shortSide / aspect);
  if (aspect > 1) {
    w = Math.round(shortSide * aspect);
    h = shortSide;
  }
  w = Math.max(64, Math.round(w / 2) * 2);
  h = Math.max(64, Math.round(h / 2) * 2);

  if (aiCanvas.width !== w || aiCanvas.height !== h) {
    aiCanvas.width = w;
    aiCanvas.height = h;
  }
  const ctx = aiCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  drawCroppedSource(ctx, source, sourceWidth, sourceHeight, w, h, aspectRatio, zoom, mirror);
  return true;
}

export function captureReferenceFramePixels(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: AspectRatioPreset,
  zoom: number,
  mirror: boolean
): Uint8ClampedArray | null {
  if (!segSampleCanvas || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const sw = 160;
  const sh = 160;
  segSampleCanvas.width = sw;
  segSampleCanvas.height = sh;
  const ctx = segSampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  drawCroppedSource(ctx, source, sourceWidth, sourceHeight, sw, sh, targetAspect, zoom, mirror);
  return new Uint8ClampedArray(ctx.getImageData(0, 0, sw, sh).data);
}

export function samplePixelColorFromSource(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  sourceWidth: number,
  sourceHeight: number,
  targetAspect: AspectRatioPreset,
  zoom: number,
  mirror: boolean,
  normX: number,
  normY: number
): RgbaColor | null {
  if (!segSampleCanvas || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const sw = 160;
  const sh = 160;
  segSampleCanvas.width = sw;
  segSampleCanvas.height = sh;
  const ctx = segSampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  drawCroppedSource(ctx, source, sourceWidth, sourceHeight, sw, sh, targetAspect, zoom, mirror);
  const px = Math.max(0, Math.min(sw - 1, Math.round(normX * (sw - 1))));
  const py = Math.max(0, Math.min(sh - 1, Math.round(normY * (sh - 1))));
  const d = ctx.getImageData(px, py, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2] };
}

function drawCroppedSource(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null,
  sourceWidth: number,
  sourceHeight: number,
  destW: number,
  destH: number,
  _aspectRatio: AspectRatioPreset,
  zoom: number,
  mirror: boolean
) {
  ctx.save();
  if (mirror) {
    ctx.translate(destW, 0);
    ctx.scale(-1, 1);
  }

  if (!source || sourceWidth <= 0 || sourceHeight <= 0) {
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, destW, destH);
    ctx.restore();
    return;
  }

  const destAspect = destW / destH;
  const srcAspect = sourceWidth / sourceHeight;
  let cropW = sourceWidth;
  let cropH = sourceHeight;

  if (srcAspect > destAspect) {
    cropW = sourceHeight * destAspect;
  } else {
    cropH = sourceWidth / destAspect;
  }

  const safeZoom = Math.max(1, Math.min(8, zoom));
  cropW /= safeZoom;
  cropH /= safeZoom;

  const sx = (sourceWidth - cropW) / 2;
  const sy = (sourceHeight - cropH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, destW, destH);
  ctx.restore();
}

function drawBackdropLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backdropId: BackgroundBackdropId,
  backdropImage: HTMLImageElement | null
) {
  if (backdropId === 'black') {
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (backdropId === 'white') {
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.4,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.75
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#e7e8ec');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (backdropImage && backdropImage.complete && backdropImage.naturalWidth > 0) {
    const iw = backdropImage.naturalWidth;
    const ih = backdropImage.naturalHeight;
    const scale = Math.max(width / iw, height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(backdropImage, (width - dw) / 2, (height - dh) / 2, dw, dh);
    return;
  }

  ctx.fillStyle = '#14171f';
  ctx.fillRect(0, 0, width, height);
}

function buildFallbackForegroundMask(
  foregroundSourceCanvas: HTMLCanvasElement,
  referencePixels: Uint8ClampedArray | null,
  sampledColor: RgbaColor,
  sensitivity: number,
  feather: number
): HTMLCanvasElement | null {
  if (!segSampleCanvas || !maskCanvas || !featheredMaskCanvas) return null;
  const sw = 160;
  const sh = 160;
  segSampleCanvas.width = sw;
  segSampleCanvas.height = sh;
  maskCanvas.width = sw;
  maskCanvas.height = sh;

  const sCtx = segSampleCanvas.getContext('2d', { willReadFrequently: true });
  const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!sCtx || !mCtx) return null;

  sCtx.drawImage(foregroundSourceCanvas, 0, 0, sw, sh);
  const frame = sCtx.getImageData(0, 0, sw, sh);
  const data = frame.data;
  const maskImage = mCtx.createImageData(sw, sh);
  const out = maskImage.data;

  const thresh = Math.max(12, sensitivity * 2.2);
  const softRange = Math.max(10, feather * 2.5);

  for (let i = 0; i < data.length; i += 4) {
    const pxIdx = i >> 2;
    const x = (pxIdx % sw) / sw;
    const y = Math.floor(pxIdx / sw) / sh;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let dist: number;
    if (referencePixels && referencePixels.length === data.length) {
      const rr = referencePixels[i];
      const rg = referencePixels[i + 1];
      const rb = referencePixels[i + 2];
      const dr = r - rr;
      const dg = g - rg;
      const db = b - rb;
      dist = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * 1.75;
    } else {
      const dr = r - sampledColor.r;
      const dg = g - sampledColor.g;
      const db = b - sampledColor.b;
      dist = Math.sqrt(dr * dr + dg * dg + db * db);
      const dx = (x - 0.5) / 0.34;
      const dy = (y - 0.52) / 0.44;
      const centerDist = Math.sqrt(dx * dx + dy * dy);
      if (centerDist < 0.82) {
        dist += (0.82 - centerDist) * 45;
      }
    }

    let alpha = 0;
    if (dist > thresh + softRange) {
      alpha = 255;
    } else if (dist > thresh) {
      alpha = Math.round(((dist - thresh) / softRange) * 255);
    }

    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = alpha;
  }

  mCtx.putImageData(maskImage, 0, 0);

  featheredMaskCanvas.width = foregroundSourceCanvas.width;
  featheredMaskCanvas.height = foregroundSourceCanvas.height;
  const fCtx = featheredMaskCanvas.getContext('2d');
  if (!fCtx) return maskCanvas;
  fCtx.clearRect(0, 0, featheredMaskCanvas.width, featheredMaskCanvas.height);
  fCtx.filter = `blur(${Math.max(2, Math.round(foregroundSourceCanvas.width * 0.012))}px)`;
  fCtx.drawImage(maskCanvas, 0, 0, featheredMaskCanvas.width, featheredMaskCanvas.height);
  fCtx.filter = 'none';
  return featheredMaskCanvas;
}

function drawHeartPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(x, y + topCurveHeight);
  ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
  ctx.bezierCurveTo(
    x - size / 2,
    y + (size + topCurveHeight) / 2,
    x,
    y + (size + topCurveHeight) / 1.35,
    x,
    y + size
  );
  ctx.bezierCurveTo(
    x,
    y + (size + topCurveHeight) / 1.35,
    x + size / 2,
    y + (size + topCurveHeight) / 2,
    x + size / 2,
    y + topCurveHeight
  );
  ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
  ctx.closePath();
}

function drawButterfly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  flap: number,
  colorA: string,
  colorB: string
) {
  ctx.save();
  ctx.translate(x, y);
  const wingW = size * (0.45 + 0.55 * Math.abs(Math.cos(flap)));
  const grad = ctx.createLinearGradient(-wingW, -size, wingW, size);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle = grad;

  // Left upper & lower wings
  ctx.beginPath();
  ctx.ellipse(-wingW * 0.55, -size * 0.25, wingW * 0.65, size * 0.48, -0.35, 0, Math.PI * 2);
  ctx.ellipse(-wingW * 0.45, size * 0.32, wingW * 0.48, size * 0.36, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Right upper & lower wings
  ctx.beginPath();
  ctx.ellipse(wingW * 0.55, -size * 0.25, wingW * 0.65, size * 0.48, 0.35, 0, Math.PI * 2);
  ctx.ellipse(wingW * 0.45, size * 0.32, wingW * 0.48, size * 0.36, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#090A0D';
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(1.5, size * 0.08), size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlameTongue(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sway: number,
  curl: number,
  colorTop: string,
  colorMid: string,
  colorBase: string
) {
  const grad = ctx.createLinearGradient(x, y, x + sway, y - h);
  grad.addColorStop(0, colorBase);
  grad.addColorStop(0.45, colorMid);
  grad.addColorStop(1, colorTop);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  ctx.bezierCurveTo(
    x - w * 0.85,
    y - h * 0.38,
    x - w * 0.2 + sway * 0.6,
    y - h * 0.72,
    x + sway,
    y - h
  );
  ctx.bezierCurveTo(
    x + w * 0.35 + curl * 0.6,
    y - h * 0.65,
    x + w * 0.82,
    y - h * 0.34,
    x + w * 0.5,
    y
  );
  ctx.quadraticCurveTo(x, y + w * 0.25, x - w * 0.5, y);
  ctx.closePath();
  ctx.fill();
}

function drawArOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: ArOverlayId,
  customName: string,
  nameAnim: 'float' | 'static' | 'glide' | 'orbit' | 'pulse',
  offset: { x: number; y: number },
  trackedFace: TrackedFacePose | null,
  timeMs: number
) {
  if (overlay === 'none') return;
  const t = timeMs * 0.001;

  // Dynamic body/head-tracked anchor
  const hasFace = Boolean(trackedFace && trackedFace.detected);
  const baseScale = Math.min(width, height) / 500;
  const cx = hasFace
    ? trackedFace!.centerX * width + offset.x * width * 0.35
    : width * (0.5 + offset.x);
  const cy = hasFace
    ? trackedFace!.centerY * height + offset.y * height * 0.35
    : height * (0.42 + offset.y);
  const faceW = hasFace ? Math.max(60 * baseScale, trackedFace!.width * width) : 145 * baseScale;
  const faceH = hasFace ? Math.max(70 * baseScale, trackedFace!.height * height) : 175 * baseScale;
  const scale = faceW / 145;
  const roll = hasFace ? trackedFace!.rollRad : 0;

  // Hair-top anchor stays cleanly ABOVE forehead & hair (not on eyebrows!)
  const hairTopY = Math.max(height * 0.1, cy - faceH * 0.98);

  const eyeMidX = hasFace
    ? ((trackedFace!.leftEyeX + trackedFace!.rightEyeX) * 0.5) * width + offset.x * width * 0.35
    : cx;
  const eyeMidY = hasFace
    ? ((trackedFace!.leftEyeY + trackedFace!.rightEyeY) * 0.5) * height + offset.y * height * 0.35
    : cy - 14 * scale;
  const eyeDist = hasFace
    ? Math.max(
        48 * baseScale,
        Math.hypot(
          (trackedFace!.rightEyeX - trackedFace!.leftEyeX) * width,
          (trackedFace!.rightEyeY - trackedFace!.leftEyeY) * height
        )
      )
    : 72 * scale;

  ctx.save();

  if (overlay === 'name-crown') {
    const textLabel = (customName || 'Hacker Ankit').trim() || 'Hacker Ankit';
    let animX = 0;
    let animY = 0;
    let animScale = 1;
    let glowExtra = 0;

    if (nameAnim === 'float') {
      animY = Math.sin(t * 2.8) * 10 * scale;
    } else if (nameAnim === 'glide') {
      animX = Math.sin(t * 2.2) * 28 * scale;
    } else if (nameAnim === 'orbit') {
      animX = Math.cos(t * 2.4) * 22 * scale;
      animY = Math.sin(t * 4.8) * 8 * scale;
    } else if (nameAnim === 'pulse') {
      animScale = 1 + 0.08 * Math.sin(t * 4.2);
      glowExtra = 10 * (0.5 + 0.5 * Math.sin(t * 4.2));
    }

    ctx.translate(cx + animX, hairTopY - 12 * scale + animY);
    ctx.rotate(roll);
    ctx.scale(animScale, animScale);

    const fontSize = Math.max(18, Math.round(28 * scale));
    ctx.font = `800 ${fontSize}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(textLabel).width;
    const pillPadX = 18 * scale;
    const pillH = fontSize * 1.45;

    // Subtle dark glass nameplate glow behind letters for 100% legibility in bright or dark rooms
    ctx.fillStyle = 'rgba(9, 10, 13, 0.58)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.beginPath();
    ctx.roundRect(-textW * 0.5 - pillPadX, -pillH * 0.5, textW + pillPadX * 2, pillH, 12 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = (16 + glowExtra) * scale;

    const grad = ctx.createLinearGradient(-textW * 0.5, -fontSize * 0.4, textW * 0.5, fontSize * 0.4);
    grad.addColorStop(0, '#fde047');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#f59e0b');

    ctx.lineWidth = Math.max(3, 4.5 * scale);
    ctx.strokeStyle = '#090A0D';
    ctx.strokeText(textLabel, 0, 1);
    ctx.fillStyle = grad;
    ctx.fillText(textLabel, 0, 1);
  } else if (overlay === 'hearts') {
    // Floating pink/red Dil (Hearts) orbiting gracefully above top of hair
    ctx.translate(cx, hairTopY - 10 * scale);
    ctx.rotate(roll);
    const orbiters = [
      { angle: 0, radX: 98, radY: 22, size: 28, color: '#ff2e63' },
      { angle: 1.25, radX: 98, radY: 22, size: 22, color: '#fb7185' },
      { angle: 2.5, radX: 98, radY: 22, size: 30, color: '#ef4444' },
      { angle: 3.75, radX: 98, radY: 22, size: 24, color: '#f43f5e' },
      { angle: 5.0, radX: 98, radY: 22, size: 26, color: '#fda4af' },
    ];
    for (let i = 0; i < orbiters.length; i++) {
      const o = orbiters[i];
      const ang = t * 1.85 + o.angle;
      const hx = Math.cos(ang) * o.radX * scale;
      const hy = Math.sin(ang) * o.radY * scale + Math.sin(t * 3.1 + i) * 7 * scale;
      const hSize = o.size * scale * (0.9 + 0.14 * Math.sin(t * 4 + i));

      ctx.save();
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 14 * scale;
      ctx.fillStyle = o.color;
      drawHeartPath(ctx, hx, hy - hSize * 0.5, hSize);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.stroke();
      ctx.restore();
    }
  } else if (overlay === 'halo') {
    ctx.translate(cx, hairTopY - 22 * scale + Math.sin(t * 2.5) * 4 * scale);
    ctx.rotate(roll);
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 24 * scale;
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 10 * scale;
    ctx.beginPath();
    ctx.ellipse(0, 0, 82 * scale, 22 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.ellipse(0, 0, 82 * scale, 22 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (overlay === 'crown') {
    ctx.translate(cx, hairTopY + 4 * scale);
    ctx.rotate(roll);
    const w = 136 * scale;
    const h = 68 * scale;
    const grad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(0.5, '#fde047');
    grad.addColorStop(1, '#d97706');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, 0);
    ctx.lineTo(-w * 0.52, -h * 0.85);
    ctx.lineTo(-w * 0.22, -h * 0.42);
    ctx.lineTo(0, -h);
    ctx.lineTo(w * 0.22, -h * 0.42);
    ctx.lineTo(w * 0.52, -h * 0.85);
    ctx.lineTo(w * 0.45, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -h * 0.24, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(-w * 0.26, -h * 0.2, 4.5 * scale, 0, Math.PI * 2);
    ctx.arc(w * 0.26, -h * 0.2, 4.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (overlay === 'glasses') {
    ctx.translate(eyeMidX, eyeMidY);
    ctx.rotate(roll);
    const gScale = eyeDist / 72;
    const lensW = 66 * gScale;
    const lensH = 42 * gScale;
    const gap = 16 * gScale;
    ctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(2, 4 * gScale);

    ctx.beginPath();
    ctx.roundRect(-gap - lensW, -lensH * 0.5, lensW, lensH, 10 * gScale);
    ctx.roundRect(gap, -lensH * 0.5, lensW, lensH, 10 * gScale);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-gap, -6 * gScale);
    ctx.lineTo(gap, -6 * gScale);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = Math.max(1.5, 3 * gScale);
    ctx.beginPath();
    ctx.moveTo(-gap - lensW + 14 * gScale, 10 * gScale);
    ctx.lineTo(-gap - 18 * gScale, -12 * gScale);
    ctx.moveTo(gap + 14 * gScale, 10 * gScale);
    ctx.lineTo(gap + lensW - 18 * gScale, -12 * gScale);
    ctx.stroke();
  } else if (overlay === 'cat-ears') {
    ctx.translate(cx, hairTopY + faceH * 0.12);
    ctx.rotate(roll);
    const drawEar = (sign: number) => {
      ctx.save();
      ctx.translate(sign * faceW * 0.4, 0);
      ctx.rotate(sign * 0.25);
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(-26 * scale, 12 * scale);
      ctx.lineTo(0, -56 * scale);
      ctx.lineTo(26 * scale, 12 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.moveTo(-14 * scale, 6 * scale);
      ctx.lineTo(0, -36 * scale);
      ctx.lineTo(14 * scale, 6 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    drawEar(-1);
    drawEar(1);

    // Cheek whiskers relative to nose center
    const whiskerOffsetY = cy - (hairTopY + faceH * 0.12) + faceH * 0.08;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.lineWidth = Math.max(1.5, 2.2 * scale);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      for (const dy of [-8, 2, 12]) {
        ctx.moveTo(side * faceW * 0.28, whiskerOffsetY + dy * scale);
        ctx.lineTo(side * faceW * 0.58, whiskerOffsetY + dy * 1.45 * scale);
      }
    }
    ctx.stroke();
  } else if (overlay === 'butterfly-crown') {
    ctx.translate(cx, hairTopY - 8 * scale);
    ctx.rotate(roll);
    const butterflies = [
      { x: -74, y: -6, s: 20, speed: 6.2, c1: '#f472b6', c2: '#fb7185' },
      { x: 0, y: -28, s: 25, speed: 5.4, c1: '#38bdf8', c2: '#818cf8' },
      { x: 74, y: -6, s: 20, speed: 6.8, c1: '#fbbf24', c2: '#f97316' },
      { x: -42, y: -22, s: 16, speed: 7.4, c1: '#34d399', c2: '#22d3ee' },
      { x: 42, y: -22, s: 16, speed: 7.1, c1: '#c084fc', c2: '#f472b6' },
    ];
    for (let i = 0; i < butterflies.length; i++) {
      const b = butterflies[i];
      const bobY = Math.sin(t * 2.5 + i * 1.4) * 8 * scale;
      drawButterfly(ctx, b.x * scale, b.y * scale + bobY, b.s * scale, t * b.speed + i, b.c1, b.c2);
    }
  } else if (overlay === 'fire-aura') {
    // Realistic blazing flame tongues arched cleanly ABOVE top of hair
    ctx.translate(cx, hairTopY + 12 * scale);
    ctx.rotate(roll);
    ctx.globalCompositeOperation = 'screen';

    // Outer ambient heat glow
    const glow = ctx.createRadialGradient(0, -25 * scale, 10 * scale, 0, -25 * scale, faceW * 0.9);
    glow.addColorStop(0, 'rgba(255, 130, 20, 0.36)');
    glow.addColorStop(0.55, 'rgba(239, 68, 68, 0.18)');
    glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -25 * scale, faceW * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Outer crimson/orange organic flame layer
    const outerCount = 13;
    for (let i = 0; i < outerCount; i++) {
      const ratio = (i / (outerCount - 1)) * 2 - 1;
      const fx = ratio * faceW * 0.64;
      const fy = Math.pow(ratio, 2) * 26 * scale;
      const h = (58 + 22 * Math.sin(t * 8.5 + i * 1.9) + (1 - Math.abs(ratio)) * 18) * scale;
      const w = (24 - Math.abs(ratio) * 6) * scale;
      const sway = Math.sin(t * 11 + i * 2.3) * 14 * scale + ratio * 10 * scale;
      const curl = Math.cos(t * 9.5 + i * 1.7) * 10 * scale;
      drawFlameTongue(
        ctx,
        fx,
        fy,
        w,
        h,
        sway,
        curl,
        'rgba(220, 38, 38, 0)',
        'rgba(249, 115, 22, 0.85)',
        'rgba(251, 146, 60, 0.95)'
      );
    }

    // Bright incandescent gold/white inner core flames
    const innerCount = 9;
    for (let i = 0; i < innerCount; i++) {
      const ratio = (i / (innerCount - 1)) * 2 - 1;
      const fx = ratio * faceW * 0.48;
      const fy = Math.pow(ratio, 2) * 18 * scale + 2 * scale;
      const h = (38 + 15 * Math.cos(t * 10.2 + i * 2.1) + (1 - Math.abs(ratio)) * 12) * scale;
      const w = (15 - Math.abs(ratio) * 3) * scale;
      const sway = Math.cos(t * 12.5 + i * 1.6) * 10 * scale;
      const curl = Math.sin(t * 11 + i * 2.2) * 8 * scale;
      drawFlameTongue(
        ctx,
        fx,
        fy,
        w,
        h,
        sway,
        curl,
        'rgba(253, 224, 71, 0)',
        'rgba(254, 240, 138, 0.9)',
        'rgba(255, 255, 255, 0.96)'
      );
    }

    // Rising glowing fire sparks / embers
    for (let s = 0; s < 18; s++) {
      const cycle = (t * 0.9 + s * 0.17) % 1;
      const sx = Math.sin(s * 3.1 + t * 2.2) * faceW * 0.68;
      const sy = -cycle * 115 * scale - 10 * scale;
      const alpha = (1 - cycle) * 0.95;
      const rad = Math.max(1.2, (3.2 - cycle * 2) * scale);
      ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (overlay === 'sparkles') {
    ctx.translate(cx, hairTopY + faceH * 0.15);
    const points = [
      { x: -120, y: -50, s: 1.1, speed: 2.1 },
      { x: 130, y: -40, s: 0.9, speed: 1.7 },
      { x: -145, y: 70, s: 0.75, speed: 2.8 },
      { x: 140, y: 85, s: 1.0, speed: 2.3 },
      { x: 0, y: -95, s: 1.2, speed: 1.9 },
    ];
    for (const p of points) {
      const pulse = 0.55 + 0.45 * Math.sin(t * p.speed + p.x);
      const sx = p.x * scale;
      const sy = p.y * scale;
      const arm = 18 * scale * p.s * pulse;
      ctx.fillStyle = `rgba(253, 224, 71, ${0.45 + 0.55 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy - arm);
      ctx.quadraticCurveTo(sx, sy, sx + arm, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy + arm);
      ctx.quadraticCurveTo(sx, sy, sx - arm, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy - arm);
      ctx.fill();
    }
  } else if (overlay === 'camcorder') {
    const pad = Math.round(Math.min(width, height) * 0.045);
    const corner = Math.round(Math.min(width, height) * 0.07);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, Math.round(baseScale * 3));
    const drawCorner = (x: number, y: number, dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(x + dx * corner, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * corner);
      ctx.stroke();
    };
    drawCorner(pad, pad, 1, 1);
    drawCorner(width - pad, pad, -1, 1);
    drawCorner(pad, height - pad, 1, -1);
    drawCorner(width - pad, height - pad, -1, -1);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = `600 ${Math.max(12, Math.round(14 * baseScale))}px "JetBrains Mono", monospace`;
    ctx.fillText('OPTICAL MASTER', pad + 12 * baseScale, pad + 26 * baseScale);
    ctx.fillText(new Date().toLocaleTimeString(), pad + 12 * baseScale, height - pad - 12 * baseScale);
  } else if (overlay === 'ankit-stamp') {
    const pad = Math.round(Math.min(width, height) * 0.04);
    ctx.fillStyle = 'rgba(9, 10, 13, 0.65)';
    const boxW = Math.round(250 * baseScale);
    const boxH = Math.round(34 * baseScale);
    ctx.beginPath();
    ctx.roundRect(pad, height - pad - boxH, boxW, boxH, 8 * baseScale);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.font = `700 ${Math.max(11, Math.round(13 * baseScale))}px "Outfit", sans-serif`;
    ctx.fillText('HACKER ANKIT CAMERA', pad + 12 * baseScale, height - pad - 12 * baseScale);
  }
  ctx.restore();
}

export function renderCameraFrame(options: RenderFrameOptions) {
  const {
    targetCanvas,
    source,
    sourceWidth,
    sourceHeight,
    isFrontCamera,
    settings,
    backdropImage,
    referenceBgPixels,
    sampledBgColor,
    arOffset,
    aiPersonMask = null,
    trackedFace = null,
    applySharpnessPass = false,
    timeMs = performance.now(),
  } = options;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  const W = targetCanvas.width;
  const H = targetCanvas.height;
  if (W <= 0 || H <= 0) return;

  if (!source || sourceWidth <= 0 || sourceHeight <= 0) {
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, W, H);
    return;
  }

  const shouldMirror = isFrontCamera && settings.mirrorFront;
  const preset = FILTER_PRESETS.find((f) => f.id === settings.filter) || FILTER_PRESETS[0];
  const iphonePreset =
    IPHONE_LOOKS.find((l) => l.id === settings.iphoneLook) || IPHONE_LOOKS[0];

  const boostBright = settings.autoEnhance ? 5 : 0;
  const boostContrast = settings.autoEnhance ? 6 : 0;
  const boostSat = settings.autoEnhance ? 7 : 0;

  const exp = settings.exposure + boostBright;
  const con = settings.contrast + boostContrast;
  const sat = settings.saturation + boostSat;

  const denoiseBlurPx = settings.iphoneNightDenoise ? 0.25 : 0;
  const totalBlurPx = (settings.beauty > 0 ? (settings.beauty / 100) * 0.35 : 0) + denoiseBlurPx;
  const beautyBlur = totalBlurPx > 0.05 ? ` blur(${totalBlurPx.toFixed(2)}px)` : '';

  const filterParts = [`brightness(${exp}%) contrast(${con}%) saturate(${sat}%)`];
  if (iphonePreset.cssFilter !== 'none') filterParts.push(iphonePreset.cssFilter);
  if (preset.cssFilter !== 'none') filterParts.push(preset.cssFilter);
  if (beautyBlur) filterParts.push(beautyBlur.trim());
  const combinedFilter = filterParts.join(' ');

  if (settings.backgroundMode === 'off' || !workCanvasA || !workCanvasB) {
    ctx.save();
    ctx.filter = combinedFilter;
    drawCroppedSource(
      ctx,
      source,
      sourceWidth,
      sourceHeight,
      W,
      H,
      settings.aspectRatio,
      settings.zoom,
      shouldMirror
    );
    ctx.filter = 'none';
    ctx.restore();
  } else if (settings.backgroundMode === 'bokeh') {
    workCanvasA.width = W;
    workCanvasA.height = H;
    const sharpCtx = workCanvasA.getContext('2d');
    if (sharpCtx) {
      sharpCtx.filter = combinedFilter;
      drawCroppedSource(
        sharpCtx,
        source,
        sourceWidth,
        sourceHeight,
        W,
        H,
        settings.aspectRatio,
        settings.zoom,
        shouldMirror
      );
      sharpCtx.filter = 'none';

      ctx.save();
      ctx.filter = `blur(${Math.max(4, Math.round((settings.bokehStrength / 10) * (W * 0.015)))}px)`;
      ctx.drawImage(workCanvasA, 0, 0, W, H);
      ctx.filter = 'none';
      ctx.restore();

      workCanvasB.width = W;
      workCanvasB.height = H;
      const maskCtx = workCanvasB.getContext('2d');
      if (maskCtx) {
        maskCtx.clearRect(0, 0, W, H);
        maskCtx.drawImage(workCanvasA, 0, 0);
        maskCtx.globalCompositeOperation = 'destination-in';
        if (aiPersonMask) {
          maskCtx.drawImage(aiPersonMask, 0, 0, W, H);
        } else {
          const radGrad = maskCtx.createRadialGradient(
            W * 0.5,
            H * 0.48,
            Math.min(W, H) * 0.22,
            W * 0.5,
            H * 0.5,
            Math.min(W, H) * 0.48
          );
          radGrad.addColorStop(0, 'rgba(0,0,0,1)');
          radGrad.addColorStop(0.65, 'rgba(0,0,0,0.92)');
          radGrad.addColorStop(1, 'rgba(0,0,0,0)');
          maskCtx.fillStyle = radGrad;
          maskCtx.fillRect(0, 0, W, H);
        }
        maskCtx.globalCompositeOperation = 'source-over';
        ctx.drawImage(workCanvasB, 0, 0);
      }
    }
  } else {
    workCanvasA.width = W;
    workCanvasA.height = H;
    workCanvasB.width = W;
    workCanvasB.height = H;
    const fgCtx = workCanvasA.getContext('2d');
    const compCtx = workCanvasB.getContext('2d');

    if (fgCtx && compCtx) {
      fgCtx.filter = combinedFilter;
      drawCroppedSource(
        fgCtx,
        source,
        sourceWidth,
        sourceHeight,
        W,
        H,
        settings.aspectRatio,
        settings.zoom,
        shouldMirror
      );
      fgCtx.filter = 'none';

      const alphaMask =
        aiPersonMask ||
        buildFallbackForegroundMask(
          workCanvasA,
          referenceBgPixels,
          sampledBgColor,
          settings.bgSensitivity,
          settings.bgFeather
        );

      drawBackdropLayer(ctx, W, H, settings.backdrop, backdropImage);

      if (alphaMask) {
        compCtx.clearRect(0, 0, W, H);
        compCtx.drawImage(workCanvasA, 0, 0, W, H);
        compCtx.globalCompositeOperation = 'destination-in';
        compCtx.drawImage(alphaMask, 0, 0, W, H);
        compCtx.globalCompositeOperation = 'source-over';
        ctx.drawImage(workCanvasB, 0, 0, W, H);
      } else {
        ctx.drawImage(workCanvasA, 0, 0, W, H);
      }
    }
  }

  // Anti-Glare highlight roll-off (tames bright indoor ceiling lights & glare cleanly)
  const glareAmount = Math.min(
    0.34,
    (settings.iphoneAntiGlare ? 0.16 : 0) + (iphonePreset.highlightTame || 0)
  );
  if (glareAmount > 0.02 && glareWorkCanvas) {
    glareWorkCanvas.width = Math.max(2, Math.round(W / 4));
    glareWorkCanvas.height = Math.max(2, Math.round(H / 4));
    const gCtx = glareWorkCanvas.getContext('2d');
    if (gCtx) {
      gCtx.filter = 'blur(8px) brightness(92%)';
      gCtx.drawImage(targetCanvas, 0, 0, glareWorkCanvas.width, glareWorkCanvas.height);
      gCtx.filter = 'none';

      ctx.save();
      ctx.globalAlpha = glareAmount;
      ctx.globalCompositeOperation = 'darken';
      ctx.drawImage(glareWorkCanvas, 0, 0, W, H);
      ctx.restore();
    }
  }

  // Shadow recovery lift (great for dark rooms & low-light night clarity)
  const totalShadowBoost = Math.min(
    0.36,
    (settings.shadows / 100) * 0.34 + (preset.shadowBoost || 0) + (iphonePreset.shadowBoost || 0)
  );
  if (totalShadowBoost > 0.01) {
    ctx.save();
    ctx.globalAlpha = totalShadowBoost;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(targetCanvas, 0, 0, W, H);
    ctx.restore();
  }

  // White balance warmth/cool tint
  if (Math.abs(settings.warmth) > 2) {
    ctx.save();
    ctx.fillStyle =
      settings.warmth > 0
        ? `rgba(255, 168, 76, ${Math.min(0.22, (settings.warmth / 50) * 0.18)})`
        : `rgba(86, 178, 255, ${Math.min(0.22, (-settings.warmth / 50) * 0.18)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // iPhone & Filter color washes
  if (iphonePreset.overlayColor) {
    ctx.save();
    ctx.fillStyle = iphonePreset.overlayColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (preset.overlayColor) {
    ctx.save();
    ctx.fillStyle = preset.overlayColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const totalVignette = Math.min(0.55, (preset.vignette || 0) + (iphonePreset.vignette || 0));
  if (totalVignette > 0.01) {
    ctx.save();
    const vig = ctx.createRadialGradient(
      W * 0.5,
      H * 0.5,
      Math.min(W, H) * 0.3,
      W * 0.5,
      H * 0.5,
      Math.max(W, H) * 0.72
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${totalVignette})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Soft beauty glow pass
  if (settings.beauty > 15) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.18, (settings.beauty / 100) * 0.16);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#fff5ee';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Anti-Pixelation Deep Fusion Crispness (runs BEFORE crisp AR stickers so stickers never halo)
  const sharpBoost = iphonePreset.sharpBoost || 0;
  const shouldSharpen = applySharpnessPass || settings.iphoneAntiPixelate || sharpBoost > 0.05;
  if (shouldSharpen && sharpWorkCanvas) {
    const sharpAmount = Math.min(
      0.24,
      (settings.sharpness / 100) * 0.12 + sharpBoost * 0.35 + (settings.iphoneAntiPixelate ? 0.08 : 0)
    );
    if (sharpAmount > 0.02) {
      ctx.save();
      ctx.globalAlpha = sharpAmount;
      ctx.globalCompositeOperation = 'soft-light';
      ctx.drawImage(targetCanvas, 0, 0, W, H);
      ctx.restore();
    }
  }

  // Dynamic Face/Body-Tracked Snapchat AR Overlays & Watermarks
  drawArOverlay(
    ctx,
    W,
    H,
    settings.arOverlay,
    settings.arCustomName,
    settings.arNameAnimation,
    arOffset,
    trackedFace,
    timeMs
  );
}
