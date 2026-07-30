import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (standalone) {
      setIsInstalled(true);
      setIsInstallable(false);
      return;
    }

    const dismissed = localStorage.getItem('obpay-install-dismissed');
    if (!dismissed) {
      setIsInstallable(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const dismissedCheck = localStorage.getItem('obpay-install-dismissed');
      if (dismissedCheck) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      localStorage.removeItem('obpay-install-dismissed');
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setIsInstalled(true);
        localStorage.removeItem('obpay-install-dismissed');
      }
      setDeferredPrompt(null);
    } else {
      setIsInstallable(false);
      setIsInstalled(true);
      localStorage.removeItem('obpay-install-dismissed');
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setIsInstallable(false);
    setDeferredPrompt(null);
    localStorage.setItem('obpay-install-dismissed', 'true');
  }, []);

  return { isInstallable, isInstalled, install, dismiss, hasNativePrompt: !!deferredPrompt };
}