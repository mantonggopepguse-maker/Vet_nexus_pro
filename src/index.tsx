import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA with automatic cache-update & refresh
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 1000);
    }
  }
});

let refreshing = false;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

const clearStaleDevWorkers = async () => {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => !registration.active?.scriptURL.includes('firebase-messaging-sw.js'))
      .map((registration) => registration.unregister())
  );

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('workbox-') || key.includes('precache') || key.includes('vite-pwa'))
        .map((key) => caches.delete(key))
    );
  }
};

clearStaleDevWorkers().catch((error) => {
  console.warn('Stale service worker cleanup skipped:', error);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
