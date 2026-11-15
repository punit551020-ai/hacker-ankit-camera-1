import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function checkStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

interface WindowWithPWA extends Window {
  __deferredPWAInstallPrompt?: BeforeInstallPromptEvent | null;
  __pwaAppInstalled?: boolean;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window === 'undefined') return null;
    return (window as WindowWithPWA).__deferredPWAInstallPrompt || null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return checkStandaloneMode() || Boolean((window as WindowWithPWA).__pwaAppInstalled);
  });
  const [isIOS, setIsIOS] = useState(false);
  const [isMacSafari, setIsMacSafari] = useState(false);

  useEffect(() => {
    const win = window as WindowWithPWA;
    setIsInstalled(checkStandaloneMode() || Boolean(win.__pwaAppInstalled));
    if (win.__deferredPWAInstallPrompt) {
      setDeferredPrompt(win.__deferredPWAInstallPrompt);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const isMac = /macintosh/.test(ua) && !isIOSDevice;
    const isSafariOnly = /safari/.test(ua) && !/chrome|crios|edg|opr/.test(ua);
    setIsMacSafari(isMac && isSafariOnly);

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsInstalled(checkStandaloneMode() || Boolean(win.__pwaAppInstalled));
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      win.__deferredPWAInstallPrompt = e as BeforeInstallPromptEvent;
      win.__pwaAppInstalled = false;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstalled(false);
    };

    const handlePromptReady = () => {
      if (win.__deferredPWAInstallPrompt) {
        setDeferredPrompt(win.__deferredPWAInstallPrompt);
        setIsInstalled(false);
      }
    };

    const handleAppInstalled = () => {
      win.__deferredPWAInstallPrompt = null;
      win.__pwaAppInstalled = true;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    standaloneQuery.addEventListener?.('change', handleDisplayModeChange);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-app-installed', handleAppInstalled);

    return () => {
      standaloneQuery.removeEventListener?.('change', handleDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-app-installed', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    const win = window as WindowWithPWA;
    const promptEvent = deferredPrompt || win.__deferredPWAInstallPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      win.__deferredPWAInstallPrompt = null;
      win.__pwaAppInstalled = true;
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isMacSafari,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
