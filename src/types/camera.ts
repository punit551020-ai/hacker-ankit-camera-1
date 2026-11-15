export type ResolutionPreset = 'HD' | '2K' | '4K' | '6K' | '8K';

export type AspectRatioPreset = 'full' | '9:16' | '3:4' | '1:1' | '16:9';

export type CaptureMode = 'photo' | 'video' | 'burst';

export type FilterPresetId =
  | 'normal'
  | 'dslr-clarity'
  | 'low-light-rescue'
  | 'pure-white'
  | 'skin-clear'
  | 'hdr-vivid'
  | 'bw-noir'
  | 'bw-matte'
  | 'warm-golden'
  | 'cyber-teal'
  | 'vintage-90s'
  | 'midnight-cyber'
  | 'ice-cool'
  | 'emerald-forest'
  | 'rose-gold'
  | 'velvet-mocha'
  | 'neon-tokyo'
  | 'sun-kissed'
  | 'crisp-daylight'
  | 'sepia-heritage'
  | 'fade-pastel'
  | 'moody-darkroom'
  | 'vivid-pop'
  | 'night-vision'
  | 'golden-cinema'
  | 'soft-peach'
  | 'deep-ocean'
  | 'royal-amber'
  | 'clean-matte'
  | 'chrome-silver';

export type IphoneLookId =
  | 'none'
  | 'iphone-16-pro'
  | 'iphone-smart-hdr'
  | 'iphone-night-mode'
  | 'iphone-anti-glare'
  | 'iphone-vivid'
  | 'iphone-rich-contrast'
  | 'iphone-warm-gold'
  | 'iphone-cool-crisp'
  | 'iphone-studio-light'
  | 'iphone-stage-mono'
  | 'iphone-deep-fusion'
  | 'iphone-proraw';

export type BackgroundMode = 'off' | 'bokeh' | 'swap';

export type BackgroundBackdropId =
  | 'black'
  | 'white'
  | 'hacker-ankit'
  | 'burj-khalifa'
  | 'waterfall'
  | 'temple'
  | 'famous-statue'
  | 'google-campus'
  | 'ocean-sunrise'
  | 'water-park'
  | 'botanical-park'
  | 'taj-mahal'
  | 'high-peak'
  | 'eiffel-paris'
  | 'grand-villa'
  | 'supercar-garage'
  | 'space-earth'
  | 'royal-palace'
  | 'concert-stage'
  | 'neon-city'
  | 'bamboo-garden'
  | 'night-stadium'
  | 'luxury-house'
  | 'green-forest'
  | 'city-bridge'
  | 'city-skyline'
  | 'modern-room'
  | 'luxury-interior'
  | 'tropical-beach'
  | 'sakura-garden'
  | 'snow-peaks'
  | 'sunset'
  | 'mountain'
  | 'studio'
  | 'custom';

export type ArOverlayId =
  | 'none'
  | 'name-crown'
  | 'hearts'
  | 'halo'
  | 'crown'
  | 'glasses'
  | 'cat-ears'
  | 'butterfly-crown'
  | 'fire-aura'
  | 'sparkles'
  | 'camcorder'
  | 'ankit-stamp';

export type NameAnimationStyle = 'float' | 'static' | 'glide' | 'orbit' | 'pulse';

export type GridMode = 'off' | 'thirds' | 'golden' | 'crosshair';

export type FlashMode = 'off' | 'on' | 'auto';

