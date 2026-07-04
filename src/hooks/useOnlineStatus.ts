import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../services/apiService';

const PING_INTERVAL = 30000;

async function pingServer(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_URL}/health`, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache'
        });
        clearTimeout(timeout);
        return res.ok;
    } catch {
        return false;
    }
}

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        intervalRef.current = setInterval(async () => {
            if (!navigator.onLine) {
                setIsOnline(false);
                return;
            }
            const reachable = await pingServer();
            setIsOnline(reachable);
        }, PING_INTERVAL);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return isOnline;
}
