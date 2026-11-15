import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  CheckSquare,
  Download,
  Film,
  Image as ImageIcon,
  Play,
  Share2,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { MediaItemRecord } from '../types/camera';
import {
  formatBytes,
  formatDurationClock,
  shareMediaFile,
  triggerDeviceDownload,
} from '../utils/offlineGallery';

interface GalleryViewProps {
  items: MediaItemRecord[];
  onDelete: (id: string) => Promise<void>;
  onDeleteMany: (ids: string[]) => Promise<void>;
  onClearAll: () => Promise<void>;
  onBackToCamera: () => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  items,
  onDelete,
  onDeleteMany,
  onClearAll,
  onBackToCamera,
}) => {
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [videoPlaybackError, setVideoPlaybackError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const objectUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.id, URL.createObjectURL(item.blob));
    }
    return map;
  }, [items]);

  useEffect(() => {
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [objectUrls]);

  useEffect(() => {
    setVideoPlaybackError(null);
  }, [selectedId]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((it) => it.kind === filter);
  }, [items, filter]);

  const selectedItem = useMemo(
    () => items.find((it) => it.id === selectedId) || null,
    [items, selectedId]
  );

  const notify = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const togglePick = (id: string) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (pickedIds.size === 0) return;
    const ids = Array.from(pickedIds);
    await onDeleteMany(ids);
    if (selectedId && pickedIds.has(selectedId)) setSelectedId(null);
    setPickedIds(new Set());
    setSelectMode(false);
    notify(`Deleted ${ids.length} ${ids.length === 1 ? 'item' : 'items'} from Gallery`);
  };

  const handleSaveDevice = (item: MediaItemRecord) => {
    triggerDeviceDownload(item.blob, item.filename);
    notify(`Saved ${item.filename} to device Downloads`);
  };

  const handleShare = async (item: MediaItemRecord) => {
    const outcome = await shareMediaFile(item.blob, item.filename, 'Hacker Ankit Camera Capture');
    if (outcome === 'shared') {
      notify('Opened system Share / Save to Photos sheet');
    } else if (outcome === 'downloaded') {
      notify(`Downloaded ${item.filename} to your device`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Offline Camera Vault</h1>
          <p className="text-xs text-zinc-400 tabular-nums mt-0.5">
            {items.length} {items.length === 1 ? 'capture' : 'captures'} stored offline in device storage
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#12141A] border border-white/10">
            {(['all', 'photo', 'video'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition min-h-[36px] ${
                  filter === tab
                    ? 'bg-[#F59E0B] text-[#090A0D]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {items.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (selectMode) {
                    setSelectMode(false);
                    setPickedIds(new Set());
                  } else {
                    setSelectMode(true);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition min-h-[40px] ${
                  selectMode
                    ? 'bg-[#F59E0B] border-[#F59E0B] text-[#090A0D] font-semibold'
                    : 'border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10'
                }`}
              >
                {selectMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                {selectMode ? 'Cancel Select' : 'Select Multiple'}
              </button>

              {selectMode && pickedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-xs font-semibold text-white transition min-h-[40px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({pickedIds.size})
                </button>
              )}

              {!selectMode && (
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setSelectedId(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 text-xs font-medium text-red-400 hover:bg-red-500/10 transition min-h-[40px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-xs font-medium text-emerald-300">
          {actionMessage}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="rounded-3xl bg-[#12141A] border border-white/10 py-16 px-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400">
            <Camera className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">No captures yet</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Snap a photo in HD to 8K or record an unlimited video — every capture saves to your device and appears
              right here offline.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToCamera}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-[#090A0D] hover:bg-[#fbbf24] transition min-h-[44px]"
          >
            Open Camera
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const url = objectUrls.get(item.id) || '';
            const isPicked = pickedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`group rounded-2xl bg-[#12141A] border overflow-hidden flex flex-col transition ${
                  isPicked ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]' : 'border-white/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => (selectMode ? togglePick(item.id) : setSelectedId(item.id))}
                  className="relative aspect-[3/4] w-full bg-black overflow-hidden focus:outline-none"
                >
                  {item.kind === 'photo' ? (
                    <img
                      src={url}
                      alt={item.filename}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                    />
                  ) : (
                    <>
                      <video
                        src={url}
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => e.currentTarget.play().catch(() => undefined)}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-11 h-11 rounded-full bg-black/65 border border-white/25 flex items-center justify-center text-white">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>
                    </>
                  )}

                  {selectMode && (
                    <div
                      className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-lg border flex items-center justify-center ${
                        isPicked
                          ? 'bg-[#F59E0B] border-[#F59E0B] text-[#090A0D]'
                          : 'bg-black/60 border-white/40 text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-medium text-white tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {item.kind === 'video' ? (
                        <Film className="w-3.5 h-3.5 text-[#F59E0B]" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-[#F59E0B]" />
                      )}
                      {item.resolutionLabel}
                    </span>
                    {item.kind === 'video' && item.durationSeconds !== undefined && (
                      <span>{formatDurationClock(item.durationSeconds)}</span>
                    )}
                  </div>
                </button>

                <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="text-[11px] text-zinc-400 tabular-nums truncate">
                    {item.width}×{item.height} · {formatBytes(item.sizeBytes)}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleShare(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#F59E0B] text-[#090A0D] py-1.5 px-2 text-xs font-semibold hover:bg-[#fbbf24] transition min-h-[38px]"
                      title="Save to Apple Photos or share to Instagram/WhatsApp/YouTube"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Save / Share
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveDevice(item)}
                      aria-label="Download file"
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-white transition"
                      title="Download copy"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDelete(item.id);
                        if (selectedId === item.id) setSelectedId(null);
                      }}
                      aria-label="Delete capture"
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition"
                      title="Delete this capture"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{selectedItem.filename}</p>
              <p className="text-xs text-zinc-400 tabular-nums">
                {selectedItem.resolutionLabel} · {selectedItem.width}×{selectedItem.height} ·{' '}
                {formatBytes(selectedItem.sizeBytes)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Close preview"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden gap-3">
            {selectedItem.kind === 'photo' ? (
              <img
                src={objectUrls.get(selectedItem.id)}
                alt={selectedItem.filename}
                className="max-h-full max-w-full object-contain rounded-xl"
              />
            ) : (
              <>
                <video
                  key={selectedItem.id}
                  src={objectUrls.get(selectedItem.id)}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  onError={() =>
                    setVideoPlaybackError(
                      'This older video file format cannot play inside this browser tab. Record a new video now (fixed WebM playback) or tap Download File.'
                    )
                  }
                  className="max-h-full max-w-full rounded-xl bg-black"
                />
                {videoPlaybackError && (
                  <p className="text-xs text-amber-300 text-center max-w-md">{videoPlaybackError}</p>
                )}
              </>
            )}
          </div>

          <div className="p-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-3 pb-safe">
            <button
              type="button"
              onClick={() => handleShare(selectedItem)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-[#090A0D] hover:bg-[#fbbf24] transition min-h-[44px]"
            >
              <Share2 className="w-4 h-4" />
              Save to Photos / Post Story
            </button>
            <button
              type="button"
              onClick={() => handleSaveDevice(selectedItem)}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              Download File
            </button>
            <button
              type="button"
              onClick={async () => {
                const id = selectedItem.id;
                await onDelete(id);
                setSelectedId(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
