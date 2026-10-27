'use client';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handleStatus = () => setOffline(!navigator.onLine);
    handleStatus();
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <div className="offline-banner-content">
        <span className="offline-icon" aria-hidden="true">⚡</span>
        <div>
          <p className="offline-title">Koneksi internet terputus (Mode Offline)</p>
          <p className="offline-description">
            Data yang telah dimuat sebelumnya tetap dapat dilihat dengan penanda umurnya. Pembaruan data atau pemuatan ulang memerlukan koneksi internet.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="offline-retry-btn"
        onClick={() => {
          if (navigator.onLine) setOffline(false);
          else window.location.reload();
        }}
      >
        Periksa koneksi
      </button>
    </div>
  );
}
