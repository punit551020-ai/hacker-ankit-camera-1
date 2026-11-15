import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Edit3,
  Film,
  FlipHorizontal,
  FolderSync,
  Grid3x3,
  ImagePlus,
  Layers,
  Pause,
  Play,
  Share2,
  Sliders,
  Smartphone,
  Sparkles,
  Square,
  Timer,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
  Zap,
  ZapOff,
} from 'lucide-react';
import { FaceDetector, ImageSegmenter } from '@mediapipe/tasks-vision';
import bgBurjKhalifaImg from '../assets/images/bg_burj_khalifa_dubai_1794734587538.jpg';
import bgWaterfallImg from '../assets/images/bg_giant_waterfall_1794734589990.jpg';
import bgGrandTempleImg from '../assets/images/bg_grand_temple_1794734590398.jpg';
import bgFamousStatueImg from '../assets/images/bg_famous_statue_1794734590001.jpg';
import bgGoogleCampusImg from '../assets/images/bg_google_campus_1794734590698.jpg';
import bgOceanSunriseImg from '../assets/images/bg_ocean_sunrise_1794734591252.jpg';
import bgWaterParkImg from '../assets/images/bg_water_park_1794734591932.jpg';
import bgHackerAnkitImg from '../assets/images/bg_hacker_ankit_cyber_1794734592221.jpg';
import bgBotanicalParkImg from '../assets/images/bg_botanical_park_1794734592032.jpg';
import bgTajMahalImg from '../assets/images/bg_taj_mahal_dawn_1794734592726.jpg';
import bgHighPeakImg from '../assets/images/bg_high_peak_cliff_1794734625014.jpg';
import bgEiffelParisImg from '../assets/images/bg_eiffel_paris_1794734626251.jpg';
import bgGrandVillaImg from '../assets/images/bg_grand_villa_estate_1794734626238.jpg';
import bgSupercarGarageImg from '../assets/images/bg_supercar_garage_1794734626702.jpg';
import bgSpaceEarthImg from '../assets/images/bg_space_galaxy_earth_1794734626786.jpg';
import bgRoyalPalaceImg from '../assets/images/bg_royal_palace_hall_1794734627027.jpg';
import bgConcertStageImg from '../assets/images/bg_concert_arena_lights_1794734628114.jpg';
import bgNeonCityImg from '../assets/images/bg_times_square_night_1794734627895.jpg';
import bgBambooGardenImg from '../assets/images/bg_bamboo_zen_garden_1794734628089.jpg';
import bgNightStadiumImg from '../assets/images/bg_cricket_stadium_night_1794734629195.jpg';
import bgLuxuryHouseImg from '../assets/images/bg_luxury_house_1794733030719.jpg';
import bgGreenForestImg from '../assets/images/bg_green_forest_1794733031208.jpg';
import bgCityBridgeImg from '../assets/images/bg_city_bridge_1794733031692.jpg';
import bgCitySkylineImg from '../assets/images/bg_city_skyline_empty_1794733052011.jpg';
import bgModernRoomImg from '../assets/images/bg_modern_room_1794733032782.jpg';
import bgLuxuryInteriorImg from '../assets/images/bg_luxury_interior_empty_1794733053143.jpg';
import bgTropicalBeachImg from '../assets/images/bg_tropical_beach_empty_1794733052448.jpg';
import bgSakuraGardenImg from '../assets/images/bg_sakura_garden_1794733033612.jpg';
import bgSnowPeaksImg from '../assets/images/bg_snow_peaks_1794733033699.jpg';
import bgSunsetImg from '../assets/images/bg_studio_sunset_1794729671086.jpg';
import bgMountainImg from '../assets/images/bg_mountain_lake_1794729671602.jpg';
import bgStudioImg from '../assets/images/bg_neon_cyber_1794729671965.jpg';
import {
  ArOverlayId,
  AspectRatioPreset,
  BackgroundBackdropId,
  BackgroundMode,
  CameraSettings,
  FILTER_PRESETS,
  GridMode,
  IPHONE_LOOKS,
  MediaItemRecord,
  NameAnimationStyle,
  RESOLUTION_MAP,
  ResolutionPreset,
  getTargetDimensions,
} from '../types/camera';
import {
  RgbaColor,
  captureReferenceFramePixels,
  getTargetAspectNumeric,
  prepareCroppedFrameCanvas,
  renderCameraFrame,
  samplePixelColorFromSource,
} from '../utils/canvasProcessor';
import {
  TrackedFacePose,
  initOfflineVisionAi,
  runLiveFaceDetection,
  runPersonSegmentationMask,
} from '../utils/offlineVisionAi';
import { playCountdownBeep, playRecordTone, playShutterClick } from '../utils/cameraSound';
import {
  DirectoryHandleLike,
  formatDurationClock,
  shareMediaFile,
  triggerDeviceDownload,
  writeBlobToFolder,
} from '../utils/offlineGallery';

interface CameraViewfinderProps {
  settings: CameraSettings;
  onChangeSettings: React.Dispatch<React.SetStateAction<CameraSettings>>;
  lastItem: MediaItemRecord | null;
  onCaptureSaved: (item: MediaItemRecord) => Promise<void>;
  onOpenGallery: () => void;
  linkedFolder: DirectoryHandleLike | null;
  onPickFolder: () => Promise<void>;
  supportsFolderPicker: boolean;
}

type ControlSheet = 'filters' | 'iphone' | 'background' | 'lenses' | 'pro';
type FilterCategory = 'all' | 'rescue' | 'color' | 'bw' | 'cinema';
type BackdropCategory = 'all' | 'landmarks' | 'nature' | 'luxury' | 'custom';

interface BackdropItem {
  id: BackgroundBackdropId;
  label: string;
  cat: BackdropCategory;
  preview?: string;
  color?: string;
}

const BACKDROPS: BackdropItem[] = [
  { id: 'hacker-ankit', label: 'Hacker Ankit', cat: 'luxury', preview: bgHackerAnkitImg },
  { id: 'burj-khalifa', label: 'Burj Khalifa', cat: 'landmarks', preview: bgBurjKhalifaImg },
  { id: 'waterfall', label: 'Mega Waterfall', cat: 'nature', preview: bgWaterfallImg },
  { id: 'temple', label: 'Grand Temple', cat: 'landmarks', preview: bgGrandTempleImg },
  { id: 'famous-statue', label: 'Hero Statue', cat: 'landmarks', preview: bgFamousStatueImg },
  { id: 'google-campus', label: 'Tech Campus', cat: 'luxury', preview: bgGoogleCampusImg },
  { id: 'ocean-sunrise', label: 'Ocean Sunrise', cat: 'nature', preview: bgOceanSunriseImg },
  { id: 'water-park', label: 'Water Park', cat: 'nature', preview: bgWaterParkImg },
  { id: 'taj-mahal', label: 'Taj Mahal', cat: 'landmarks', preview: bgTajMahalImg },
  { id: 'botanical-park', label: 'Flower Park', cat: 'nature', preview: bgBotanicalParkImg },
  { id: 'high-peak', label: 'Sky Cliff', cat: 'nature', preview: bgHighPeakImg },
  { id: 'eiffel-paris', label: 'Paris Eiffel', cat: 'landmarks', preview: bgEiffelParisImg },
  { id: 'grand-villa', label: 'Royal Villa', cat: 'luxury', preview: bgGrandVillaImg },
  { id: 'supercar-garage', label: 'Supercar Hall', cat: 'luxury', preview: bgSupercarGarageImg },
  { id: 'space-earth', label: 'Space Orbit', cat: 'luxury', preview: bgSpaceEarthImg },
  { id: 'royal-palace', label: 'Palace Hall', cat: 'landmarks', preview: bgRoyalPalaceImg },
  { id: 'concert-stage', label: 'Concert Stage', cat: 'luxury', preview: bgConcertStageImg },
  { id: 'neon-city', label: 'Neon Street', cat: 'landmarks', preview: bgNeonCityImg },
  { id: 'bamboo-garden', label: 'Bamboo Trail', cat: 'nature', preview: bgBambooGardenImg },
  { id: 'night-stadium', label: 'Night Stadium', cat: 'landmarks', preview: bgNightStadiumImg },
  { id: 'luxury-house', label: 'Modern House', cat: 'luxury', preview: bgLuxuryHouseImg },
  { id: 'green-forest', label: 'Green Jungle', cat: 'nature', preview: bgGreenForestImg },
  { id: 'city-bridge', label: 'City Bridge', cat: 'landmarks', preview: bgCityBridgeImg },
  { id: 'city-skyline', label: 'City Skyline', cat: 'landmarks', preview: bgCitySkylineImg },
  { id: 'modern-room', label: 'Studio Room', cat: 'luxury', preview: bgModernRoomImg },
  { id: 'luxury-interior', label: 'Penthouse', cat: 'luxury', preview: bgLuxuryInteriorImg },
  { id: 'tropical-beach', label: 'Sunset Beach', cat: 'nature', preview: bgTropicalBeachImg },
  { id: 'sakura-garden', label: 'Sakura Park', cat: 'nature', preview: bgSakuraGardenImg },
  { id: 'snow-peaks', label: 'Snowy Peaks', cat: 'nature', preview: bgSnowPeaksImg },
  { id: 'sunset', label: 'Sunset Bokeh', cat: 'nature', preview: bgSunsetImg },
  { id: 'mountain', label: 'Alpine Lake', cat: 'nature', preview: bgMountainImg },
  { id: 'studio', label: 'Dark Studio', cat: 'luxury', preview: bgStudioImg },
  { id: 'black', label: 'Pure Black', cat: 'custom', color: '#050506' },
  { id: 'white', label: 'Pure White', cat: 'custom', color: '#f4f4f5' },
  { id: 'custom', label: 'My Photo', cat: 'custom' },
];

