/**
 * CacheManager - Centralized caching utility for the Vet Nexus application.
 * Uses sessionStorage for persistence across page navigations within a session.
 * Implements TTL (Time-To-Live) and prefix-based invalidation.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // in milliseconds
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

class CacheManager {
    private prefix: string = 'pv_cache';
    private userContext: { clinicId?: string; userId?: string } = {};

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

            const entry: CacheEntry<T> = JSON.parse(raw);
            const now = Date.now();

            // Check if expired
            if (now - entry.timestamp > entry.ttl) {
                sessionStorage.removeItem(key);
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
     */
    set<T>(resource: string, data: T, params?: string, ttl: number = DEFAULT_TTL): void {
        const key = this.generateKey(resource, params);
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl
        };
        try {
            sessionStorage.setItem(key, JSON.stringify(entry));
        } catch (e) {
            // Handle quota exceeded - clear old cache entries
            console.warn('CacheManager: Storage quota exceeded, clearing old entries');
            this.clearAll();
            try {
                sessionStorage.setItem(key, JSON.stringify(entry));
            } catch {
                // Still failing, give up silently
            }
        }
    }

    /**
     * Invalidate all cache entries for a given resource (prefix-based).
     * For example, invalidate('inventory') clears all inventory-related cache.
     */
    invalidate(resource: string): void {
        const keyPrefix = this.generateKey(resource);
        const keysToRemove: string[] = [];

        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(keyPrefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }

    /**
     * Clear all cache entries for the current user.
     */
    clearAll(): void {
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
