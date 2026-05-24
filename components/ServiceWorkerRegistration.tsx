'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Skip in development — avoids caching conflicts with Next.js HMR.
    if (process.env.NODE_ENV === 'development') return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  }, []);

  return null;
}
