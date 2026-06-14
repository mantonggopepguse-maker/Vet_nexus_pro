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

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;
const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;

if (import.meta.env.PROD) {
    const missing = [];
    if (!apiKey) missing.push('VITE_FIREBASE_API_KEY');
    if (!authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
    if (!projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
    if (!appId) missing.push('VITE_FIREBASE_APP_ID');
    if (missing.length > 0) {
        console.error(`CRITICAL: Firebase fallback credentials used in production! Missing env vars: ${missing.join(', ')}`);
    }
}

const firebaseConfig = {
    apiKey: apiKey,
    authDomain: authDomain,
    projectId: projectId,
    storageBucket: storageBucket,
    messagingSenderId: messagingSenderId,
    appId: appId,
    measurementId: measurementId,
};

if (!getApps().length) {
    initializeApp(firebaseConfig);
}

const app = getApps()[0];

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
