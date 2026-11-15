import React, { useRef } from 'react';
import { ImagePlus, RotateCcw, SlidersHorizontal, Upload } from 'lucide-react';
import { ReelConfig, ReelScene, TransitionStyle } from '../types/studio';

interface SceneEditorPanelProps {
  scenes: ReelScene[];
  config: ReelConfig;
  onChangeConfig: (patch: Partial<ReelConfig>) => void;
  onUpdateScene: (sceneId: string, patch: Partial<ReelScene>) => void;
  onSwitchCaptionPreset: (preset: 'english' | 'hinglish') => void;
  onResetDefaults: () => void;
}

export function SceneEditorPanel({
  scenes,
  config,
  onChangeConfig,
  onUpdateScene,
  onSwitchCaptionPreset,
  onResetDefaults,
}: SceneEditorPanelProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleSceneImageUpload = (sceneId: string, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateScene(sceneId, { imageUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <section id="app-scenes" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs font-mono text-[#F2B705] mb-1">TIMELINE & IDENTITY</p>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Customize Name, Captions & App Photos
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
            {(['english', 'hinglish'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onSwitchCaptionPreset(preset)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 cursor-pointer ${
                  config.captionPreset === preset
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {preset} Captions
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Signature Identity, App Title & Download URL Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#0D0D11] border border-zinc-800 rounded-2xl p-5">
        <div>
          <label htmlFor="creator-name" className="block text-xs font-mono text-zinc-400 mb-2">
            HACKER NAME (OPENING + FINALE)
          </label>
          <input
            id="creator-name"
            type="text"
            value={config.creatorName}
            onChange={(e) => onChangeConfig({ creatorName: e.target.value })}
            placeholder="Hacker Ankit"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#050505] border border-zinc-800 text-white font-semibold tracking-wide focus:outline-none focus:border-[#F2B705]"
          />
        </div>

        <div>
          <label htmlFor="app-title" className="block text-xs font-mono text-zinc-400 mb-2">
            YOUR APP NAME (OPENING SUBTITLE)
          </label>
          <input
            id="app-title"
            type="text"
            value={config.appTitle}
            onChange={(e) => onChangeConfig({ appTitle: e.target.value })}
            placeholder="Hacker Ankit Clock App"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#050505] border border-zinc-800 text-cyan-300 font-medium focus:outline-none focus:border-[#F2B705]"
          />
        </div>

        <div>
          <label htmlFor="app-download-url" className="block text-xs font-mono text-zinc-400 mb-2">
            APP LINK (SHOWN IN CHROME GUIDE)
          </label>
          <input
            id="app-download-url"
            type="url"
            value={config.appDownloadUrl}
            onChange={(e) => onChangeConfig({ appDownloadUrl: e.target.value })}
            placeholder="https://punit551020-ai.github.io/clock/"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#050505] border border-zinc-800 text-emerald-300 font-mono text-xs focus:outline-none focus:border-[#F2B705]"
          />
        </div>

        <div>
          <label htmlFor="creator-role" className="block text-xs font-mono text-zinc-400 mb-2">
            CREATOR ROLE SUBTITLE
          </label>
          <input
            id="creator-role"
            type="text"
            value={config.creatorRole}
            onChange={(e) => onChangeConfig({ creatorRole: e.target.value })}
            placeholder="AI Developer · App Builder · Ethical Hacker"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#050505] border border-zinc-800 text-zinc-200 focus:outline-none focus:border-[#F2B705]"
          />
        </div>
      </div>

      {/* 6-Scene Storyboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenes.map((scene, idx) => (
          <div
            key={scene.id}
            className="flex flex-col bg-[#0D0D11] border border-zinc-800 rounded-xl overflow-hidden"
          >
            {/* Scene Image Preview + Replace Upload */}
            <div className="relative aspect-video bg-zinc-950 overflow-hidden group">
              <img
                src={scene.imageUrl}
                alt={scene.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute top-2.5 left-2.5 font-mono text-[11px] text-[#F2B705]">
                {String(idx + 1).padStart(2, '0')} · {scene.isOpening ? 'OPENING NAME' : scene.isFinale ? 'FINALE NAME' : scene.title}
              </span>

              <input
                ref={(el) => {
                  fileInputRefs.current[scene.id] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSceneImageUpload(scene.id, e.target.files?.[0])}
              />

              <button
                type="button"
                onClick={() => fileInputRefs.current[scene.id]?.click()}
                className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-black/80 border border-zinc-700 text-[11px] font-medium text-white hover:border-[#F2B705] transition-colors cursor-pointer"
              >
                <Upload className="w-3 h-3 text-[#F2B705]" />
                Swap Photo
              </button>
            </div>

            {/* Scene Caption & Motion Controls */}
            <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <input
                  type="text"
                  value={scene.kicker}
                  onChange={(e) => onUpdateScene(scene.id, { kicker: e.target.value })}
                  aria-label={`Scene ${idx + 1} kicker`}
                  className="w-full px-2.5 py-1.5 rounded-md bg-[#050505] border border-zinc-800/90 text-[11px] font-mono text-[#F2B705] focus:outline-none focus:border-[#F2B705]"
                />
                {!scene.isOpening && !scene.isFinale && (
                  <input
                    type="text"
                    value={scene.caption}
                    onChange={(e) => onUpdateScene(scene.id, { caption: e.target.value })}
                    aria-label={`Scene ${idx + 1} headline`}
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#050505] border border-zinc-800/90 text-xs font-semibold text-white focus:outline-none focus:border-[#F2B705]"
                  />
                )}
                <input
                  type="text"
                  value={scene.subCaption}
                  onChange={(e) => onUpdateScene(scene.id, { subCaption: e.target.value })}
                  aria-label={`Scene ${idx + 1} sub-caption`}
                  className="w-full px-2.5 py-1.5 rounded-md bg-[#050505] border border-zinc-800/90 text-xs text-zinc-300 focus:outline-none focus:border-[#F2B705]"
                />
              </div>

              <div className="pt-1 flex items-center justify-between gap-2 border-t border-zinc-800/60">
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <SlidersHorizontal className="w-3 h-3" />
                  Cut
                </span>
                <select
                  value={scene.transition}
                  onChange={(e) =>
                    onUpdateScene(scene.id, { transition: e.target.value as TransitionStyle })
                  }
                  aria-label={`Scene ${idx + 1} transition`}
                  className="bg-[#050505] border border-zinc-800 rounded-md px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-[#F2B705]"
                >
                  <option value="zoom-punch">Zoom Punch</option>
                  <option value="whip-pan">Whip Pan</option>
                  <option value="slide-up">Slide Up</option>
                  <option value="focus-pull">Focus Pull</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-400 flex items-center gap-2">
        <ImagePlus className="w-4 h-4 text-[#F2B705] shrink-0" />
        Upload screenshots of your own apps, laptop setup, or personal photo onto any scene above — the 60fps canvas renderer and video exporter update instantaneously.
      </p>
    </section>
  );
}
