import { initializeApp, getApps } from 'firebase/app';
import {
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
    type UserCredential,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAJ9ISziRaL18_fx1yd_yQ0DktRrq8SKVk',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'vet-nexus-pro-f3931.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'vet-nexus-pro-f3931',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'vet-nexus-pro-f3931.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '600245403756',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:600245403756:web:f74d204cf999e220e7d849',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-69HR8XFBMN',
};

if (import.meta.env.PROD && (!import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === 'AIzaSyAJ9ISziRaL18_fx1yd_yQ0DktRrq8SKVk')) {
    console.warn('CRITICAL: Firebase is utilizing fallback development credentials in a production build!');
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithFirebaseEmail = (email: string, password: string): Promise<UserCredential> => {
    return signInWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password);
};

export const createFirebaseEmailAccount = (email: string, password: string): Promise<UserCredential> => {
    return createUserWithEmailAndPassword(firebaseAuth, email.trim().toLowerCase(), password);
};

export const signInWithGoogle = (): Promise<UserCredential> => {
    return signInWithPopup(firebaseAuth, googleProvider);
};

export const getFirebaseIdToken = async (credential: UserCredential): Promise<string> => {
    return credential.user.getIdToken();
};

let messagingInstance: Messaging | null | undefined;

const getFirebaseMessaging = async () => {
    if (messagingInstance !== undefined) return messagingInstance;
    if (!('Notification' in window)) {
        messagingInstance = null;
        return null;
    }

    const supported = await isSupported().catch(() => false);
    messagingInstance = supported ? getMessaging(app) : null;
    return messagingInstance;
};

export const requestFcmToken = async (): Promise<string | null> => {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return null;

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const serviceWorkerRegistration = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined)
        : undefined;

    return getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
    }).catch((err) => {
        console.error('FCM token request failed:', err);
        return null;
    });
};
