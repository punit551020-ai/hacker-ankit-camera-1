import React from 'react';
import { Download, FolderSync, Laptop, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallGuideViewProps {
  linkedFolderName: string | null;
  onPickFolder: () => void;
  supportsFolderPicker: boolean;
}

export const InstallGuideView: React.FC<InstallGuideViewProps> = ({
  linkedFolderName,
  onPickFolder,
  supportsFolderPicker,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 space-y-8">
      <div className="rounded-3xl bg-[#12141A] border border-white/10 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
        <img
          src={`${import.meta.env.BASE_URL}pwa-512x512.png`}
          alt="Hacker Ankit Camera custom sapphire optical lens home screen icon"
          className="w-28 h-28 md:w-32 md:h-32 rounded-3xl border border-white/15 shadow-2xl shrink-0 object-cover"
        />
        <div className="flex-1 text-center md:text-left space-y-2">
          <p className="text-xs font-medium text-[#F59E0B]">Offline Camera App · Cross-Platform PWA</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Hacker Ankit Camera
          </h1>
          <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed">
            Install once to add this exact camera lens icon to your iPhone, Android, MacBook Dock, or Windows desktop.
            Works 100% offline with zero internet or SIM card, and saves HD to 8K photos and unlimited video directly
            to your device.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
            {isInstalled ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="w-4 h-4" />
                Running as Installed Offline App
              </span>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-[#090A0D] hover:bg-[#fbbf24] transition min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                Install to Home Screen Now
              </button>
            ) : (
              <span className="text-xs text-zinc-400">
                Use your browser menu below to pin the camera app to your Home Screen or Dock.
              </span>
            )}

            {supportsFolderPicker && (
              <button
                type="button"
                onClick={onPickFolder}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2.5 text-sm font-medium text-white transition min-h-[44px]"
              >
                <FolderSync className="w-4 h-4 text-[#F59E0B]" />
                {linkedFolderName ? `Synced Folder: ${linkedFolderName}` : 'Link Pictures Folder (Auto-Save)'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#12141A] border border-white/10 p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#F59E0B]">
            <Smartphone className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-white">Android Phone &amp; Tablet</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Open in <strong>Google Chrome</strong>, tap <strong>⋮ Menu → Install app</strong> (or tap{' '}
            <strong>Install App</strong> above). Every photo and video saves directly to your phone Downloads/Gallery,
            and you can tap <strong>Share → Instagram Story / WhatsApp</strong> immediately.
          </p>
        </div>

        <div className="rounded-2xl bg-[#12141A] border border-white/10 p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#F59E0B]">
            <Smartphone className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-white">iPhone &amp; iPad</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Open in <strong>Safari</strong>, tap the <strong>Share</strong> icon, then select{' '}
            <strong>Add to Home Screen</strong>. After capturing any photo or video, tap{' '}
            <strong>Save to Photos / Share</strong> to drop it directly into Apple Photos or Instagram.
          </p>
        </div>

        <div className="rounded-2xl bg-[#12141A] border border-white/10 p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#F59E0B]">
            <Laptop className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-white">MacBook &amp; Windows Laptop</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            In Chrome or Edge click the <strong>Install icon</strong> in the address bar (or{' '}
            <strong>File → Add to Dock</strong> in Mac Safari). Click <strong>Link Pictures Folder</strong> to save
            every 8K photo &amp; video straight into your laptop&apos;s Pictures folder automatically.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#12141A] border border-white/10 p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
          <WifiOff className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">100% Offline Camera Engine</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Once opened once, the camera lens processor, filters, background changer, AR overlays, shutter audio, and
            IndexedDB photo/video vault are cached locally inside your device. Put your phone in Airplane Mode or remove
            the SIM card — Hacker Ankit Camera keeps capturing without interruption.
          </p>
        </div>
      </div>
    </div>
  );
};
