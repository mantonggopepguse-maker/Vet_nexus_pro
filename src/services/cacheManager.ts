import { db } from './db';

interface CacheEntryData<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const DEFAULT_TTL = 5 * 60 * 1000;

class CacheManager {
    private prefix: string = 'pv_cache';
    private userContext: { clinicId?: string; userId?: string } = {};

    setUserContext(clinicId: string, userId: string) {
        this.userContext = { clinicId, userId };
    }

    clearUserContext() {
        this.userContext = {};
    }

    private generateKey(resource: string, params?: string): string {
        const { clinicId, userId } = this.userContext;
        const base = `${this.prefix}:${clinicId || 'guest'}:${userId || 'anon'}:${resource}`;
        return params ? `${base}:${params}` : base;
    }

    private isOnline(): boolean {
        return navigator.onLine;
    }

    getSync<T>(resource: string, params?: string): T | null {
        const key = this.generateKey(resource, params);
        try {
            const raw = sessionStorage.getItem(key);
            if (raw) {
                const entry: CacheEntryData<T> = JSON.parse(raw);
                const expired = Date.now() - entry.timestamp > entry.ttl;
                if (!expired || !this.isOnline()) {
                    if (expired && !this.isOnline()) {
                        entry.ttl = 60 * 1000;
                        sessionStorage.setItem(key, JSON.stringify(entry));
                    }
                    return entry.data;
                }
                sessionStorage.removeItem(key);
            }
        } catch {
            // ignore
        }
        return null;
    }

    async get<T>(resource: string, params?: string): Promise<T | null> {
        const key = this.generateKey(resource, params);
        try {
            const raw = sessionStorage.getItem(key);
            if (raw) {
                const entry: CacheEntryData<T> = JSON.parse(raw);
                const expired = Date.now() - entry.timestamp > entry.ttl;
                if (!expired || !this.isOnline()) {
                    if (expired && !this.isOnline()) {
                        entry.ttl = 60 * 1000;
                        sessionStorage.setItem(key, JSON.stringify(entry));
                    }
                    return entry.data;
                }
                sessionStorage.removeItem(key);
            }

            const idbEntry = await db.cache.get(key);
            if (idbEntry) {
                const idbData: CacheEntryData<T> = JSON.parse(idbEntry.data);
                const expired = Date.now() - idbData.timestamp > idbData.ttl;
                if (!expired || !this.isOnline()) {
                    sessionStorage.setItem(key, idbEntry.data);
                    return idbData.data;
                }
                await db.cache.delete(key);
            }

            return null;
        } catch {
            return null;
        }
    }

    set<T>(resource: string, data: T, params?: string, ttl: number = DEFAULT_TTL): void {
        const key = this.generateKey(resource, params);
        const entry: CacheEntryData<T> = {
            data,
            timestamp: Date.now(),
            ttl
        };
        const serialized = JSON.stringify(entry);

        try {
            sessionStorage.setItem(key, serialized);
        } catch {
            this.clearSessionStorage();
            try {
                sessionStorage.setItem(key, serialized);
            } catch {
                // Give up on sessionStorage
            }
        }

        this.persistToIndexedDB(key, serialized, entry.timestamp, ttl);
    }

    private async persistToIndexedDB(key: string, data: string, timestamp: number, ttl: number): Promise<void> {
        try {
            await db.cache.put({ key, data, timestamp, ttl });
        } catch {
            // IndexedDB may be unavailable
        }
    }

    private async removeFromIndexedDB(key: string): Promise<void> {
        try {
            await db.cache.delete(key);
        } catch {
            // IndexedDB may be unavailable
        }
    }

    async invalidate(resource: string): Promise<void> {
        const keyPrefix = this.generateKey(resource);

        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(keyPrefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));

        try {
            const entries = await db.cache.filter(e => e.key.startsWith(keyPrefix)).toArray();
            await Promise.all(entries.map(e => db.cache.delete(e.key)));
        } catch {
            // IndexedDB may be unavailable
        }
    }

    async clearAll(): Promise<void> {
        this.clearSessionStorage();
        try {
            await db.cache.clear();
        } catch {
            // IndexedDB may be unavailable
        }
    }

    private clearSessionStorage(): void {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
}

export const cacheManager = new CacheManager();
