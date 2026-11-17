import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode (installed)
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(checkStandalone);
    if (checkStandalone) return;

    // Check if dismissed recently (within 24 hours)
    const dismissedTime = localStorage.getItem('as-pwa-dismissed');
    const isRecentlyDismissed = dismissedTime && (Date.now() - parseInt(dismissedTime, 10) < 24 * 60 * 60 * 1000);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // If iOS and not standalone and not recently dismissed, show prompt after brief delay
    if (isIOSDevice && !checkStandalone && !isRecentlyDismissed) {
      const timer = setTimeout(() => setShowPrompt(true), 2500);
      return () => clearTimeout(timer);
    }

    // Android / Desktop Chrome / Edge beforeinstallprompt handler
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isRecentlyDismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Handler when app is successfully installed
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem('as-pwa-dismissed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    const handleManualTrigger = () => {
      setShowPrompt(true);
      if (isIOSDevice) {
        setShowIOSModal(true);
      }
    };
    window.addEventListener('show-pwa-install', handleManualTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('show-pwa-install', handleManualTrigger);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback if browser didn't fire beforeinstallprompt yet
      alert('To install, tap your browser menu (⋮) and select "Add to Home screen" or "Install App".');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('as-pwa-dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <>
      {/* Floating PWA Install Bar for Mobile */}
      <div className="pwa-install-banner" role="banner" aria-label="Install App">
        <div className="pwa-banner-content">
          <img src="/icon-192.png" alt="AS Metal App" className="pwa-banner-icon" />
          <div className="pwa-banner-text">
            <strong>Install AS Metal App</strong>
            <span>Quick access &amp; seamless mobile experience</span>
          </div>
        </div>
        <div className="pwa-banner-actions">
          <button className="pwa-install-btn" onClick={handleInstallClick}>
            <Download size={16} />
            <span>Install</span>
          </button>
          <button className="pwa-dismiss-btn" onClick={handleDismiss} title="Dismiss" aria-label="Dismiss">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="pwa-modal-overlay" onClick={() => setShowIOSModal(false)}>
          <div className="pwa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-modal-header">
              <div className="brand" style={{ gap: '10px' }}>
                <img src="/icon-192.png" alt="AS Metal" className="pwa-banner-icon" />
                <div>
                  <strong>Install on iPhone / iPad</strong>
                  <small>Follow these 2 simple steps</small>
                </div>
              </div>
              <button className="unstyled" onClick={() => setShowIOSModal(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="pwa-modal-steps">
              <div className="pwa-step">
                <div className="pwa-step-num">1</div>
                <div>
                  Tap the <strong>Share</strong> button <Share size={16} style={{ verticalAlign: 'middle', margin: '0 2px' }} /> in Safari's bottom navigation bar.
                </div>
              </div>
              <div className="pwa-step">
                <div className="pwa-step-num">2</div>
                <div>
                  Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={16} style={{ verticalAlign: 'middle', margin: '0 2px' }} />.
                </div>
              </div>
              <div className="pwa-step">
                <div className="pwa-step-num">3</div>
                <div>
                  Tap <strong>Add</strong> at the top right to complete.
                </div>
              </div>
            </div>
            <button className="btn primary full" style={{ marginTop: '16px' }} onClick={() => setShowIOSModal(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
