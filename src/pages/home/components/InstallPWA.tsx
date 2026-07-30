import { useEffect, useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function InstallPWA() {
  const { isInstallable, isInstalled, install, dismiss, hasNativePrompt } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!isInstallable || isInstalled) return;

    const showTimer = setTimeout(() => {
      setVisible(true);
    }, 200);

    const hideTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        dismiss();
      }, 400);
    }, 5200);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isInstallable, isInstalled, dismiss]);

  if (!visible && !exiting) return null;

  const handleInstall = async () => {
    await install();
    setExiting(true);
    setTimeout(() => setVisible(false), 400);
  };

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      dismiss();
    }, 400);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[9998] bg-foreground-950/40 transition-opacity duration-300 ${
          exiting ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleDismiss}
      />

      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[90vw] max-w-sm transition-all duration-300 ease-out ${
          exiting
            ? 'opacity-0 scale-95 -translate-y-[calc(50%-16px)]'
            : 'opacity-100 scale-100'
        }`}
      >
        <div className="bg-background-50 rounded-2xl p-6 shadow-2xl border border-background-200">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <i className="ri-close-line text-foreground-500"></i>
          </button>

          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-500 flex items-center justify-center">
              <i className="ri-download-2-line text-2xl text-background-50"></i>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground-950">
                Install ObPay App
              </h3>
              <p className="text-sm text-foreground-600 mt-1">
                {hasNativePrompt
                  ? 'Add ObPay to your home screen for quick access and a better experience.'
                  : 'Open this page in Chrome or Edge and tap "Add to Home Screen" from the browser menu.'}
              </p>
            </div>

            <div className="flex gap-3 w-full">
              {hasNativePrompt ? (
                <button
                  onClick={handleInstall}
                  className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                >
                  Install Now
                </button>
              ) : (
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                >
                  Got It
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2.5 bg-background-200 hover:bg-background-300 text-foreground-700 text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Not Now
              </button>
            </div>

            <p className="text-xs text-foreground-400">
              This popup will disappear automatically
            </p>
          </div>
        </div>
      </div>
    </>
  );
}