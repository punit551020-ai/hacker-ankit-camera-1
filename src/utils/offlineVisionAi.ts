import { FaceDetector, FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

export interface TrackedFacePose {
  detected: boolean;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  leftEyeX: number;
  leftEyeY: number;
  rightEyeX: number;
  rightEyeY: number;
  rollRad: number;
}

let visionInitPromise: Promise<{
  segmenter: ImageSegmenter | null;
  faceDetector: FaceDetector | null;
}> | null = null;

let aiMaskCanvas: HTMLCanvasElement | null = null;
let aiMaskRawCanvas: HTMLCanvasElement | null = null;

export async function initOfflineVisionAi(): Promise<{
  segmenter: ImageSegmenter | null;
  faceDetector: FaceDetector | null;
}> {
  if (visionInitPromise) return visionInitPromise;

  visionInitPromise = (async () => {
    try {
      const rawBase = import.meta.env.BASE_URL || './';
      const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
      const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);

      let segmenter: ImageSegmenter | null = null;
      let faceDetector: FaceDetector | null = null;

      try {
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `${base}models/selfie_segmenter.tflite`,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      } catch {
        try {
          segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `${base}models/selfie_segmenter.tflite`,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            outputCategoryMask: false,
            outputConfidenceMasks: true,
          });
        } catch {
          segmenter = null;
        }
      }

      try {
        faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `${base}models/blaze_face_short_range.tflite`,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.45,
        });
      } catch {
        try {
          faceDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `${base}models/blaze_face_short_range.tflite`,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.45,
          });
        } catch {
          faceDetector = null;
        }
      }

      return { segmenter, faceDetector };
    } catch {
      return { segmenter: null, faceDetector: null };
    }
  })();

  return visionInitPromise;
}

export function runPersonSegmentationMask(
  segmenter: ImageSegmenter,
  inputCanvas: HTMLCanvasElement,
  timestampMs: number,
  sensitivity: number
): HTMLCanvasElement | null {
  if (!aiMaskRawCanvas) aiMaskRawCanvas = document.createElement('canvas');
  if (!aiMaskCanvas) aiMaskCanvas = document.createElement('canvas');

  let outMaskCanvas: HTMLCanvasElement | null = null;

  try {
    segmenter.segmentForVideo(inputCanvas, timestampMs, (result) => {
      const conf = result.confidenceMasks?.[0];
      if (!conf) return;

      const mw = conf.width;
      const mh = conf.height;
      const floats = conf.getAsFloat32Array();
      if (!floats || floats.length === 0) return;

      aiMaskRawCanvas!.width = mw;
      aiMaskRawCanvas!.height = mh;
      const rCtx = aiMaskRawCanvas!.getContext('2d', { willReadFrequently: true });
      if (!rCtx) return;

      const img = rCtx.createImageData(mw, mh);
      const data = img.data;

      // Crisp person edge cutoff that minimizes pale wall bleed around hair/shoulders
      const centerCutoff = Math.max(0.24, Math.min(0.78, 0.58 - ((sensitivity - 44) / 100) * 0.4));
      const low = Math.max(0.12, centerCutoff - 0.11);
      const high = Math.min(0.95, centerCutoff + 0.12);
      const span = Math.max(0.05, high - low);

      for (let i = 0; i < floats.length; i++) {
        const p = floats[i];
        let a = 0;
        if (p >= high) {
          a = 255;
        } else if (p > low) {
          const t = (p - low) / span;
          const curved = Math.pow(t, 1.35);
          a = Math.round(curved * curved * (3 - 2 * curved) * 255);
        }
        const px = i * 4;
        data[px] = 255;
        data[px + 1] = 255;
        data[px + 2] = 255;
        data[px + 3] = a;
      }

      rCtx.putImageData(img, 0, 0);

      aiMaskCanvas!.width = inputCanvas.width;
      aiMaskCanvas!.height = inputCanvas.height;
      const mCtx = aiMaskCanvas!.getContext('2d');
      if (!mCtx) return;

      mCtx.clearRect(0, 0, aiMaskCanvas!.width, aiMaskCanvas!.height);
      mCtx.filter = `blur(${Math.max(1, Math.round(aiMaskCanvas!.width * 0.0032))}px)`;
      mCtx.drawImage(aiMaskRawCanvas!, 0, 0, aiMaskCanvas!.width, aiMaskCanvas!.height);
      mCtx.filter = 'none';
      outMaskCanvas = aiMaskCanvas;
    });
  } catch {
    return null;
  }

  return outMaskCanvas;
}

export function runLiveFaceDetection(
  faceDetector: FaceDetector,
  inputCanvas: HTMLCanvasElement,
  timestampMs: number,
  prevPose: TrackedFacePose | null
): TrackedFacePose | null {
  try {
    const result = faceDetector.detectForVideo(inputCanvas, timestampMs);
    const det = result.detections?.[0];
    if (!det || !det.boundingBox) {
      return prevPose ? { ...prevPose, detected: false } : null;
    }

    const W = inputCanvas.width || 1;
    const H = inputCanvas.height || 1;
    const box = det.boundingBox;

    const rawCx = (box.originX + box.width * 0.5) / W;
    const rawCy = (box.originY + box.height * 0.5) / H;
    const rawW = box.width / W;
    const rawH = box.height / H;

    // Keypoints: 0 = rightEye, 1 = leftEye (relative to image)
    const kp0 = det.keypoints?.[0];
    const kp1 = det.keypoints?.[1];

    let eye1X = kp0 ? kp0.x : rawCx - rawW * 0.22;
    let eye1Y = kp0 ? kp0.y : rawCy - rawH * 0.12;
    let eye2X = kp1 ? kp1.x : rawCx + rawW * 0.22;
    let eye2Y = kp1 ? kp1.y : rawCy - rawH * 0.12;

    if (eye1X > eye2X) {
      [eye1X, eye2X] = [eye2X, eye1X];
      [eye1Y, eye2Y] = [eye2Y, eye1Y];
    }

    const rollRad = Math.atan2((eye2Y - eye1Y) * H, (eye2X - eye1X) * W);

    const smooth = (a: number, b: number) => a + (b - a) * 0.45;
    if (prevPose) {
      return {
        detected: true,
        centerX: smooth(prevPose.centerX, rawCx),
        centerY: smooth(prevPose.centerY, rawCy),
        width: smooth(prevPose.width, rawW),
        height: smooth(prevPose.height, rawH),
        leftEyeX: smooth(prevPose.leftEyeX, eye1X),
        leftEyeY: smooth(prevPose.leftEyeY, eye1Y),
        rightEyeX: smooth(prevPose.rightEyeX, eye2X),
        rightEyeY: smooth(prevPose.rightEyeY, eye2Y),
        rollRad: smooth(prevPose.rollRad, rollRad),
      };
    }

    return {
      detected: true,
      centerX: rawCx,
      centerY: rawCy,
      width: rawW,
      height: rawH,
      leftEyeX: eye1X,
      leftEyeY: eye1Y,
      rightEyeX: eye2X,
      rightEyeY: eye2Y,
      rollRad,
    };
  } catch {
    return prevPose;
  }
}
