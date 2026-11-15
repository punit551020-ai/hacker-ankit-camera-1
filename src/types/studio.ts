export type AspectRatioMode = '16:9' | '9:16';

export type TransitionStyle = 'whip-pan' | 'zoom-punch' | 'slide-up' | 'focus-pull';

export type ReelPresetId = 'clock-app' | 'calculator-app' | 'dual-suite';

export type MusicStyle =
  | 'slow-mo-2026'
  | 'silent'
  | 'custom'
  | 'cyberpunk-anthem'
  | 'phonk-drive'
  | 'trailer-score';

export interface ReelScene {
  id: string;
  title: string;
  kicker: string;
  caption: string;
  subCaption: string;
  voiceLine?: string;
  imageUrl: string;
  weight: number;
  cameraMotion: 'dolly-in' | 'pan-right' | 'orbit-zoom' | 'pull-back' | 'portrait-push';
  transition: TransitionStyle;
  isOpening?: boolean;
  isFinale?: boolean;
  isAppFrame?: boolean;
  tapAt?: { x: number; y: number; label?: string };
  demoOverlay?: 'none' | 'clock-24h' | 'voice-alarm-examples' | 'chrome-install';
  liveAnimation?:
    | 'none'
    | 'world-clock-tick'
    | 'stopwatch-tick'
    | 'timer-tick'
    | 'focus-tick'
    | 'alarm-type'
    | 'chrome-search-flow';
}

export interface ReelConfig {
  reelPreset: ReelPresetId;
  creatorName: string;
  creatorRole: string;
  appTitle: string;
  appDownloadUrl: string;
  durationSeconds: 20 | 25 | 30;
  aspectRatio: AspectRatioMode;
  audioEnabled: boolean;
  musicStyle: MusicStyle;
  musicVolume: number;
  customAudioUrl: string | null;
  customAudioName: string | null;
  voiceoverEnabled: boolean;
  voiceGender: 'female' | 'male';
  voiceVolume: number;
  voiceoverAudioUrl: string | null;
  voiceoverAudioName: string | null;
  voiceoverScript: string;
  hackerHudEnabled: boolean;
  captionPreset: 'hinglish' | 'english';
}

export interface GeneratedVideoClip {
  id: string;
  interactionId: string;
  videoUrl: string;
  mimeType: string;
  aspectRatio: AspectRatioMode;
  duration: string;
  resolution: string;
  prompt: string;
  createdAt: string;
}
