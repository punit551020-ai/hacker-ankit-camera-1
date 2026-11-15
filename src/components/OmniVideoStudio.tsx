import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  Film,
  Loader2,
  MessageCircle,
  Plus,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { AspectRatioMode, GeneratedVideoClip } from '../types/studio';
import { STUDIO_ASSETS } from '../data/defaultReel';

interface UploadedImageData {
  id: string;
  label: string;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

const MOTION_PRESETS = [
  {
    label: 'Pro Editor Dolly & Laptop Focus',
    prompt:
      'Commercial-grade cinematography: fast ease-out dolly-in toward the glowing code screen and laptop keyboard, shallow Leica depth-of-field rack focus, moody tungsten rim light, subtle film grain, seamless human-edited motion.',
  },
  {
    label: 'App Showcase Parallax Orbit',
    prompt:
      'High-end tech launch film: smooth orbital camera sweep over the mobile app screens, crisp specular light glint sliding across the glass UI, dramatic dark studio backdrop, ultra-sharp commercial product motion.',
  },
  {
    label: 'Hacker Ankit Signature Reveal',
    prompt:
      'Editorial director portrait in motion: slow dramatic push-in on the developer beside glowing dual monitors, subtle ambient light flicker from code terminals, cinema color grading, high-retention showreel look.',
  },
];

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const mimeType = blob.type || 'image/jpeg';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Failed to encode image'));
        return;
      }
      resolve({ base64: result.slice(commaIdx + 1), mimeType });
    };
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Invalid image file'));
        return;
      }
      resolve({
        previewUrl: result,
        base64: result.slice(commaIdx + 1),
        mimeType: file.type || 'image/png',
      });
    };
    reader.onerror = () => reject(new Error('Could not read uploaded file'));
    reader.readAsDataURL(file);
  });
}

