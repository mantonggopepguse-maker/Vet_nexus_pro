/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyAJ9ISziRaL18_fx1yd_yQ0DktRrq8SKVk',
    authDomain: 'vet-nexus-pro-f3931.firebaseapp.com',
    projectId: 'vet-nexus-pro-f3931',
    storageBucket: 'vet-nexus-pro-f3931.firebasestorage.app',
    messagingSenderId: '600245403756',
    appId: '1:600245403756:web:f74d204cf999e220e7d849',
    measurementId: 'G-69HR8XFBMN',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const title = notification.title || 'Vet Nexus';
    const options = {
        body: notification.body || 'You have a new notification.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data || {},
    };

    self.registration.showNotification(title, options);
});
