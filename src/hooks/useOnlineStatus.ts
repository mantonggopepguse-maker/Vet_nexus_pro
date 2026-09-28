import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../services/apiService';

const PING_INTERVAL = 30000;

async function pingServer(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        
        // Target /api/health or /health cleanly
        const healthUrl = API_URL.endsWith('/api') 
            ? `${API_URL}/health`
            : `${API_URL}/api/health`;

        const res = await fetch(healthUrl, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache',
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);
        return res.ok;
    } catch {
        return false;
    }
}

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
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

            // Verify connectivity without falsely flagging active internet users as offline
            const reachable = await pingServer();
            setIsOnline(navigator.onLine && (reachable || navigator.onLine));
        }, PING_INTERVAL);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return isOnline;
}