export interface CameraSettings {
  mode: CaptureMode;
  resolution: ResolutionPreset;
  aspectRatio: AspectRatioPreset;
  filter: FilterPresetId;
  iphoneLook: IphoneLookId;
  iphoneAntiGlare: boolean;
  iphoneNightDenoise: boolean;
  iphoneAntiPixelate: boolean;
  backgroundMode: BackgroundMode;
  backdrop: BackgroundBackdropId;
  customBackdropDataUrl: string | null;
  bgSensitivity: number;
  bgFeather: number;
  bokehStrength: number;
  arOverlay: ArOverlayId;
  arCustomName: string;
  arNameAnimation: NameAnimationStyle;
  autoEnhance: boolean;
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
  shadows: number;
  beauty: number;
  sharpness: number;
  zoom: number;
  mirrorFront: boolean;
  grid: GridMode;
  timerSeconds: 0 | 3 | 5 | 10;
  flash: FlashMode;
  soundEnabled: boolean;
  autoSaveDevice: boolean;
}

export interface MediaItemRecord {
  id: string;
  kind: 'photo' | 'video';
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  resolutionLabel: ResolutionPreset;
  aspectRatio: AspectRatioPreset;
  filterUsed: FilterPresetId;
  backgroundUsed: string;
  durationSeconds?: number;
  sizeBytes: number;
  createdAt: number;
  blob: Blob;
}

export interface FilterDefinition {
  id: FilterPresetId;
  name: string;
  category: 'rescue' | 'color' | 'bw' | 'cinema';
  swatch: string;
  cssFilter: string;
  overlayColor?: string;
  shadowBoost?: number;
  vignette?: number;
}

export interface IphoneLookDefinition {
  id: IphoneLookId;
  name: string;
  subtitle: string;
  swatch: string;
  cssFilter: string;
  overlayColor?: string;
  shadowBoost?: number;
  highlightTame?: number;
  sharpBoost?: number;
  vignette?: number;
}

export const RESOLUTION_MAP: Record<
  ResolutionPreset,
  { longEdge: number; shortEdge: number; label: string; bitrateMbps: number }
> = {
  HD: { longEdge: 1920, shortEdge: 1080, label: '1080p HD', bitrateMbps: 6 },
  '2K': { longEdge: 2560, shortEdge: 1440, label: '2K QHD', bitrateMbps: 7 },
  '4K': { longEdge: 3840, shortEdge: 2160, label: '4K UHD', bitrateMbps: 8 },
  '6K': { longEdge: 6144, shortEdge: 3456, label: '6K Cinema', bitrateMbps: 9 },
  '8K': { longEdge: 7680, shortEdge: 4320, label: '8K Master', bitrateMbps: 10 },
};