const AR_OVERLAYS: Array<{ id: ArOverlayId; label: string; badge?: string }> = [
  { id: 'none', label: 'Off' },
  { id: 'name-crown', label: 'Name Crown', badge: 'Edit Name' },
  { id: 'hearts', label: 'Floating Hearts', badge: 'Above Hair' },
  { id: 'fire-aura', label: 'Real Fire Aura', badge: 'Above Hair' },
  { id: 'crown', label: 'Royal Crown', badge: 'Above Hair' },
  { id: 'halo', label: 'Angel Halo', badge: 'Above Hair' },
  { id: 'glasses', label: 'Cyber Shades', badge: 'Eye Track' },
  { id: 'cat-ears', label: 'Cat Ears', badge: 'Head Track' },
  { id: 'butterfly-crown', label: 'Butterflies', badge: 'Above Hair' },
  { id: 'sparkles', label: 'Sparkle Stars', badge: 'Face Track' },
  { id: 'camcorder', label: 'REC Frame' },
  { id: 'ankit-stamp', label: 'Ankit Stamp' },
];

const NAME_ANIMATIONS: Array<{ id: NameAnimationStyle; label: string }> = [
  { id: 'float', label: 'Up-Down Float' },
  { id: 'static', label: 'Fixed Still' },
  { id: 'glide', label: 'Left-Right Glide' },
  { id: 'orbit', label: 'Circle Orbit' },
  { id: 'pulse', label: 'Neon Glow Pulse' },
];

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  settings,
  onChangeSettings,
  lastItem,
  onCaptureSaved,
  onOpenGallery,
  linkedFolder,
  onPickFolder,
  supportsFolderPicker,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiInputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const backdropImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const referenceBgRef = useRef<Uint8ClampedArray | null>(null);

  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const aiMaskRef = useRef<HTMLCanvasElement | null>(null);
  const trackedFaceRef = useRef<TrackedFacePose | null>(null);
  const lastAiSegTimeRef = useRef<number>(0);
  const lastAiFaceTimeRef = useRef<number>(0);
  const lastVideoTimestampRef = useRef<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartMsRef = useRef<number>(0);
  const pausedDurationMsRef = useRef<number>(0);
  const pauseStartMsRef = useRef<number>(0);
  const recordTimerIntervalRef = useRef<number | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'live' | 'blocked'>('starting');
  const [torchSupported, setTorchSupported] = useState(false);

  const [activeSheet, setActiveSheet] = useState<ControlSheet>('filters');
  const [filterCat, setFilterCat] = useState<FilterCategory>('all');
  const [backdropCat, setBackdropCat] = useState<BackdropCategory>('all');
  const [sampledBgColor, setSampledBgColor] = useState<RgbaColor>({ r: 28, g: 36, b: 48 });
  const [bgCalibrated, setBgCalibrated] = useState(false);
  const [arOffset, setArOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingAr, setIsDraggingAr] = useState(false);

  const [screenFlashPulse, setScreenFlashPulse] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordPaused, setIsRecordPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [saveToast, setSaveToast] = useState<{ item: MediaItemRecord; text: string } | null>(null);

  const customBackdropInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    initOfflineVisionAi().then(({ segmenter, faceDetector }) => {
      if (!mounted) return;
      segmenterRef.current = segmenter;
      faceDetectorRef.current = faceDetector;
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Preload all 32 offline image backdrop plates
  useEffect(() => {
    const map: Record<string, string> = {
      'hacker-ankit': bgHackerAnkitImg,
      'burj-khalifa': bgBurjKhalifaImg,
      waterfall: bgWaterfallImg,
      temple: bgGrandTempleImg,
      'famous-statue': bgFamousStatueImg,
      'google-campus': bgGoogleCampusImg,
      'ocean-sunrise': bgOceanSunriseImg,
      'water-park': bgWaterParkImg,
      'botanical-park': bgBotanicalParkImg,
      'taj-mahal': bgTajMahalImg,
      'high-peak': bgHighPeakImg,
      'eiffel-paris': bgEiffelParisImg,
      'grand-villa': bgGrandVillaImg,
      'supercar-garage': bgSupercarGarageImg,
      'space-earth': bgSpaceEarthImg,
      'royal-palace': bgRoyalPalaceImg,
      'concert-stage': bgConcertStageImg,
      'neon-city': bgNeonCityImg,
      'bamboo-garden': bgBambooGardenImg,
      'night-stadium': bgNightStadiumImg,
      'luxury-house': bgLuxuryHouseImg,
      'green-forest': bgGreenForestImg,
      'city-bridge': bgCityBridgeImg,
      'city-skyline': bgCitySkylineImg,
      'modern-room': bgModernRoomImg,
      'luxury-interior': bgLuxuryInteriorImg,
      'tropical-beach': bgTropicalBeachImg,
      'sakura-garden': bgSakuraGardenImg,
      'snow-peaks': bgSnowPeaksImg,
      sunset: bgSunsetImg,
      mountain: bgMountainImg,
      studio: bgStudioImg,
    };
    Object.entries(map).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      backdropImagesRef.current[key] = img;
    });
  }, []);

  useEffect(() => {
    if (settings.customBackdropDataUrl) {
      const img = new Image();
      img.src = settings.customBackdropDataUrl;
      backdropImagesRef.current['custom'] = img;
    }
  }, [settings.customBackdropDataUrl]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const refreshDeviceList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === 'videoinput'));
    } catch {
      // Ignore enumerate failure
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'user' | 'environment', explicitDeviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('blocked');
        return;
      }
      setCameraStatus('starting');
      stopCameraStream();

      const attemptGetStream = async (): Promise<MediaStream> => {
        const primaryConstraints: MediaTrackConstraints = explicitDeviceId
          ? {
              deviceId: { exact: explicitDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: { ideal: mode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            };

        try {
          return await navigator.mediaDevices.getUserMedia({
            video: primaryConstraints,
            audio: false,
          });
        } catch (err) {
          const name = err instanceof Error ? err.name : '';
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            throw err;
          }
          return await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      };

      try {
        const stream = await attemptGetStream();
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities() as { torch?: boolean };
          setTorchSupported(Boolean(caps?.torch));
        } else {
          setTorchSupported(false);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraStatus('live');
        refreshDeviceList();
      } catch {
        setCameraStatus('blocked');
      }
    },
    [refreshDeviceList, stopCameraStream]
  );

  useEffect(() => {
    startCamera(facingMode, selectedDeviceId || undefined);
    return () => {
      stopCameraStream();
    };
  }, [facingMode, selectedDeviceId, startCamera, stopCameraStream]);

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    track
      .applyConstraints({
        advanced: [{ torch: settings.flash === 'on' } as MediaTrackConstraintSet],
      })
      .catch(() => undefined);
  }, [settings.flash, torchSupported, cameraStatus]);

  const lastThumbnailUrl = useMemo(() => {
    if (!lastItem) return null;
    return URL.createObjectURL(lastItem.blob);
  }, [lastItem]);

  useEffect(() => {
    return () => {
      if (lastThumbnailUrl) URL.revokeObjectURL(lastThumbnailUrl);
    };
  }, [lastThumbnailUrl]);

  const getActiveVideoSource = useCallback((): {
    source: HTMLVideoElement | null;
    width: number;
    height: number;
  } => {
    const vid = videoRef.current;
    if (cameraStatus === 'live' && vid && vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
      return {
        source: vid,
        width: vid.videoWidth,
        height: vid.videoHeight,
      };
    }
    return { source: null, width: 0, height: 0 };
  }, [cameraStatus]);

  useEffect(() => {
    let rafId = 0;
    const renderLoop = (now: number) => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const { source, width: srcW, height: srcH } = getActiveVideoSource();
        if (source && srcW > 0 && srcH > 0) {
          const aspectNum = getTargetAspectNumeric(settings.aspectRatio, srcW, srcH);
          const baseShort = isRecording ? 720 : 720;
          let previewW = baseShort;
          let previewH = Math.round(baseShort / aspectNum);
          if (aspectNum > 1) {
            previewW = Math.round(baseShort * aspectNum);
            previewH = baseShort;
          }
          previewW = Math.max(2, Math.round(previewW / 2) * 2);
          previewH = Math.max(2, Math.round(previewH / 2) * 2);

          if (canvas.width !== previewW || canvas.height !== previewH) {
            canvas.width = previewW;
            canvas.height = previewH;
          }

          const needSeg = settings.backgroundMode !== 'off';
          const needFace =
            settings.arOverlay !== 'none' &&
            settings.arOverlay !== 'camcorder' &&
            settings.arOverlay !== 'ankit-stamp';

          if (needSeg || needFace) {
            if (!aiInputCanvasRef.current) {
              aiInputCanvasRef.current = document.createElement('canvas');
            }
            const aiCanvas = aiInputCanvasRef.current;
            const segDue = needSeg && segmenterRef.current && now - lastAiSegTimeRef.current >= 32;
            const faceDue = needFace && faceDetectorRef.current && now - lastAiFaceTimeRef.current >= 32;

            if (segDue || faceDue) {
              const ready = prepareCroppedFrameCanvas(
                aiCanvas,
                source,
                srcW,
                srcH,
                settings.aspectRatio,
                settings.zoom,
                facingMode === 'user' && settings.mirrorFront
              );
              if (ready) {
                const ts = Math.max(lastVideoTimestampRef.current + 1, Math.round(now));
                lastVideoTimestampRef.current = ts;

                if (segDue && segmenterRef.current) {
                  lastAiSegTimeRef.current = now;
                  const mask = runPersonSegmentationMask(
                    segmenterRef.current,
                    aiCanvas,
                    ts,
                    settings.bgSensitivity
                  );
                  if (mask) aiMaskRef.current = mask;
                }

                if (faceDue && faceDetectorRef.current) {
                  lastAiFaceTimeRef.current = now;
                  const nextTs = Math.max(lastVideoTimestampRef.current + 1, ts + 1);
                  lastVideoTimestampRef.current = nextTs;
                  trackedFaceRef.current = runLiveFaceDetection(
                    faceDetectorRef.current,
                    aiCanvas,
                    nextTs,
                    trackedFaceRef.current
                  );
                }
              }
            }
          }

          renderCameraFrame({
            targetCanvas: canvas,
            source,
            sourceWidth: srcW,
            sourceHeight: srcH,
            isFrontCamera: facingMode === 'user',
            settings,
            backdropImage: backdropImagesRef.current[settings.backdrop] || null,
            referenceBgPixels: referenceBgRef.current,
            sampledBgColor,
            arOffset,
            aiPersonMask: needSeg ? aiMaskRef.current : null,
            trackedFace: needFace ? trackedFaceRef.current : null,
            applySharpnessPass: false,
            timeMs: now,
          });
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    arOffset,
    facingMode,
    getActiveVideoSource,
    isRecording,
    sampledBgColor,
    settings,
  ]);

  const persistCapture = useCallback(
    async (item: MediaItemRecord, toastText: string) => {
      try {
        await onCaptureSaved(item);
      } catch {
        // Ignore storage error
      }

      if (settings.autoSaveDevice) {
        triggerDeviceDownload(item.blob, item.filename);
      }

      if (linkedFolder) {
        await writeBlobToFolder(linkedFolder, item.blob, item.filename);
      }

      setSaveToast({ item, text: toastText });
      setTimeout(() => {
        setSaveToast((curr) => (curr?.item.id === item.id ? null : curr));
      }, 6000);
    },
    [linkedFolder, onCaptureSaved, settings.autoSaveDevice]
  );

  const canvasToJpegBlob = async (canvas: HTMLCanvasElement, quality = 0.94): Promise<Blob | null> => {
    const blobFromToBlob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
      } catch {
        resolve(null);
      }
    });
    if (blobFromToBlob && blobFromToBlob.size > 0) return blobFromToBlob;

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        const res = await fetch(dataUrl);
        return await res.blob();
      }
    } catch {
      // Ignore fallback error
    }
    return null;
  };

  const executeSinglePhotoCapture = useCallback(async () => {
    const { source, width: srcW, height: srcH } = getActiveVideoSource();
    if (!source || srcW <= 0 || srcH <= 0) {
      await startCamera(facingMode, selectedDeviceId || undefined);
      return;
    }

    const { width: requestedW, height: requestedH } = getTargetDimensions(
      settings.resolution,
      settings.aspectRatio,
      srcW,
      srcH
    );

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }
    const capCanvas = captureCanvasRef.current;

    if (settings.flash === 'on' || (settings.flash === 'auto' && facingMode === 'user')) {
      setScreenFlashPulse(true);
      await new Promise((r) => setTimeout(r, 90));
    }

    playShutterClick(settings.soundEnabled);

    const isFront = facingMode === 'user';
    const backdropImg = backdropImagesRef.current[settings.backdrop] || null;

    const needSeg = settings.backgroundMode !== 'off';
    const needFace =
      settings.arOverlay !== 'none' &&
      settings.arOverlay !== 'camcorder' &&
      settings.arOverlay !== 'ankit-stamp';

    if ((needSeg && segmenterRef.current) || (needFace && faceDetectorRef.current)) {
      if (!aiInputCanvasRef.current) {
        aiInputCanvasRef.current = document.createElement('canvas');
      }
      const ready = prepareCroppedFrameCanvas(
        aiInputCanvasRef.current,
        source,
        srcW,
        srcH,
        settings.aspectRatio,
        settings.zoom,
        isFront && settings.mirrorFront
      );
      if (ready) {
        const ts = Math.max(lastVideoTimestampRef.current + 2, Math.round(performance.now()));
        lastVideoTimestampRef.current = ts;
        if (needSeg && segmenterRef.current) {
          const freshMask = runPersonSegmentationMask(
            segmenterRef.current,
            aiInputCanvasRef.current,
            ts,
            settings.bgSensitivity
          );
          if (freshMask) aiMaskRef.current = freshMask;
        }
        if (needFace && faceDetectorRef.current) {
          const nextTs = Math.max(lastVideoTimestampRef.current + 2, ts + 2);
          lastVideoTimestampRef.current = nextTs;
          trackedFaceRef.current = runLiveFaceDetection(
            faceDetectorRef.current,
            aiInputCanvasRef.current,
            nextTs,
            trackedFaceRef.current
          );
        }
      }
    }

    let actualW = requestedW;
    let actualH = requestedH;
    let blob: Blob | null = null;

    for (const scaleFactor of [1, 0.72, 0.5]) {
      actualW = Math.max(2, Math.round((requestedW * scaleFactor) / 2) * 2);
      actualH = Math.max(2, Math.round((requestedH * scaleFactor) / 2) * 2);
      capCanvas.width = actualW;
      capCanvas.height = actualH;

      renderCameraFrame({
        targetCanvas: capCanvas,
        source,
        sourceWidth: srcW,
        sourceHeight: srcH,
        isFrontCamera: isFront,
        settings,
        backdropImage: backdropImg,
        referenceBgPixels: referenceBgRef.current,
        sampledBgColor,
        arOffset,
        aiPersonMask: needSeg ? aiMaskRef.current : null,
        trackedFace: needFace ? trackedFaceRef.current : null,
        applySharpnessPass: true,
        timeMs: performance.now(),
      });

      blob = await canvasToJpegBlob(capCanvas, 0.94);
      if (blob && blob.size > 0) break;
    }

    if ((!blob || blob.size === 0) && previewCanvasRef.current) {
      actualW = previewCanvasRef.current.width;
      actualH = previewCanvasRef.current.height;
      blob = await canvasToJpegBlob(previewCanvasRef.current, 0.94);
    }

    setTimeout(() => setScreenFlashPulse(false), 180);
    if (!blob) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `HackerAnkit_${settings.resolution}_${stamp}.jpg`;

    const record: MediaItemRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'photo',
      filename,
      mimeType: 'image/jpeg',
      width: actualW,
      height: actualH,
      resolutionLabel: settings.resolution,
      aspectRatio: settings.aspectRatio,
      filterUsed: settings.filter,
      backgroundUsed: settings.backgroundMode === 'off' ? 'original' : settings.backdrop,
      sizeBytes: blob.size,
      createdAt: Date.now(),
      blob,
    };

    await persistCapture(
      record,
      `${settings.resolution} (${actualW}×${actualH}) saved to Gallery${
        settings.autoSaveDevice ? ' & Downloads' : ''
      }`
    );
  }, [
    arOffset,
    facingMode,
    getActiveVideoSource,
    persistCapture,
    sampledBgColor,
    selectedDeviceId,
    settings,
    startCamera,
  ]);

  const handlePhotoOrBurstTrigger = useCallback(async () => {
    if (isCapturing) return;

    const { source } = getActiveVideoSource();
    if (!source) {
      await startCamera(facingMode, selectedDeviceId || undefined);
      return;
    }

    const runCapture = async () => {
      setIsCapturing(true);
      try {
        if (settings.mode === 'burst') {
          for (let i = 0; i < 3; i++) {
            await executeSinglePhotoCapture();
            if (i < 2) await new Promise((r) => setTimeout(r, 260));
          }
        } else {
          await executeSinglePhotoCapture();
        }
      } finally {
        setIsCapturing(false);
      }
    };

    if (settings.timerSeconds > 0 && !isRecording) {
      let rem = settings.timerSeconds;
      setCountdownLeft(rem);
      playCountdownBeep(settings.soundEnabled, false);
      const timer = window.setInterval(() => {
        rem -= 1;
        if (rem <= 0) {
          window.clearInterval(timer);
          setCountdownLeft(null);
          playCountdownBeep(settings.soundEnabled, true);
          runCapture();
        } else {
          setCountdownLeft(rem);
          playCountdownBeep(settings.soundEnabled, false);
        }
      }, 1000);
      return;
    }

    await runCapture();
  }, [
    executeSinglePhotoCapture,
    facingMode,
    getActiveVideoSource,
    isCapturing,
    isRecording,
    selectedDeviceId,
    settings.mode,
    settings.soundEnabled,
    settings.timerSeconds,
    startCamera,
  ]);

  const stopVideoRecording = useCallback(() => {
    if (recordTimerIntervalRef.current) {
      window.clearInterval(recordTimerIntervalRef.current);
      recordTimerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    playRecordTone(settings.soundEnabled, false);
  }, [settings.soundEnabled]);

  const startVideoRecording = useCallback(async () => {
    const { source } = getActiveVideoSource();
    const canvas = previewCanvasRef.current;
    if (!source || !canvas) {
      await startCamera(facingMode, selectedDeviceId || undefined);
      return;
    }

    try {
      const videoStream = canvas.captureStream(30);
      const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          audioStreamRef.current = micStream;
          micStream.getAudioTracks().forEach((t) => combinedTracks.push(t));
        }
      } catch {
        // Proceed cleanly without mic if mic denied
      }

      const combinedStream = new MediaStream(combinedTracks);
      const isSafari =
        typeof navigator !== 'undefined' &&
        /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      // Chrome/Android/Desktop HTML5 <video> plays WebM VP8/VP9 seamlessly; Safari plays MP4 natively
      const candidateTypes = isSafari
        ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm']
        : [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4',
          ];

      const supportedMime =
        candidateTypes.find(
          (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
        ) || '';

      const bps = RESOLUTION_MAP[settings.resolution].bitrateMbps * 1_000_000;
      const recorder = new MediaRecorder(combinedStream, {
        ...(supportedMime ? { mimeType: supportedMime } : {}),
        videoBitsPerSecond: Math.min(bps, 8_000_000),
      });

      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      const startW = canvas.width;
      const startH = canvas.height;

      recorder.onstop = async () => {
        const finalMime = recorder.mimeType || supportedMime || 'video/webm';
        const isMp4 = finalMime.includes('mp4');
        const blob = new Blob(recordedChunksRef.current, { type: finalMime });
        recordedChunksRef.current = [];

        const totalSecs = Math.max(
          1,
          Math.round((performance.now() - recordStartMsRef.current - pausedDurationMsRef.current) / 1000)
        );
        setIsRecording(false);
        setIsRecordPaused(false);
        setRecordSeconds(0);

        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ext = isMp4 ? 'mp4' : 'webm';
        const filename = `HackerAnkit_Video_${settings.resolution}_${stamp}.${ext}`;

        const record: MediaItemRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: 'video',
          filename,
          mimeType: finalMime,
          width: startW,
          height: startH,
          resolutionLabel: settings.resolution,
          aspectRatio: settings.aspectRatio,
          filterUsed: settings.filter,
          backgroundUsed: settings.backgroundMode === 'off' ? 'original' : settings.backdrop,
          durationSeconds: totalSecs,
          sizeBytes: blob.size,
          createdAt: Date.now(),
          blob,
        };

        await persistCapture(
          record,
          `Video (${formatDurationClock(totalSecs)}) saved to Gallery${
            settings.autoSaveDevice ? ' & Downloads' : ''
          }`
        );
      };

      mediaRecorderRef.current = recorder;
      recordStartMsRef.current = performance.now();
      pausedDurationMsRef.current = 0;
      setRecordSeconds(0);
      setIsRecording(true);
      setIsRecordPaused(false);

      playRecordTone(settings.soundEnabled, true);
      recorder.start(500);

      recordTimerIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      // Ignore unsupported recorder
    }
  }, [facingMode, getActiveVideoSource, persistCapture, selectedDeviceId, settings, startCamera]);

  const togglePauseRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause();
      pauseStartMsRef.current = performance.now();
      setIsRecordPaused(true);
      if (recordTimerIntervalRef.current) {
        window.clearInterval(recordTimerIntervalRef.current);
        recordTimerIntervalRef.current = null;
      }
    } else if (rec.state === 'paused') {
      rec.resume();
      pausedDurationMsRef.current += performance.now() - pauseStartMsRef.current;
      setIsRecordPaused(false);
      recordTimerIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (recordTimerIntervalRef.current) window.clearInterval(recordTimerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code !== 'Space') return;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      ev.preventDefault();
      if (settings.mode === 'video') {
        if (isRecording) {
          stopVideoRecording();
        } else {
          startVideoRecording();
        }
      } else {
        handlePhotoOrBurstTrigger();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePhotoOrBurstTrigger, isRecording, settings.mode, startVideoRecording, stopVideoRecording]);

  const handleCalibrateRoomBackground = () => {
    const { source, width: srcW, height: srcH } = getActiveVideoSource();
    if (!source) return;
    const pixels = captureReferenceFramePixels(
      source,
      srcW,
      srcH,
      settings.aspectRatio,
      settings.zoom,
      facingMode === 'user' && settings.mirrorFront
    );
    if (pixels) {
      referenceBgRef.current = pixels;
      setBgCalibrated(true);
      onChangeSettings((prev) => ({ ...prev, backgroundMode: 'swap' }));
    }
  };

  const handleClearCalibration = () => {
    referenceBgRef.current = null;
    setBgCalibrated(false);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    if (settings.arOverlay !== 'none') {
      setIsDraggingAr(true);
      if (!trackedFaceRef.current?.detected) {
        setArOffset({ x: normX - 0.5, y: normY - 0.42 });
      }
      return;
    }

    if (settings.backgroundMode === 'swap' && !segmenterRef.current) {
      const { source, width: srcW, height: srcH } = getActiveVideoSource();
      if (source) {
        const picked = samplePixelColorFromSource(
          source,
          srcW,
          srcH,
          settings.aspectRatio,
          settings.zoom,
          facingMode === 'user' && settings.mirrorFront,
          normX,
          normY
        );
        if (picked) {
          referenceBgRef.current = null;
          setBgCalibrated(false);
          setSampledBgColor(picked);
        }
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingAr || settings.arOverlay === 'none') return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    setArOffset({
      x: Math.max(-0.4, Math.min(0.4, normX - 0.5)),
      y: Math.max(-0.35, Math.min(0.45, normY - 0.42)),
    });
  };

  const handleUploadCustomBackdrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      onChangeSettings((prev) => ({
        ...prev,
        backgroundMode: 'swap',
        backdrop: 'custom',
        customBackdropDataUrl: url,
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cycleGrid = () => {
    const order: GridMode[] = ['off', 'thirds', 'golden', 'crosshair'];
    const idx = order.indexOf(settings.grid);
    onChangeSettings((prev) => ({ ...prev, grid: order[(idx + 1) % order.length] }));
  };

  const cycleTimer = () => {
    const order: Array<0 | 3 | 5 | 10> = [0, 3, 5, 10];
    const idx = order.indexOf(settings.timerSeconds);
    onChangeSettings((prev) => ({ ...prev, timerSeconds: order[(idx + 1) % order.length] }));
  };

  const cycleFlash = () => {
    const order = ['off', 'on', 'auto'] as const;
    const idx = order.indexOf(settings.flash);
    onChangeSettings((prev) => ({ ...prev, flash: order[(idx + 1) % order.length] }));
  };

  const flipCamera = () => {
    setSelectedDeviceId('');
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const visibleFilters = useMemo(() => {
    if (filterCat === 'all') return FILTER_PRESETS;
    return FILTER_PRESETS.filter((f) => f.category === filterCat);
  }, [filterCat]);

  const visibleBackdrops = useMemo(() => {
    if (backdropCat === 'all') return BACKDROPS;
    return BACKDROPS.filter((b) => b.cat === backdropCat);
  }, [backdropCat]);

  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-4 py-2 sm:py-3">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="pointer-events-none fixed top-0 left-0 w-[2px] h-[2px] opacity-0"
      />
      <input
        ref={customBackdropInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadCustomBackdrop}
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-3 lg:gap-5 items-start">
        {/* Main Full-Screen Viewfinder Stage */}
        <div className="rounded-3xl bg-[#0D0F14] border border-white/10 overflow-hidden flex flex-col">
          {/* Top Compact Camera Toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 bg-[#090A0D] p-1 rounded-xl border border-white/10 shrink-0">
              {(['HD', '2K', '4K', '6K', '8K'] as ResolutionPreset[]).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => onChangeSettings((p) => ({ ...p, resolution: res }))}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold tabular-nums transition min-h-[32px] ${
                    settings.resolution === res
                      ? 'bg-[#F59E0B] text-[#090A0D]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onChangeSettings((p) => ({
                    ...p,
                    iphoneLook: p.iphoneLook === 'none' ? 'iphone-16-pro' : 'none',
                  }))
                }
                className={`min-h-[36px] px-2.5 inline-flex items-center gap-1 rounded-xl text-xs font-semibold transition ${
                  settings.iphoneLook !== 'none'
                    ? 'bg-[#F59E0B] text-[#090A0D]'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
                title="Toggle iPhone Pro Computational Optics"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeSettings((p) => ({ ...p, autoEnhance: !p.autoEnhance }))}
                className={`min-h-[36px] px-2.5 inline-flex items-center gap-1 rounded-xl text-xs font-semibold transition ${
                  settings.autoEnhance
                    ? 'bg-emerald-500 text-[#090A0D]'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
                title="Auto HD Clarity Enhancement"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>HD Fix</span>
              </button>

              <button
                type="button"
                onClick={cycleFlash}
                className={`min-h-[36px] min-w-[36px] px-2 inline-flex items-center gap-1 rounded-xl text-xs font-medium transition ${
                  settings.flash !== 'off'
                    ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
                title="Flash / Screen Fill Light"
              >
                {settings.flash === 'off' ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={cycleTimer}
                className={`min-h-[36px] min-w-[36px] px-2 inline-flex items-center gap-1 rounded-xl text-xs font-medium tabular-nums transition ${
                  settings.timerSeconds > 0
                    ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
                title="Self-timer"
              >
                <Timer className="w-4 h-4" />
                {settings.timerSeconds > 0 && <span>{settings.timerSeconds}s</span>}
              </button>

              <button
                type="button"
                onClick={cycleGrid}
                className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-xs font-medium transition ${
                  settings.grid !== 'off'
                    ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
                title={`Grid: ${settings.grid}`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onChangeSettings((p) => ({ ...p, soundEnabled: !p.soundEnabled }))}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 transition"
                title={settings.soundEnabled ? 'Mute shutter audio' : 'Unmute shutter audio'}
              >
                {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Full-Bleed Real Camera Viewport */}
          <div className="relative bg-black flex items-center justify-center h-[52vh] sm:h-[58vh] lg:h-[62vh] min-h-[280px] w-full overflow-hidden select-none">
            <canvas
              ref={previewCanvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={() => setIsDraggingAr(false)}
              onPointerLeave={() => setIsDraggingAr(false)}
              className={`touch-none cursor-crosshair ${
                settings.aspectRatio === 'full'
                  ? 'w-full h-full object-cover'
                  : 'max-h-full max-w-full w-auto h-auto'
              }`}
            />

            {cameraStatus !== 'live' && (
              <div className="absolute inset-0 bg-[#050507] flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/15 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-[#F59E0B]" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <p className="text-sm font-semibold text-white">
                    {cameraStatus === 'starting' ? 'Opening Camera Lens...' : 'Camera Access Required'}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {cameraStatus === 'starting'
                      ? 'Please allow camera permission in your browser.'
                      : 'Tap below to activate your real device camera.'}
                  </p>
                </div>
                {cameraStatus === 'blocked' && (
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode, selectedDeviceId || undefined)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-[#090A0D] hover:bg-[#fbbf24] transition min-h-[44px]"
                  >
                    <Camera className="w-4 h-4" />
                    Enable Camera
                  </button>
                )}
              </div>
            )}

            {cameraStatus === 'live' && settings.grid === 'thirds' && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <div key={idx} className="border border-white/15" />
                ))}
              </div>
            )}
            {cameraStatus === 'live' && settings.grid === 'golden' && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-y-0 left-[38.2%] w-px bg-amber-400/30" />
                <div className="absolute inset-y-0 right-[38.2%] w-px bg-amber-400/30" />
                <div className="absolute inset-x-0 top-[38.2%] h-px bg-amber-400/30" />
                <div className="absolute inset-x-0 bottom-[38.2%] h-px bg-amber-400/30" />
              </div>
            )}
            {cameraStatus === 'live' && settings.grid === 'crosshair' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-px bg-white/60" />
                <div className="h-10 w-px bg-white/60 absolute" />
              </div>
            )}

            {isRecording && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/80 backdrop-blur-md border border-red-500/40 px-3.5 py-1.5 text-xs font-semibold text-white tabular-nums">
                <span
                  className={`w-2.5 h-2.5 rounded-full bg-red-500 ${
                    isRecordPaused ? '' : 'animate-pulse'
                  }`}
                />
                <span>{isRecordPaused ? 'PAUSED' : 'REC'}</span>
                <span>{formatDurationClock(recordSeconds)}</span>
              </div>
            )}

            {countdownLeft !== null && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                <span className="text-7xl font-bold text-[#F59E0B] tabular-nums drop-shadow-lg">
                  {countdownLeft}
                </span>
              </div>
            )}

            {screenFlashPulse && (
              <div className="pointer-events-none fixed inset-0 z-50 bg-white/95 transition-opacity duration-150" />
            )}
          </div>

          {saveToast && (
            <div className="mx-3 sm:mx-4 my-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 px-3.5 py-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveToast.text}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  shareMediaFile(saveToast.item.blob, saveToast.item.filename, 'Hacker Ankit Camera')
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 text-[#090A0D] px-3 py-1.5 text-xs font-semibold hover:bg-emerald-300 transition min-h-[34px]"
              >
                <Share2 className="w-3.5 h-3.5" />
                Save to Photos / Story
              </button>
            </div>
          )}

          {/* Thumb-Zone Bottom Shutter Deck */}
          <div className="bg-[#0B0C10] border-t border-white/10 px-4 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 shrink-0">
                {(['full', '9:16', '3:4', '1:1', '16:9'] as AspectRatioPreset[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => onChangeSettings((p) => ({ ...p, aspectRatio: ratio }))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium uppercase transition min-h-[30px] ${
                      settings.aspectRatio === ratio
                        ? 'bg-white text-[#090A0D] font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {[1, 2, 4, 6].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => onChangeSettings((p) => ({ ...p, zoom: z }))}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold tabular-nums transition min-h-[30px] ${
                      Math.abs(settings.zoom - z) < 0.25
                        ? 'bg-[#F59E0B] text-[#090A0D]'
                        : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              {(['photo', 'video', 'burst'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={isRecording}
                  onClick={() => onChangeSettings((p) => ({ ...p, mode: m }))}
                  className={`text-xs font-semibold uppercase tracking-wide py-0.5 border-b-2 transition ${
                    settings.mode === m
                      ? 'text-[#F59E0B] border-[#F59E0B]'
                      : 'text-zinc-400 border-transparent hover:text-white'
                  } disabled:opacity-40`}
                >
                  {m === 'burst' ? 'Burst 3x' : m}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between max-w-md mx-auto">
              <button
                type="button"
                onClick={onOpenGallery}
                className="w-12 h-12 rounded-2xl bg-[#181B22] border border-white/15 overflow-hidden flex items-center justify-center hover:border-[#F59E0B] transition shrink-0"
                title="Open Offline Gallery"
              >
                {lastThumbnailUrl && lastItem?.kind === 'photo' ? (
                  <img src={lastThumbnailUrl} alt="Latest capture" className="w-full h-full object-cover" />
                ) : lastItem?.kind === 'video' ? (
                  <Film className="w-5 h-5 text-[#F59E0B]" />
                ) : (
                  <ImagePlus className="w-5 h-5 text-zinc-400" />
                )}
              </button>

              <div className="flex items-center gap-4">
                {isRecording && (
                  <button
                    type="button"
                    onClick={togglePauseRecording}
                    aria-label={isRecordPaused ? 'Resume recording' : 'Pause recording'}
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                  >
                    {isRecordPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </button>
                )}

                {settings.mode === 'video' ? (
                  <button
                    type="button"
                    onClick={isRecording ? stopVideoRecording : startVideoRecording}
                    aria-label={isRecording ? 'Stop video recording' : 'Start unlimited video recording'}
                    className="w-[70px] h-[70px] rounded-full border-4 border-white/90 p-1.5 flex items-center justify-center active:scale-95 transition"
                  >
                    {isRecording ? (
                      <span className="w-7 h-7 rounded-md bg-red-500 flex items-center justify-center">
                        <Square className="w-4 h-4 text-white fill-white" />
                      </span>
                    ) : (
                      <span className="w-full h-full rounded-full bg-red-500" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePhotoOrBurstTrigger}
                    disabled={isCapturing}
                    aria-label="Capture photo"
                    className="w-[70px] h-[70px] rounded-full border-4 border-white/90 p-1.5 flex items-center justify-center active:scale-95 transition disabled:opacity-60"
                  >
                    <span className="w-full h-full rounded-full bg-white hover:bg-[#F59E0B] transition-colors" />
                  </button>
                )}

                {isRecording && (
                  <button
                    type="button"
                    onClick={executeSinglePhotoCapture}
                    aria-label="Snap photo while recording"
                    title="Snap photo while recording"
                    className="w-12 h-12 rounded-full bg-white text-[#090A0D] hover:bg-[#F59E0B] flex items-center justify-center transition"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={flipCamera}
                aria-label="Switch Front / Rear Camera"
                title="Switch Front / Rear Camera"
                className="w-12 h-12 rounded-2xl bg-[#181B22] border border-white/15 flex items-center justify-center text-white hover:border-[#F59E0B] transition shrink-0"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Optical Control Panel */}
        <div className="rounded-3xl bg-[#12141A] border border-white/10 overflow-hidden flex flex-col lg:max-h-[calc(100dvh-76px)]">
          {/* 5 Segmented Control Tabs */}
          <div className="grid grid-cols-5 gap-1 p-1.5 bg-[#0B0C10] border-b border-white/10 shrink-0">
            {(
              [
                { id: 'filters', label: 'Filters', icon: Sparkles },
                { id: 'iphone', label: 'iPhone', icon: Smartphone },
                { id: 'background', label: 'Backdrop', icon: Layers },
                { id: 'lenses', label: 'Stickers', icon: Wand2 },
                { id: 'pro', label: 'Pro Fix', icon: Sliders },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSheet(id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl text-[11px] font-semibold transition min-h-[44px] ${
                  activeSheet === id
                    ? 'bg-[#F59E0B] text-[#090A0D]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate w-full text-center">{label}</span>
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4 overflow-y-auto">
            {activeSheet === 'filters' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">30 Pro Quality &amp; Color Lenses</h2>
                  <button
                    type="button"
                    onClick={() => onChangeSettings((p) => ({ ...p, filter: 'normal' }))}
                    className="text-xs text-[#F59E0B] hover:underline"
                  >
                    Reset
                  </button>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                  {(
                    [
                      { id: 'all', label: 'All (30)' },
                      { id: 'rescue', label: 'Quality Fix' },
                      { id: 'color', label: 'Color' },
                      { id: 'cinema', label: 'Cinema' },
                      { id: 'bw', label: 'B&W' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFilterCat(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
                        filterCat === cat.id
                          ? 'bg-white text-[#090A0D]'
                          : 'bg-[#090A0D] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {visibleFilters.map((preset) => {
                    const active = settings.filter === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onChangeSettings((p) => ({ ...p, filter: preset.id }))}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition min-h-[44px] ${
                          active
                            ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-white'
                            : 'bg-[#090A0D] border-white/10 text-zinc-300 hover:border-white/25'
                        }`}
                      >
                        <span
                          className="w-6 h-6 rounded-lg border border-white/20 shrink-0"
                          style={{ background: preset.swatch }}
                        />
                        <span className="text-xs font-medium truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSheet === 'iphone' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">iPhone Pro Computational Optics</h2>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSettings((p) => ({
                        ...p,
                        iphoneLook: 'iphone-16-pro',
                        iphoneAntiGlare: true,
                        iphoneNightDenoise: true,
                        iphoneAntiPixelate: true,
                      }))
                    }
                    className="text-xs text-[#F59E0B] hover:underline"
                  >
                    Default Pro
                  </button>
                </div>

                <div className="space-y-2 rounded-xl bg-[#090A0D] border border-white/10 p-3">
                  <label className="flex items-center justify-between gap-3 text-xs text-zinc-200 cursor-pointer min-h-[34px]">
                    <div>
                      <p className="font-semibold text-white">Anti-Glare Light Ignore</p>
                      <p className="text-[11px] text-zinc-400">
                        Tames bright room bulbs &amp; night flare automatically
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.iphoneAntiGlare}
                      onChange={(e) =>
                        onChangeSettings((p) => ({ ...p, iphoneAntiGlare: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#F59E0B] shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 text-xs text-zinc-200 cursor-pointer min-h-[34px]">
                    <div>
                      <p className="font-semibold text-white">Night Mode Clean Denoise</p>
                      <p className="text-[11px] text-zinc-400">
                        Reduces dark sensor noise while keeping face clear
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.iphoneNightDenoise}
                      onChange={(e) =>
                        onChangeSettings((p) => ({ ...p, iphoneNightDenoise: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#F59E0B] shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 text-xs text-zinc-200 cursor-pointer min-h-[34px]">
                    <div>
                      <p className="font-semibold text-white">Zero-Pixelation Deep Fusion</p>
                      <p className="text-[11px] text-zinc-400">
                        Sharpened edges so photos never break or pixelate
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.iphoneAntiPixelate}
                      onChange={(e) =>
                        onChangeSettings((p) => ({ ...p, iphoneAntiPixelate: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#F59E0B] shrink-0"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-400">Select iPhone Camera Style</p>
                  <div className="grid grid-cols-1 gap-2">
                    {IPHONE_LOOKS.map((look) => {
                      const active = settings.iphoneLook === look.id;
                      return (
                        <button
                          key={look.id}
                          type="button"
                          onClick={() => onChangeSettings((p) => ({ ...p, iphoneLook: look.id }))}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition min-h-[50px] ${
                            active
                              ? 'bg-[#F59E0B]/15 border-[#F59E0B] text-white'
                              : 'bg-[#090A0D] border-white/10 text-zinc-300 hover:border-white/25'
                          }`}
                        >
                          <span
                            className="w-8 h-8 rounded-lg border border-white/20 shrink-0"
                            style={{ background: look.swatch }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{look.name}</p>
                            <p className="text-[11px] text-zinc-400 truncate">{look.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeSheet === 'background' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-white">
                    AI Person-Only Background ({BACKDROPS.length} Scenes)
                  </h2>
                  <div className="grid grid-cols-3 gap-1.5 bg-[#090A0D] p-1 rounded-xl border border-white/10">
                    {(
                      [
                        { id: 'off', label: 'Original' },
                        { id: 'bokeh', label: 'Blur Bokeh' },
                        { id: 'swap', label: 'Swap BG' },
                      ] as Array<{ id: BackgroundMode; label: string }>
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onChangeSettings((p) => ({ ...p, backgroundMode: m.id }))}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold transition min-h-[38px] ${
                          settings.backgroundMode === m.id
                            ? 'bg-[#F59E0B] text-[#090A0D]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {settings.backgroundMode === 'bokeh' && (
                  <div className="space-y-2 rounded-xl bg-[#090A0D] border border-white/10 p-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300 font-medium">DSLR Portrait Bokeh Blur</span>
                      <span className="text-[#F59E0B] tabular-nums">{settings.bokehStrength}px</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={28}
                      value={settings.bokehStrength}
                      onChange={(e) =>
                        onChangeSettings((p) => ({ ...p, bokehStrength: Number(e.target.value) }))
                      }
                      className="w-full accent-[#F59E0B]"
                    />
                  </div>
                )}

                {settings.backgroundMode !== 'off' && (
                  <div className="space-y-1.5 rounded-xl bg-[#090A0D] border border-white/10 p-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300 font-medium">Person Cutout Edge Fit</span>
                      <span className="text-[#F59E0B] tabular-nums">{settings.bgSensitivity}</span>
                    </div>
                    <input
                      type="range"
                      min={12}
                      max={90}
                      value={settings.bgSensitivity}
                      onChange={(e) =>
                        onChangeSettings((p) => ({ ...p, bgSensitivity: Number(e.target.value) }))
                      }
                      className="w-full accent-[#F59E0B]"
                    />
                  </div>
                )}

                {settings.backgroundMode === 'swap' && (
                  <>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                        {(
                          [
                            { id: 'all', label: `All (${BACKDROPS.length})` },
                            { id: 'landmarks', label: 'Landmarks' },
                            { id: 'nature', label: 'Nature' },
                            { id: 'luxury', label: 'Studio/Ankit' },
                            { id: 'custom', label: 'Solid/Custom' },
                          ] as Array<{ id: BackdropCategory; label: string }>
                        ).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setBackdropCat(c.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
                              backdropCat === c.id
                                ? 'bg-white text-[#090A0D]'
                                : 'bg-[#090A0D] text-zinc-400 hover:text-white'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {visibleBackdrops.map((b) => {
                          const active = settings.backdrop === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                if (b.id === 'custom' && !settings.customBackdropDataUrl) {
                                  customBackdropInputRef.current?.click();
                                  return;
                                }
                                onChangeSettings((p) => ({ ...p, backdrop: b.id }));
                              }}
                              className={`rounded-xl border overflow-hidden text-left transition ${
                                active
                                  ? 'border-[#F59E0B] ring-1 ring-[#F59E0B]'
                                  : 'border-white/10 hover:border-white/25'
                              }`}
                            >
                              <div className="h-12 w-full bg-[#090A0D] flex items-center justify-center">
                                {b.preview ? (
                                  <img
                                    src={b.preview}
                                    alt={b.label}
                                    className="w-full h-full object-cover"
                                  />
                                ) : b.id === 'custom' && settings.customBackdropDataUrl ? (
                                  <img
                                    src={settings.customBackdropDataUrl}
                                    alt="Custom"
                                    className="w-full h-full object-cover"
                                  />
                                ) : b.color ? (
                                  <div className="w-full h-full" style={{ backgroundColor: b.color }} />
                                ) : (
                                  <Upload className="w-4 h-4 text-zinc-400" />
                                )}
                              </div>
                              <div className="px-1.5 py-1.5 text-[11px] font-medium text-zinc-200 truncate bg-[#0B0C10]">
                                {b.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {settings.backdrop === 'custom' && (
                        <button
                          type="button"
                          onClick={() => customBackdropInputRef.current?.click()}
                          className="w-full rounded-xl bg-white/10 hover:bg-white/15 py-2 text-xs font-medium text-white transition"
                        >
                          Change Custom Background Image
                        </button>
                      )}
                    </div>

                    <div className="rounded-xl bg-[#090A0D] border border-white/10 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-white">Optional Room Calibration</span>
                        <span
                          className="w-4 h-4 rounded border border-white/25 shrink-0"
                          style={{
                            backgroundColor: `rgb(${sampledBgColor.r},${sampledBgColor.g},${sampledBgColor.b})`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        AI cuts out ONLY your body cleanly with zero wall bleed. Optional calibration helps in very
                        low light.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCalibrateRoomBackground}
                          className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 text-white py-2 px-3 text-xs font-semibold transition min-h-[36px]"
                        >
                          {bgCalibrated ? 'Recalibrate Room BG' : 'Calibrate Room BG'}
                        </button>
                        {bgCalibrated && (
                          <button
                            type="button"
                            onClick={handleClearCalibration}
                            className="rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white px-3 py-2 min-h-[36px]"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeSheet === 'lenses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Head &amp; Hair-Top AR Stickers</h2>
                    <p className="text-[11px] text-zinc-400">
                      Sits cleanly above your hair and follows your head
                    </p>
                  </div>
                  {settings.arOverlay !== 'none' && (
                    <button
                      type="button"
                      onClick={() => setArOffset({ x: 0, y: 0 })}
                      className="text-xs text-[#F59E0B] hover:underline shrink-0"
                    >
                      Auto-Lock
                    </button>
                  )}
                </div>

                {/* Editable Name Above Hair + 5 Movement Animation Styles */}
                <div className="rounded-xl bg-[#090A0D] border border-[#F59E0B]/30 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Edit3 className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span>Name Over Hair (Edit Name)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeSettings((p) => ({
                          ...p,
                          arOverlay: p.arOverlay === 'name-crown' ? 'none' : 'name-crown',
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                        settings.arOverlay === 'name-crown'
                          ? 'bg-[#F59E0B] text-[#090A0D]'
                          : 'bg-white/10 text-zinc-200 hover:bg-white/15'
                      }`}
                    >
                      {settings.arOverlay === 'name-crown' ? 'Active on Head' : 'Show on Head'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={26}
                      value={settings.arCustomName}
                      onFocus={() =>
                        onChangeSettings((p) => ({ ...p, arOverlay: 'name-crown' }))
                      }
                      onChange={(e) =>
                        onChangeSettings((p) => ({
                          ...p,
                          arOverlay: 'name-crown',
                          arCustomName: e.target.value,
                        }))
                      }
                      placeholder="Type any name (e.g. Hacker Ankit)"
                      className="flex-1 rounded-xl bg-[#12141A] border border-white/15 px-3 py-2 text-xs text-white focus:border-[#F59E0B] focus:outline-none min-h-[38px]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChangeSettings((p) => ({
                          ...p,
                          arOverlay: 'name-crown',
                          arCustomName: 'Hacker Ankit',
                        }))
                      }
                      className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-medium text-zinc-200 shrink-0 min-h-[38px]"
                    >
                      Hacker Ankit
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] text-zinc-400">Name Movement / Animation Style</p>
                    <div className="flex flex-wrap gap-1.5">
                      {NAME_ANIMATIONS.map((anim) => (
                        <button
                          key={anim.id}
                          type="button"
                          onClick={() =>
                            onChangeSettings((p) => ({
                              ...p,
                              arOverlay: 'name-crown',
                              arNameAnimation: anim.id,
                            }))
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                            settings.arNameAnimation === anim.id
                              ? 'bg-[#F59E0B] text-[#090A0D]'
                              : 'bg-[#12141A] border border-white/10 text-zinc-300 hover:border-white/25'
                          }`}
                        >
                          {anim.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {AR_OVERLAYS.map((ov) => (
                    <button
                      key={ov.id}
                      type="button"
                      onClick={() => {
                        setArOffset({ x: 0, y: 0 });
                        onChangeSettings((p) => ({ ...p, arOverlay: ov.id }));
                      }}
                      className={`px-3 py-2.5 rounded-xl border text-left transition min-h-[48px] ${
                        settings.arOverlay === ov.id
                          ? 'bg-[#F59E0B] text-[#090A0D] border-[#F59E0B]'
                          : 'bg-[#090A0D] border-white/10 text-zinc-300 hover:border-white/25'
                      }`}
                    >
                      <p className="text-xs font-semibold truncate">{ov.label}</p>
                      {ov.badge && (
                        <p
                          className={`text-[10px] ${
                            settings.arOverlay === ov.id ? 'text-[#090A0D]/80' : 'text-zinc-500'
                          }`}
                        >
                          {ov.badge}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSheet === 'pro' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">Weak Camera Rescue &amp; Pro Optics</h2>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSettings((p) => ({
                        ...p,
                        autoEnhance: true,
                        exposure: 104,
                        contrast: 106,
                        saturation: 110,
                        warmth: 0,
                        shadows: 18,
                        beauty: 22,
                        sharpness: 50,
                        zoom: 1,
                      }))
                    }
                    className="text-xs text-[#F59E0B] hover:underline"
                  >
                    Reset Optics
                  </button>
                </div>

                <div className="rounded-xl bg-[#090A0D] border border-white/10 p-3">
                  <label className="flex items-center justify-between text-xs font-medium text-white cursor-pointer min-h-[32px]">
                    <span>Auto HD Clarity Rescue</span>
                    <input
                      type="checkbox"
                      checked={settings.autoEnhance}
                      onChange={(e) =>
                        onChangeSettings((p) => ({ ...p, autoEnhance: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#F59E0B]"
                    />
                  </label>
                </div>

                <div className="space-y-2.5 rounded-xl bg-[#090A0D] border border-white/10 p-3.5">
                  {[
                    { key: 'zoom', label: 'Optical / Digital Zoom', min: 1, max: 8, step: 0.1, suffix: 'x' },
                    { key: 'shadows', label: 'Shadow & Dark Lift', min: 0, max: 60, step: 1, suffix: '%' },
                    { key: 'warmth', label: 'White Balance Temp', min: -50, max: 50, step: 1, suffix: '' },
                    { key: 'exposure', label: 'Exposure', min: 60, max: 160, step: 1, suffix: '%' },
                    { key: 'contrast', label: 'Contrast', min: 70, max: 160, step: 1, suffix: '%' },
                    { key: 'saturation', label: 'Color Vibrance', min: 50, max: 170, step: 1, suffix: '%' },
                    { key: 'beauty', label: 'Skin Smooth Glow', min: 0, max: 100, step: 1, suffix: '%' },
                    { key: 'sharpness', label: '8K Detail Sharpness', min: 0, max: 100, step: 5, suffix: '%' },
                  ].map((slider) => {
                    const val = settings[slider.key as keyof CameraSettings] as number;
                    return (
                      <div key={slider.key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-300">{slider.label}</span>
                          <span className="text-[#F59E0B] tabular-nums">
                            {slider.step < 1 ? val.toFixed(1) : val}
                            {slider.suffix}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={slider.min}
                          max={slider.max}
                          step={slider.step}
                          value={val}
                          onChange={(e) =>
                            onChangeSettings((p) => ({
                              ...p,
                              [slider.key]: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-[#F59E0B]"
                        />
                      </div>
                    );
                  })}
                </div>

                {devices.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-400">Select Camera Lens</label>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="w-full rounded-xl bg-[#090A0D] border border-white/10 px-3 py-2 text-xs text-white min-h-[40px]"
                    >
                      <option value="">Auto ({facingMode === 'user' ? 'Front' : 'Rear'})</option>
                      {devices.map((d, i) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera Lens ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2 rounded-xl bg-[#090A0D] border border-white/10 p-3.5">
                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer min-h-[34px]">
                    <span>Auto-Save directly to Device Downloads</span>
                    <input
                      type="checkbox"
                      checked={settings.autoSaveDevice}
                      onChange={(e) =>
                        onChangeSettings((p) => ({ ...p, autoSaveDevice: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#F59E0B]"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs text-zinc-200 cursor-pointer min-h-[34px]">
                    <span>Mirror Front Selfie Camera</span>
                    <input
                      type="checkbox"
                      checked={settings.mirrorFront}
                      onChange={(e) =>
                        onChangeSettings((p) => ({ ...p, mirrorFront: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#F59E0B]"
                    />
                  </label>

                  {supportsFolderPicker && (
                    <button
                      type="button"
                      onClick={onPickFolder}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 py-2.5 text-xs font-semibold text-white transition min-h-[40px]"
                    >
                      <FolderSync className="w-4 h-4 text-[#F59E0B]" />
                      {linkedFolder ? `Linked: ${linkedFolder.name}` : 'Link Pictures Folder'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
