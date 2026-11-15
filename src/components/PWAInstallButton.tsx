import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isMacSafari, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  const iconSrc = `${import.meta.env.BASE_URL}pwa-192x192.png`;

  return (
    <>
      <button
        type="button"
        onClick={handleAction}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B] px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-[#090A0D] hover:bg-[#fbbf24] active:scale-[0.98] transition whitespace-nowrap shrink-0 min-h-[36px] sm:min-h-[40px]"
      >
        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>Install App</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#14161D] border border-white/10 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={iconSrc}
                  alt="Hacker Ankit Camera app logo"
                  className="w-12 h-12 rounded-xl border border-white/15 object-cover shrink-0"
                />
                <div>
                  <h3 className="text-base font-bold text-white">Install Hacker Ankit Camera</h3>
                  <p className="text-xs text-zinc-400">Works 100% offline on every device</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm text-zinc-300">
              {isIOS ? (
                <div className="rounded-xl bg-[#0B0C10] border border-white/10 p-4 space-y-2">
                  <p className="font-semibold text-white flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#F59E0B]" />
                    iPhone &amp; iPad (Safari)
                  </p>
                  <p className="text-xs leading-relaxed text-zinc-300">
                    1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.<br />
                    2. Scroll down and select <strong>Add to Home Screen</strong>.<br />
                    3. Tap <strong>Add</strong> — the camera lens icon appears directly on your iPhone Home Screen.
                  </p>
                </div>
              ) : isMacSafari ? (
                <div className="rounded-xl bg-[#0B0C10] border border-white/10 p-4 space-y-2">
                  <p className="font-semibold text-white">MacBook (Safari)</p>
                  <p className="text-xs leading-relaxed text-zinc-300">
                    1. Click <strong>File</strong> in the top macOS menu bar.<br />
                    2. Click <strong>Add to Dock...</strong> to install Hacker Ankit Camera as a standalone Mac app.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-[#0B0C10] border border-white/10 p-4 space-y-2">
                  <p className="font-semibold text-white">Android, MacBook &amp; Laptop (Chrome / Edge)</p>
                  <p className="text-xs leading-relaxed text-zinc-300">
                    1. On Android Chrome, tap the <strong>⋮ Menu</strong> button at top-right and select{' '}
                    <strong>Install app</strong> or <strong>Add to Home screen</strong>.<br />
                    2. On MacBook/Windows Chrome, click the <strong>Install icon</strong> in the right side of the address bar.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-xl bg-white/10 hover:bg-white/15 py-2.5 text-sm font-semibold text-white transition min-h-[44px]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
