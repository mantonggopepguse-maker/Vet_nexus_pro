import { db, LocalTreatment } from './db';
import { api } from './apiService';
import { toast } from 'sonner';

const MAX_RETRIES = 3;

export interface SyncState {
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime?: Date;
    lastError?: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncService {
    private isSyncing = false;
    private listeners = new Set<SyncListener>();
    private pendingCount = 0;
    private lastSyncTime?: Date;
    private lastError: string | null = null;
    private autoSyncInterval?: ReturnType<typeof setInterval>;

    constructor() {
        if (typeof window !== 'undefined') {
            this.refreshPendingCount();

            // Periodic sync check every 45s when online
            this.autoSyncInterval = setInterval(() => {
                if (navigator.onLine && this.pendingCount > 0 && !this.isSyncing) {
                    this.syncDirtyRecords();
                }
            }, 45000);

            window.addEventListener('online', () => {
                if (this.pendingCount > 0 && !this.isSyncing) {
                    this.syncDirtyRecords();
                }
            });
        }
    }

    getState(): SyncState {
        return {
            isSyncing: this.isSyncing,
            pendingCount: this.pendingCount,
            lastSyncTime: this.lastSyncTime,
            lastError: this.lastError
        };
    }

    subscribe(listener: SyncListener): () => void {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }

    private notify() {
        const state = this.getState();
        this.listeners.forEach(fn => {
            try {
                fn(state);
            } catch (err) {
                console.error('Error in sync listener:', err);
            }
        });
    }

    async refreshPendingCount(): Promise<number> {
        try {
            const count = await db.treatments.where('synced').equals(0).count();
            this.pendingCount = count;
            this.notify();
            return count;
        } catch {
            return 0;
        }
    }

    async getPendingCount(): Promise<number> {
        return this.refreshPendingCount();
    }

    async saveTreatment(treatment: (Omit<LocalTreatment, 'synced' | 'id'> & { id?: string | number })) {
        const { id: serverId, ...rest } = treatment;
        const isServerId = serverId && !String(serverId).startsWith('local_') && isNaN(Number(serverId));

        try {
            let result;
            if (isServerId) {
                result = await api.treatments.update(String(serverId), rest);
            } else {
                result = await api.treatments.create(rest);
            }

            // Remove local temp record if it existed
            if (serverId && !isServerId) {
                await db.treatments.delete(serverId as any);
            }

            await db.treatments.put({
                ...rest,
                id: result.id,
                synced: 1,
                date: rest.date || new Date().toISOString()
            });

            await this.refreshPendingCount();
            return result.id;
        } catch (error) {
            const localId = serverId || `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            await db.treatments.put({
                ...rest,
                id: localId,
                synced: 0,
                date: rest.date || new Date().toISOString()
            } as LocalTreatment);

            await this.refreshPendingCount();
            toast.info('Saved locally. Will sync when connection is restored.');
            return localId;
        }
    }

    async deleteTreatment(id: string | number) {
        const stringId = String(id);
        const isServerId = stringId && !stringId.startsWith('local_') && isNaN(Number(id));

        try {
            if (isServerId) {
                await api.treatments.delete(stringId);
            }
            await db.treatments.delete(id as any);
            if (!isNaN(Number(id))) {
                await db.treatments.delete(Number(id) as any);
            }
            await this.refreshPendingCount();
            toast.success('Treatment deleted successfully!');
        } catch (error) {
            if (!isServerId) {
                // If it was only local, delete directly from local DB
                await db.treatments.delete(id as any);
                if (!isNaN(Number(id))) {
                    await db.treatments.delete(Number(id) as any);
                }
                toast.success('Local treatment removed');
            } else {
                // Mark for deletion sync when back online
                const existing = await db.treatments.get(id as any);
                if (existing) {
                    await db.treatments.put({ ...existing, deleted: 1, synced: 0 });
                }
                toast.info('Offline: Deletion will sync when connection is restored.');
            }
            await this.refreshPendingCount();
        }
    }

    async syncDirtyRecords(): Promise<{ synced: number; failed: number }> {
        if (this.isSyncing) return { synced: 0, failed: 0 };

        this.isSyncing = true;
        this.lastError = null;
        this.notify();

        try {
            const dirty = await db.treatments.where('synced').equals(0).toArray();
            if (dirty.length === 0) {
                this.pendingCount = 0;
                this.lastSyncTime = new Date();
                return { synced: 0, failed: 0 };
            }

            let synced = 0;
            let failed = 0;

            for (const record of dirty) {
                const rawId = record.id;
                const stringId = rawId !== undefined ? String(rawId) : '';
                const isServerId = stringId && !stringId.startsWith('local_') && isNaN(Number(rawId));

                for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                    try {
                        const { id: _unusedId, synced: _synced, deleted, ...data } = record;

                        if (deleted === 1) {
                            if (isServerId) {
                                await api.treatments.delete(stringId);
                            }
                            if (rawId !== undefined) {
                                await db.treatments.delete(rawId as any);
                            }
                        } else if (isServerId) {
                            const result = await api.treatments.update(stringId, data);
                            await db.treatments.put({
                                ...record,
                                ...result,
                                id: result.id || stringId,
                                synced: 1,
                                deleted: 0
                            });
                        } else {
                            const result = await api.treatments.create(data);
                            if (rawId !== undefined) {
                                await db.treatments.delete(rawId as any);
                            }
                            await db.treatments.put({
                                ...record,
                                ...result,
                                id: result.id,
                                synced: 1,
                                deleted: 0
                            });
                        }
                        synced++;
                        break;
                    } catch (error: any) {
                        if (attempt === MAX_RETRIES - 1) {
                            console.error('Failed to sync record after retries:', rawId, error);
                            this.lastError = error?.message || 'Sync failed for record';
                            failed++;
                        } else {
                            await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
                        }
                    }
                }
            }

            await this.refreshPendingCount();

            if (synced > 0) {
                this.lastSyncTime = new Date();
                toast.success(`Synced ${synced} record${synced > 1 ? 's' : ''}`);
            }

            return { synced, failed };
        } finally {
            this.isSyncing = false;
            this.notify();
        }
    }

    async clearPendingQueue(): Promise<void> {
        try {
            await db.treatments.where('synced').equals(0).delete();
            this.lastError = null;
            await this.refreshPendingCount();
            toast.info('Unsynced queue cleared.');
        } catch (error) {
            console.error('Failed to clear pending sync queue:', error);
            toast.error('Failed to clear queue');
        }
    }

    async fetchAndMergeTreatments() {
        try {
            const serverTreatments = await api.treatments.getAll();
            await db.treatments.where('synced').equals(1).delete();

            const toAdd = serverTreatments.map((t: any) => ({
                ...t,
                synced: 1,
                date: t.date || t.createdAt
            }));

            await db.treatments.bulkPut(toAdd);
            await this.refreshPendingCount();
            return await db.treatments.toArray();
        } catch (error) {
            return await db.treatments.toArray();
        }
    }
}

export const syncService = new SyncService();
