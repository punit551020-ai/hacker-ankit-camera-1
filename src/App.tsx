import React, { useCallback, useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { CameraViewfinder } from './components/CameraViewfinder';
import { GalleryView } from './components/GalleryView';
import { InstallGuideView } from './components/InstallGuideView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { CameraSettings, DEFAULT_CAMERA_SETTINGS, MediaItemRecord } from './types/camera';
import {
  DirectoryHandleLike,
  clearAllOfflineMedia,
  deleteOfflineMedia,
  getAllOfflineMedia,
  pickDevicePicturesFolder,
  saveMediaToOfflineDb,
  supportsDirectoryPicker,
} from './utils/offlineGallery';

type AppTab = 'camera' | 'gallery' | 'install';

const SETTINGS_STORAGE_KEY = 'hacker-ankit-camera-settings-v4';

export function App() {
  const isOnline = useOnlineStatus();
  const { isInstalled } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<AppTab>('camera');
  const [items, setItems] = useState<MediaItemRecord[]>([]);
  const [linkedFolder, setLinkedFolder] = useState<DirectoryHandleLike | null>(null);
  const [settings, setSettings] = useState<CameraSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CAMERA_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore storage error
    }
    return DEFAULT_CAMERA_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  useEffect(() => {
    if (isInstalled && activeTab === 'install') {
      setActiveTab('camera');
    }
  }, [isInstalled, activeTab]);

  useEffect(() => {
    getAllOfflineMedia()
      .then((list) => setItems(list))
      .catch(() => undefined);
  }, []);

  const handleCaptureSaved = useCallback(async (newItem: MediaItemRecord) => {
    setItems((prev) => [newItem, ...prev]);
    try {
      await saveMediaToOfflineDb(newItem);
    } catch {
      // Still keep item in live session gallery & trigger device download if storage is restricted
    }
  }, []);

  const handleDeleteItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      await deleteOfflineMedia(id);
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleDeleteMany = useCallback(async (ids: string[]) => {
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((it) => !idSet.has(it.id)));
    for (const id of ids) {
      try {
        await deleteOfflineMedia(id);
      } catch {
        // Ignore individual deletion failure
      }
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    setItems([]);
    try {
      await clearAllOfflineMedia();
    } catch {
      // Ignore storage error
    }
  }, []);

  const handlePickFolder = useCallback(async () => {
    const dir = await pickDevicePicturesFolder();
    if (dir) {
      setLinkedFolder(dir);
    }
  }, []);

  const folderPickerSupported = supportsDirectoryPicker();

  return (
    <div className="min-h-screen bg-[#090A0D] text-[#FAFAFA] flex flex-col">
      {/* Compact 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 h-14 bg-[#090A0D]/90 backdrop-blur-md border-b border-white/10">
        <div className="mx-auto max-w-7xl h-full px-2.5 sm:px-4 flex items-center justify-between gap-2 sm:gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className="flex items-center gap-1.5 sm:gap-2 text-left whitespace-nowrap shrink-0 focus:outline-none"
          >
            <img
              src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
              alt="Hacker Ankit Camera"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-white/15 object-cover shrink-0"
            />
            <span className="text-xs sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              <span className="sm:hidden">Ankit Cam</span>
              <span className="hidden sm:inline">Hacker Ankit Camera</span>
            </span>
          </button>

          <nav className="flex items-center gap-2.5 sm:gap-6 text-xs sm:text-sm font-medium min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                activeTab === 'camera'
                  ? 'text-[#F59E0B] border-[#F59E0B]'
                  : 'text-zinc-400 border-transparent hover:text-white'
              }`}
            >
              Camera
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors tabular-nums ${
                activeTab === 'gallery'
                  ? 'text-[#F59E0B] border-[#F59E0B]'
                  : 'text-zinc-400 border-transparent hover:text-white'
              }`}
            >
              Gallery ({items.length})
            </button>
            {!isInstalled && (
              <button
                type="button"
                onClick={() => setActiveTab('install')}
                className={`hidden md:inline-block whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  activeTab === 'install'
                    ? 'text-[#F59E0B] border-[#F59E0B]'
                    : 'text-zinc-400 border-transparent hover:text-white'
                }`}
              >
                Install App
              </button>
            )}
          </nav>

          {!isInstalled ? (
            <div className="flex items-center shrink-0">
              <PWAInstallButton />
            </div>
          ) : (
            <div className="hidden sm:block w-8 shrink-0" aria-hidden="true" />
          )}
        </div>
      </header>

      <main className="flex-1">
        {activeTab === 'camera' && (
          <CameraViewfinder
            settings={settings}
            onChangeSettings={setSettings}
            lastItem={items[0] || null}
            onCaptureSaved={handleCaptureSaved}
            onOpenGallery={() => setActiveTab('gallery')}
            linkedFolder={linkedFolder}
            onPickFolder={handlePickFolder}
            supportsFolderPicker={folderPickerSupported}
          />
        )}

        {activeTab === 'gallery' && (
          <GalleryView
            items={items}
            onDelete={handleDeleteItem}
            onDeleteMany={handleDeleteMany}
            onClearAll={handleClearAll}
            onBackToCamera={() => setActiveTab('camera')}
          />
        )}

        {activeTab === 'install' && (
          <InstallGuideView
            linkedFolderName={linkedFolder?.name || null}
            onPickFolder={handlePickFolder}
            supportsFolderPicker={folderPickerSupported}
          />
        )}
      </main>

      {/* Genuine Offline Connectivity Toast (only shown when network is actually offline) */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-[#090A0D] shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          Offline Mode — Camera &amp; Gallery active without internet
        </div>
      )}
    </div>
  );
}

export default App;