export const IPHONE_LOOKS: IphoneLookDefinition[] = [
  {
    id: 'none',
    name: 'Off (Standard)',
    subtitle: 'Use regular color filters',
    swatch: 'linear-gradient(135deg, #27272a 0%, #52525b 100%)',
    cssFilter: 'none',
  },
  {
    id: 'iphone-16-pro',
    name: 'iPhone 16 Pro Natural',
    subtitle: 'True-to-life flagship tone & sharp focus',
    swatch: 'linear-gradient(135deg, #f59e0b 0%, #f8fafc 100%)',
    cssFilter: 'contrast(112%) saturate(114%) brightness(106%)',
    shadowBoost: 0.16,
    highlightTame: 0.14,
    sharpBoost: 0.2,
  },
  {
    id: 'iphone-smart-hdr',
    name: 'Smart HDR 5',
    subtitle: 'Balances bright sky/bulbs & dark faces',
    swatch: 'linear-gradient(135deg, #38bdf8 0%, #fbbf24 100%)',
    cssFilter: 'contrast(116%) saturate(122%) brightness(105%)',
    shadowBoost: 0.24,
    highlightTame: 0.22,
    sharpBoost: 0.22,
  },
  {
    id: 'iphone-night-mode',
    name: 'iPhone Night Mode',
    subtitle: 'Brightens dark scenes cleanly without grain',
    swatch: 'linear-gradient(135deg, #0f172a 0%, #fbbf24 100%)',
    cssFilter: 'brightness(134%) contrast(114%) saturate(112%)',
    shadowBoost: 0.28,
    highlightTame: 0.16,
    sharpBoost: 0.16,
  },
  {
    id: 'iphone-anti-glare',
    name: 'Anti-Glare Light Fix',
    subtitle: 'Tames harsh indoor lights & bulb glare',
    swatch: 'linear-gradient(135deg, #e2e8f0 0%, #475569 100%)',
    cssFilter: 'brightness(98%) contrast(116%) saturate(108%)',
    shadowBoost: 0.18,
    highlightTame: 0.3,
    sharpBoost: 0.2,
  },
  {
    id: 'iphone-vivid',
    name: 'Photographic Vivid',
    subtitle: 'Punchy Apple color clarity for Reels',
    swatch: 'linear-gradient(135deg, #ef4444 0%, #3b82f6 100%)',
    cssFilter: 'contrast(118%) saturate(134%) brightness(108%)',
    shadowBoost: 0.14,
    highlightTame: 0.12,
    sharpBoost: 0.22,
  },
  {
    id: 'iphone-rich-contrast',
    name: 'Rich Contrast',
    subtitle: 'Deep blacks & crisp vibrant subjects',
    swatch: 'linear-gradient(135deg, #09090b 0%, #f97316 100%)',
    cssFilter: 'contrast(126%) saturate(118%) brightness(103%)',
    highlightTame: 0.16,
    sharpBoost: 0.22,
    vignette: 0.16,
  },
  {
    id: 'iphone-warm-gold',
    name: 'Warm Golden Portrait',
    subtitle: 'Flattering Apple sunlit skin glow',
    swatch: 'linear-gradient(135deg, #fb923c 0%, #fef08a 100%)',
    cssFilter: 'sepia(14%) saturate(120%) brightness(108%) contrast(108%)',
    overlayColor: 'rgba(251, 191, 36, 0.08)',
    shadowBoost: 0.14,
    sharpBoost: 0.18,
  },
  {
    id: 'iphone-cool-crisp',
    name: 'Cool Crisp Lens',
    subtitle: 'Clean daylight clarity & zero yellow tint',
    swatch: 'linear-gradient(135deg, #bae6fd 0%, #64748b 100%)',
    cssFilter: 'brightness(108%) contrast(114%) saturate(106%) hue-rotate(4deg)',
    overlayColor: 'rgba(186, 230, 253, 0.06)',
    sharpBoost: 0.22,
  },
  {
    id: 'iphone-studio-light',
    name: 'Portrait Studio Light',
    subtitle: 'Illuminates face like a studio key light',
    swatch: 'linear-gradient(135deg, #fff1f2 0%, #fda4af 100%)',
    cssFilter: 'brightness(114%) contrast(108%) saturate(110%)',
    shadowBoost: 0.2,
    highlightTame: 0.15,
    sharpBoost: 0.2,
    vignette: 0.22,
  },
  {
    id: 'iphone-stage-mono',
    name: 'Stage Light Mono',
    subtitle: 'High-contrast silver monochrome portrait',
    swatch: 'linear-gradient(135deg, #000000 0%, #d4d4d8 100%)',
    cssFilter: 'grayscale(100%) contrast(138%) brightness(108%)',
    vignette: 0.42,
    sharpBoost: 0.24,
  },
  {
    id: 'iphone-deep-fusion',
    name: 'Deep Fusion 8K Sharp',
    subtitle: 'Zero blur, rescues soft/blurry webcams',
    swatch: 'linear-gradient(135deg, #06b6d4 0%, #f59e0b 100%)',
    cssFilter: 'contrast(120%) saturate(116%) brightness(107%)',
    shadowBoost: 0.16,
    highlightTame: 0.16,
    sharpBoost: 0.34,
  },
  {
    id: 'iphone-proraw',
    name: 'Apple ProRAW Clean',
    subtitle: 'Flat wide dynamic range with high detail',
    swatch: 'linear-gradient(135deg, #a1a1aa 0%, #27272a 100%)',
    cssFilter: 'contrast(104%) saturate(106%) brightness(108%)',
    shadowBoost: 0.22,
    highlightTame: 0.24,
    sharpBoost: 0.24,
  },
];