export function OmniVideoStudio() {
  const primaryUploadRef = useRef<HTMLInputElement | null>(null);
  const refUploadRef = useRef<HTMLInputElement | null>(null);

  const [primaryImage, setPrimaryImage] = useState<UploadedImageData | null>(null);
  const [referenceImages, setReferenceImages] = useState<UploadedImageData[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('16:9');
  const [durationSeconds, setDurationSeconds] = useState<number>(10);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [prompt, setPrompt] = useState<string>(MOTION_PRESETS[0].prompt);

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [clips, setClips] = useState<GeneratedVideoClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const activeClip = clips.find((c) => c.id === activeClipId) || clips[0] || null;

  const handlePrimaryUpload = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    try {
      const encoded = await fileToBase64(file);
      setPrimaryImage({
        id: `upload-${Date.now()}`,
        label: file.name,
        ...encoded,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleLoadStudioAsset = async (asset: (typeof STUDIO_ASSETS)[number]) => {
    setErrorMsg(null);
    try {
      const { base64, mimeType } = await urlToBase64(asset.url);
      setPrimaryImage({
        id: asset.id,
        label: asset.label,
        previewUrl: asset.url,
        base64,
        mimeType,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load studio preset image');
    }
  };

  const handleAddReference = async (file: File | undefined) => {
    if (!file || referenceImages.length >= 5) return;
    setErrorMsg(null);
    try {
      const encoded = await fileToBase64(file);
      setReferenceImages((prev) => [
        ...prev,
        {
          id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: file.name,
          ...encoded,
        },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Reference upload failed');
    }
  };

  const handleAnimateImage = async () => {
    if (!primaryImage) {
      setErrorMsg('Please upload a photo or pick one of the studio stills first.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setStatusMessage('Animating image with Gemini Omni Flash (gemini-omni-1.2-flash) via Interactions API...');

    try {
      const res = await fetch('/api/videos/animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: primaryImage.base64,
          mimeType: primaryImage.mimeType,
          referenceImages: referenceImages.map((r) => ({
            data: r.base64,
            mimeType: r.mimeType,
          })),
          prompt,
          aspectRatio,
          durationSeconds,
          resolution,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Video generation failed.');
      }

      const byteChars = atob(data.videoBase64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArr[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArr], { type: data.mimeType || 'video/mp4' });
      const videoUrl = URL.createObjectURL(blob);

      const newClip: GeneratedVideoClip = {
        id: `clip-${Date.now()}`,
        interactionId: data.interactionId,
        videoUrl,
        mimeType: data.mimeType || 'video/mp4',
        aspectRatio: data.aspectRatio || aspectRatio,
        duration: data.duration || `${durationSeconds}s`,
        resolution: data.resolution || resolution,
        prompt,
        createdAt: new Date().toLocaleTimeString(),
      };

      setClips((prev) => [newClip, ...prev]);
      setActiveClipId(newClip.id);
      setStatusMessage(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate video.');
      setStatusMessage(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMultiTurnAction = async (mode: 'extend' | 'edit') => {
    if (!activeClip?.interactionId) return;
    setIsRefining(true);
    setErrorMsg(null);
    setStatusMessage(
      mode === 'extend'
        ? 'Extending video seamlessly via Interactions API...'
        : 'Applying multi-turn video edit via Interactions API...'
    );

    try {
      const endpoint = mode === 'extend' ? '/api/videos/extend' : '/api/videos/edit';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousInteractionId: activeClip.interactionId,
          prompt:
            followUpPrompt.trim() ||
            (mode === 'extend'
              ? 'Continue the cinematic camera pull-back revealing the full developer desk and Hacker Ankit studio.'
              : 'Increase cinematic contrast and dramatic tungsten rim lighting while preserving subject details.'),
          durationSeconds: 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Video ${mode} failed.`);
      }

      const byteChars = atob(data.videoBase64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArr[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArr], { type: data.mimeType || 'video/mp4' });
      const videoUrl = URL.createObjectURL(blob);

      const newClip: GeneratedVideoClip = {
        id: `clip-${Date.now()}`,
        interactionId: data.interactionId,
        videoUrl,
        mimeType: data.mimeType || 'video/mp4',
        aspectRatio: activeClip.aspectRatio,
        duration: data.duration || activeClip.duration,
        resolution: activeClip.resolution,
        prompt: `${mode.toUpperCase()}: ${followUpPrompt.trim() || 'Seamless continuation'}`,
        createdAt: new Date().toLocaleTimeString(),
      };

      setClips((prev) => [newClip, ...prev]);
      setActiveClipId(newClip.id);
      setFollowUpPrompt('');
      setStatusMessage(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : `Video ${mode} failed.`);
      setStatusMessage(null);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <section id="animate-photo" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs font-mono text-[#F2B705] mb-1">GEMINI OMNI FLASH · INTERACTIONS API</p>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Animate Photo Into Video (16:9 or 9:16)
          </h2>
        </div>
        <p className="text-xs text-zinc-400">
          Upload your app screenshot, laptop shot, or portrait to render AI-animated MP4 clips.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Control Column */}
        <div className="lg:col-span-5 bg-[#0D0D11] border border-zinc-800 rounded-2xl p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Primary Photo Dropzone */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono text-zinc-300">SOURCE PHOTO</label>
                {primaryImage && (
                  <button
                    type="button"
                    onClick={() => setPrimaryImage(null)}
                    className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <input
                ref={primaryUploadRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handlePrimaryUpload(e.target.files?.[0])}
              />

              {primaryImage ? (
                <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-video group">
                  <img
                    src={primaryImage.previewUrl}
                    alt={primaryImage.label}
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => primaryUploadRef.current?.click()}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/85 border border-zinc-700 text-xs font-medium text-white hover:border-[#F2B705] cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#F2B705]" />
                    Replace Photo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => primaryUploadRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handlePrimaryUpload(e.dataTransfer.files?.[0]);
                  }}
                  className="w-full aspect-video rounded-xl border border-dashed border-zinc-700 hover:border-[#F2B705] bg-[#050505] flex flex-col items-center justify-center gap-2 p-4 transition-colors cursor-pointer"
                >
                  <Upload className="w-6 h-6 text-[#F2B705]" />
                  <span className="text-sm font-medium text-white">Upload a photo to animate</span>
                  <span className="text-xs text-zinc-500">PNG, JPG, or WebP · App screen, laptop, or portrait</span>
                </button>
              )}

              {/* Quick-pick from generated studio stills */}
              <div className="mt-3">
                <p className="text-[11px] font-mono text-zinc-500 mb-2">OR LOAD A STUDIO STILL</p>
                <div className="grid grid-cols-5 gap-2">
                  {STUDIO_ASSETS.map((asset) => {
                    const selected = primaryImage?.id === asset.id;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleLoadStudioAsset(asset)}
                        title={asset.label}
                        className={`relative aspect-square rounded-lg overflow-hidden border transition-all cursor-pointer ${
                          selected
                            ? 'border-[#F2B705] ring-1 ring-[#F2B705]'
                            : 'border-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        <img
                          src={asset.url}
                          alt={asset.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Optional Extra Storyboard Reference Photos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-zinc-400">
                  STORYBOARD REFERENCES ({referenceImages.length}/5)
                </span>
                <input
                  ref={refUploadRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleAddReference(e.target.files?.[0])}
                />
                {referenceImages.length < 5 && (
                  <button
                    type="button"
                    onClick={() => refUploadRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-[#F2B705] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Reference
                  </button>
                )}
              </div>
              {referenceImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {referenceImages.map((ref) => (
                    <div
                      key={ref.id}
                      className="relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-800"
                    >
                      <img src={ref.previewUrl} alt={ref.label} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove reference"
                        onClick={() =>
                          setReferenceImages((prev) => prev.filter((item) => item.id !== ref.id))
                        }
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/80 text-zinc-200 hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Format Controls: Aspect Ratio (16:9 / 9:16), Duration, Resolution */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="block text-[11px] font-mono text-zinc-400 mb-1.5">ASPECT RATIO</span>
                <div className="grid grid-cols-2 p-1 bg-[#050505] border border-zinc-800 rounded-lg">
                  {(['16:9', '9:16'] as AspectRatioMode[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAspectRatio(r)}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        aspectRatio === r ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="omni-duration" className="block text-[11px] font-mono text-zinc-400 mb-1.5">
                  DURATION
                </label>
                <select
                  id="omni-duration"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#050505] border border-zinc-800 text-xs text-white focus:outline-none focus:border-[#F2B705]"
                >
                  <option value={5}>5 sec</option>
                  <option value={10}>10 sec</option>
                  <option value={15}>15 sec</option>
                </select>
              </div>

              <div>
                <label htmlFor="omni-resolution" className="block text-[11px] font-mono text-zinc-400 mb-1.5">
                  QUALITY
                </label>
                <select
                  id="omni-resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#050505] border border-zinc-800 text-xs text-white focus:outline-none focus:border-[#F2B705]"
                >
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full</option>
                </select>
              </div>
            </div>

            {/* Motion Prompt + Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="omni-prompt" className="text-[11px] font-mono text-zinc-400">
                  CAMERA & MOTION DIRECTION
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MOTION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPrompt(preset.prompt)}
                    className="px-2.5 py-1 rounded-md border border-zinc-800 bg-[#050505] text-[11px] text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <textarea
                id="omni-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe camera movement, lighting, and subject motion..."
                className="w-full p-3 rounded-xl bg-[#050505] border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#F2B705]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnimateImage}
            disabled={isGenerating || isRefining}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F2B705] text-[#050505] font-semibold text-sm hover:bg-[#e5ad04] transition-colors cursor-pointer disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Video...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate {aspectRatio} Video with Gemini Omni Flash
              </>
            )}
          </button>
        </div>

        {/* Right Output Preview & Multi-Turn Refinement Column */}
        <div className="lg:col-span-7 bg-[#0D0D11] border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400">GENERATED VIDEO OUTPUT</span>
              {activeClip && (
                <span className="text-xs font-mono text-zinc-400 tabular-nums">
                  {activeClip.aspectRatio} · {activeClip.duration} · {activeClip.resolution}
                </span>
              )}
            </div>

            {errorMsg && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/35 border border-red-900/60 text-sm text-red-200">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-red-100">Video Generation Notice</p>
                  <p className="text-xs text-red-200/90 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {statusMessage && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-200">
                <Loader2 className="w-4 h-4 text-[#F2B705] animate-spin shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {activeClip ? (
              <div className="space-y-4">
                <div
                  className={`mx-auto rounded-xl overflow-hidden bg-black border border-zinc-800 ${
                    activeClip.aspectRatio === '9:16' ? 'max-w-[300px] aspect-[9/16]' : 'w-full aspect-video'
                  }`}
                >
                  <video
                    key={activeClip.videoUrl}
                    src={activeClip.videoUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-zinc-400 truncate max-w-md">{activeClip.prompt}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={activeClip.videoUrl}
                      download={`Hacker_Ankit_${activeClip.aspectRatio.replace(':', 'x')}.mp4`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-semibold text-white hover:border-[#F2B705] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-[#F2B705]" />
                      Download MP4
                    </a>
                    <a
                      href="https://web.whatsapp.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = activeClip.videoUrl;
                        a.download = `Hacker_Ankit_${activeClip.aspectRatio.replace(':', 'x')}.mp4`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] text-[#050505] text-xs font-bold hover:bg-[#20bd5a] transition-colors whitespace-nowrap shrink-0"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                      Send to WhatsApp
                    </a>
                  </div>
                </div>

                {/* Multi-turn Extend & Edit Controls (previous_interaction_id) */}
                <div className="pt-4 border-t border-zinc-800 space-y-3">
                  <span className="block text-xs font-mono text-zinc-400">
                    MULTI-TURN DIRECTOR FOLLOW-UP (EXTEND OR EDIT CLIP)
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={followUpPrompt}
                      onChange={(e) => setFollowUpPrompt(e.target.value)}
                      placeholder="e.g., Pull back to reveal full dual-monitor setup, or switch to monochrome Leica contrast..."
                      className="flex-1 px-3 py-2 rounded-lg bg-[#050505] border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#F2B705]"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isRefining || isGenerating}
                        onClick={() => handleMultiTurnAction('extend')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-medium text-white hover:border-[#F2B705] cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <Film className="w-3.5 h-3.5 text-[#F2B705]" />
                        Extend +5s
                      </button>
                      <button
                        type="button"
                        disabled={isRefining || isGenerating}
                        onClick={() => handleMultiTurnAction('edit')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-medium text-white hover:border-[#F2B705] cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#F2B705]" />
                        Apply Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video rounded-xl border border-zinc-800/80 bg-[#050505] flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Film className="w-8 h-8 text-zinc-600" />
                <div className="space-y-1 max-w-sm">
                  <p className="text-sm font-medium text-zinc-200">
                    Ready to Animate Your Photo
                  </p>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Select any of the 5 Hacker Ankit studio stills on the left or upload your own app screenshot, choose 16:9 or 9:16, and generate an AI-animated clip.
                  </p>
                </div>
              </div>
            )}
          </div>

          {clips.length > 1 && (
            <div className="pt-3 border-t border-zinc-800 flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-mono text-zinc-500 shrink-0">TAKES:</span>
              {clips.map((clip, i) => (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => setActiveClipId(clip.id)}
                  className={`px-3 py-1 rounded-md text-xs font-mono whitespace-nowrap shrink-0 cursor-pointer ${
                    clip.id === activeClip?.id
                      ? 'bg-[#F2B705] text-[#050505] font-semibold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  Take {clips.length - i} · {clip.aspectRatio}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
