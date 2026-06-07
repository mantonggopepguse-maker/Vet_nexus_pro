import fs from 'fs';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const parseServiceAccount = () => {
    const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawAccount) {
        const json = rawAccount.trim().startsWith('{')
            ? rawAccount
            : Buffer.from(rawAccount, 'base64').toString('utf8');
        return JSON.parse(json);
    }

    const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (accountPath && fs.existsSync(accountPath)) {
        return JSON.parse(fs.readFileSync(accountPath, 'utf8'));
    }

    return null;
};

export const getFirebaseAdminApp = (): App => {
    const existing = getApps()[0];
    if (existing) return existing;

    const serviceAccount = parseServiceAccount();
    
    if (process.env.NODE_ENV === 'production' && !process.env.FIREBASE_PROJECT_ID) {
        console.error('WARNING: FIREBASE_PROJECT_ID environment variable is missing in production environment. Falling back to default ID: vet-nexus-pro-f3931');
    }

    return initializeApp({
        credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id || 'vet-nexus-pro-f3931',
    });
};

export const verifyFirebaseIdToken = (idToken: string) => {
    return getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
};

export const getFirebaseFirestore = () => {
    return getFirestore(getFirebaseAdminApp());
};

export const getFirebaseMessaging = () => {
    return getMessaging(getFirebaseAdminApp());
};

export { FieldValue };