export const FILTER_PRESETS: FilterDefinition[] = [
  {
    id: 'normal',
    name: 'True Tone',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #f59e0b 0%, #3b82f6 100%)',
    cssFilter: 'none',
  },
  {
    id: 'dslr-clarity',
    name: 'DSLR Clarity',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #0ea5e9 0%, #f59e0b 100%)',
    cssFilter: 'contrast(118%) saturate(116%) brightness(106%)',
    shadowBoost: 0.12,
  },
  {
    id: 'low-light-rescue',
    name: 'Low-Light Fix',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #fbbf24 0%, #1e293b 100%)',
    cssFilter: 'brightness(138%) contrast(112%) saturate(114%)',
    shadowBoost: 0.24,
  },
  {
    id: 'pure-white',
    name: 'Pure White',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #ffffff 0%, #d4d4d8 100%)',
    cssFilter: 'brightness(122%) contrast(108%) saturate(88%)',
    overlayColor: 'rgba(255,255,255,0.09)',
  },
  {
    id: 'skin-clear',
    name: 'Skin Glow Pro',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #fecdd3 0%, #fde68a 100%)',
    cssFilter: 'brightness(112%) contrast(98%) saturate(112%)',
    overlayColor: 'rgba(255, 232, 224, 0.1)',
    shadowBoost: 0.1,
  },
  {
    id: 'hdr-vivid',
    name: 'HDR Ultra',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #16a34a 0%, #2563eb 100%)',
    cssFilter: 'contrast(126%) saturate(138%) brightness(104%)',
    shadowBoost: 0.14,
  },
  {
    id: 'crisp-daylight',
    name: 'Crisp Daylight',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #bae6fd 0%, #fef08a 100%)',
    cssFilter: 'brightness(110%) contrast(114%) saturate(118%)',
  },
  {
    id: 'night-vision',
    name: 'Night Clarity',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #10b981 0%, #022c22 100%)',
    cssFilter: 'brightness(144%) contrast(126%) saturate(110%) hue-rotate(42deg)',
    overlayColor: 'rgba(16, 185, 129, 0.1)',
    shadowBoost: 0.25,
  },
  {
    id: 'clean-matte',
    name: 'Clean Matte HD',
    category: 'rescue',
    swatch: 'linear-gradient(135deg, #d6d3d1 0%, #57534e 100%)',
    cssFilter: 'brightness(108%) contrast(104%) saturate(102%)',
    shadowBoost: 0.14,
  },
  {
    id: 'bw-noir',
    name: 'B&W Leica Noir',
    category: 'bw',
    swatch: 'linear-gradient(135deg, #09090b 0%, #e4e4e7 100%)',
    cssFilter: 'grayscale(100%) contrast(134%) brightness(104%)',
    vignette: 0.36,
  },
  {
    id: 'bw-matte',
    name: 'B&W Soft Matte',
    category: 'bw',
    swatch: 'linear-gradient(135deg, #3f3f46 0%, #f4f4f5 100%)',
    cssFilter: 'grayscale(100%) contrast(106%) brightness(112%)',
    vignette: 0.18,
  },
  {
    id: 'chrome-silver',
    name: 'Chrome Silver',
    category: 'bw',
    swatch: 'linear-gradient(135deg, #e4e4e7 0%, #18181b 100%)',
    cssFilter: 'grayscale(85%) contrast(130%) brightness(108%)',
    vignette: 0.2,
  },
  {
    id: 'sepia-heritage',
    name: 'Classic Bronze',
    category: 'bw',
    swatch: 'linear-gradient(135deg, #92400e 0%, #d6d3d1 100%)',
    cssFilter: 'sepia(76%) contrast(116%) brightness(104%)',
    vignette: 0.28,
  },
  {
    id: 'warm-golden',
    name: 'Golden Sunset',
    category: 'color',
    swatch: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    cssFilter: 'sepia(24%) saturate(134%) brightness(106%) contrast(108%)',
    overlayColor: 'rgba(251, 146, 60, 0.12)',
  },
  {
    id: 'ice-cool',
    name: 'Arctic Blue',
    category: 'color',
    swatch: 'linear-gradient(135deg, #38bdf8 0%, #1e293b 100%)',
    cssFilter: 'saturate(96%) brightness(108%) contrast(110%) hue-rotate(10deg)',
    overlayColor: 'rgba(56, 189, 248, 0.1)',
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Tone',
    category: 'color',
    swatch: 'linear-gradient(135deg, #059669 0%, #14532d 100%)',
    cssFilter: 'contrast(114%) saturate(120%) brightness(104%) hue-rotate(-6deg)',
    overlayColor: 'rgba(16, 185, 129, 0.08)',
  },
  {
    id: 'rose-gold',
    name: 'Rose Portrait',
    category: 'color',
    swatch: 'linear-gradient(135deg, #f43f5e 0%, #fbbf24 100%)',
    cssFilter: 'brightness(110%) saturate(118%) contrast(102%) sepia(12%)',
    overlayColor: 'rgba(251, 113, 133, 0.1)',
  },
  {
    id: 'sun-kissed',
    name: 'Sun-Kissed',
    category: 'color',
    swatch: 'linear-gradient(135deg, #fb923c 0%, #fef08a 100%)',
    cssFilter: 'brightness(112%) saturate(128%) contrast(104%) sepia(14%)',
    overlayColor: 'rgba(253, 186, 116, 0.11)',
  },
  {
    id: 'fade-pastel',
    name: 'Airy Pastel',
    category: 'color',
    swatch: 'linear-gradient(135deg, #e0f2fe 0%, #fce7f3 100%)',
    cssFilter: 'brightness(116%) contrast(92%) saturate(106%)',
    overlayColor: 'rgba(255, 255, 255, 0.08)',
  },
  {
    id: 'vivid-pop',
    name: 'Story Pop 4K',
    category: 'color',
    swatch: 'linear-gradient(135deg, #ef4444 0%, #eab308 100%)',
    cssFilter: 'contrast(120%) saturate(154%) brightness(108%)',
    shadowBoost: 0.1,
  },
  {
    id: 'soft-peach',
    name: 'Soft Peach',
    category: 'color',
    swatch: 'linear-gradient(135deg, #fed7aa 0%, #fda4af 100%)',
    cssFilter: 'brightness(110%) saturate(118%) contrast(102%)',
    overlayColor: 'rgba(253, 186, 116, 0.1)',
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    category: 'color',
    swatch: 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)',
    cssFilter: 'contrast(120%) saturate(124%) hue-rotate(12deg)',
    overlayColor: 'rgba(14, 165, 233, 0.08)',
  },
  {
    id: 'royal-amber',
    name: 'Royal Amber',
    category: 'color',
    swatch: 'linear-gradient(135deg, #d97706 0%, #451a03 100%)',
    cssFilter: 'sepia(28%) contrast(120%) saturate(132%)',
    vignette: 0.2,
  },
  {
    id: 'cyber-teal',
    name: 'Teal & Orange',
    category: 'cinema',
    swatch: 'linear-gradient(135deg, #0d9488 0%, #f97316 100%)',
    cssFilter: 'contrast(120%) saturate(126%) hue-rotate(-10deg)',
    overlayColor: 'rgba(13, 148, 136, 0.11)',
    vignette: 0.25,
  },
  {
    id: 'vintage-90s',
    name: '90s Analog Film',
    category: 'cinema',
    swatch: 'linear-gradient(135deg, #a16207 0%, #57534e 100%)',
    cssFilter: 'sepia(32%) contrast(96%) brightness(106%) saturate(92%)',
    overlayColor: 'rgba(217, 119, 6, 0.09)',
    vignette: 0.3,
  },
  {
    id: 'midnight-cyber',
    name: 'Midnight Pro',
    category: 'cinema',
    swatch: 'linear-gradient(135deg, #1d4ed8 0%, #09090b 100%)',
    cssFilter: 'contrast(124%) saturate(122%) brightness(98%) hue-rotate(8deg)',
    overlayColor: 'rgba(30, 64, 175, 0.1)',
    vignette: 0.34,
  },
  {
    id: 'velvet-mocha',
    name: 'Velvet Mocha',
    category: 'cinema',
    swatch: 'linear-gradient(135deg, #78350f 0%, #27272a 100%)',
    cssFilter: 'sepia(38%) contrast(114%) brightness(102%) saturate(105%)',
    overlayColor: 'rgba(120, 53, 15, 0.1)',
    vignette: 0.24,
  },
  {
    id: 'neon-tokyo',
    name: 'Street Vibrant',
    category: 'cinema',
    swatch: 'linear-gradient(135deg, #ec4899 0%, #06b6d4 100%)',
    cssFilter: 'contrast(130%) saturate(148%) brightness(104%)',
    vignette: 0.22,
  },
  {
    id: 'moody-darkroom',
    name: 'Moody Studio',
    category: 'cinema',
    swatch: 'linear-gradient(135deg, #18181b 0%, #b45309 100%)',
    cssFilter: 'contrast(132%) brightness(94%) saturate(96%)',
    vignette: 0.45,
  },
  {
    id: 'golden-cinema',
    name: 'Anamorphic Gold',
    category: 'cinema',
    swatch: 'linear-gradient(135deg, #ca8a04 0%, #1c1917 100%)',
    cssFilter: 'contrast(124%) saturate(126%) sepia(18%)',
    vignette: 0.28,
  },
];

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  mode: 'photo',
  resolution: '4K',
  aspectRatio: 'full',
  filter: 'normal',
  iphoneLook: 'iphone-16-pro',
  iphoneAntiGlare: true,
  iphoneNightDenoise: true,
  iphoneAntiPixelate: true,
  backgroundMode: 'off',
  backdrop: 'burj-khalifa',
  customBackdropDataUrl: null,
  bgSensitivity: 44,
  bgFeather: 14,
  bokehStrength: 14,
  arOverlay: 'none',
  arCustomName: 'Hacker Ankit',
  arNameAnimation: 'float',
  autoEnhance: true,
  exposure: 104,
  contrast: 106,
  saturation: 110,
  warmth: 0,
  shadows: 18,
  beauty: 22,
  sharpness: 50,
  zoom: 1,
  mirrorFront: true,
  grid: 'off',
  timerSeconds: 0,
  flash: 'off',
  soundEnabled: true,
  autoSaveDevice: true,
};

export function getTargetDimensions(
  resolution: ResolutionPreset,
  aspectRatio: AspectRatioPreset,
  sourceWidth: number,
  sourceHeight: number
): { width: number; height: number } {
  const { longEdge, shortEdge } = RESOLUTION_MAP[resolution];
  const roundEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);

  switch (aspectRatio) {
    case '9:16':
      return { width: shortEdge, height: longEdge };
    case '16:9':
      return { width: longEdge, height: shortEdge };
    case '3:4': {
      const w = roundEven(longEdge * (3 / 4));
      return { width: w, height: longEdge };
    }
    case '1:1': {
      const side = roundEven((longEdge + shortEdge) * 0.55);
      return { width: side, height: side };
    }
    case 'full':
    default: {
      const ratio = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
      if (ratio >= 1) {
        return { width: longEdge, height: roundEven(longEdge / ratio) };
      }
      return { width: roundEven(longEdge * ratio), height: longEdge };
    }
  }
}
