import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA
registerSW({ immediate: true });

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
