import { db } from './db';

/**
 * CacheManager - Centralized caching utility for the Vet Nexus application.
 * Uses sessionStorage for fast in-session access AND IndexedDB for durable
 * offline persistence (survives tab closes).
 * Implements TTL (Time-To-Live) and prefix-based invalidation.
 */

interface CacheEntryData<T> {
    data: T;
    timestamp: number;
    ttl: number; // in milliseconds
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

class CacheManager {
    private prefix: string = 'pv_cache';
    private userContext: { clinicId?: string; userId?: string } = {};
    private hydrated = false;

    constructor() {
        this.hydrateFromIndexedDB();
    }



    /**
     * On init, hydrate sessionStorage from IndexedDB so previously cached
     * data survives tab closes.
     */
    private async hydrateFromIndexedDB(): Promise<void> {
        try {
            const entries = await db.cache.toArray();
            const now = Date.now();
            const expired: string[] = [];
            for (const entry of entries) {
                if (now - entry.timestamp > entry.ttl) {
                    expired.push(entry.key);
                } else {
                    sessionStorage.setItem(entry.key, entry.data);
                }
            }
            if (expired.length > 0) {
                await db.cache.bulkDelete(expired);
            }
        } catch {
            // IndexedDB may not be available
        } finally {
            this.hydrated = true;
        }
    }

    /**
     * Set the user context for cache isolation.
     * This should be called after login to ensure cache keys are user-specific.
     */
    setUserContext(clinicId: string, userId: string) {
        this.userContext = { clinicId, userId };
    }

    /**
     * Clear the user context (e.g., on logout).
     */
    clearUserContext() {
        this.userContext = {};
    }

    /**
     * Generate a cache key based on resource and params.
     */
    private generateKey(resource: string, params?: string): string {
        const { clinicId, userId } = this.userContext;
        const base = `${this.prefix}:${clinicId || 'guest'}:${userId || 'anon'}:${resource}`;
        return params ? `${base}:${params}` : base;
    }

    /**
     * Get data from cache.
     * Returns null if not found, expired, or invalid.
     */
    get<T>(resource: string, params?: string): T | null {
        const key = this.generateKey(resource, params);
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw) return null;

            const entry: CacheEntryData<T> = JSON.parse(raw);
            const now = Date.now();

            // Check if expired
            if (now - entry.timestamp > entry.ttl) {
                sessionStorage.removeItem(key);
                this.removeFromIndexedDB(key);
                return null;
            }

            return entry.data;
        } catch (e) {
            console.warn('CacheManager: Failed to parse cache entry', e);
            return null;
        }
    }

    /**
     * Set data in cache with optional TTL.
     * Persists to both sessionStorage (fast) and IndexedDB (durable).
     */
    set<T>(resource: string, data: T, params?: string, ttl: number = DEFAULT_TTL): void {
        const key = this.generateKey(resource, params);
        const entry: CacheEntryData<T> = {
            data,
            timestamp: Date.now(),
            ttl
        };
        const serialized = JSON.stringify(entry);

        // Write to sessionStorage (fast path)
        try {
            sessionStorage.setItem(key, serialized);
        } catch {
            console.warn('CacheManager: sessionStorage quota exceeded, clearing old entries');
            this.clearSessionStorage();
            try {
                sessionStorage.setItem(key, serialized);
            } catch {
                // Give up on sessionStorage
            }
        }

        // Persist to IndexedDB (durable path)
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

    /**
     * Invalidate all cache entries for a given resource (prefix-based).
     * For example, invalidate('inventory') clears all inventory-related cache.
     */
    async invalidate(resource: string): Promise<void> {
        const keyPrefix = this.generateKey(resource);

        // Clear from sessionStorage
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(keyPrefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));

        // Clear from IndexedDB
        try {
            const entries = await db.cache.filter(e => e.key.startsWith(keyPrefix)).toArray();
            await Promise.all(entries.map(e => db.cache.delete(e.key)));
        } catch {
            // IndexedDB may be unavailable
        }
    }

    /**
     * Clear all cache entries for the current user.
     */
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

// Singleton instance
export const cacheManager = new CacheManager();
