import { db, LocalTreatment } from './db';
import { api } from './apiService';
import { toast } from 'sonner';

export const syncService = {
    async saveTreatment(treatment: (Omit<LocalTreatment, 'synced' | 'id'> & { id?: string })) {
        const { id: serverId, ...rest } = treatment;

        // Attempt immediate sync first
        try {
            let result;
            if (serverId) {
                result = await api.treatments.update(serverId, rest);
            } else {
                result = await api.treatments.create(rest);
            }
            // Also persist locally as synced
            await db.treatments.put({
                ...rest,
                id: result.id,
                synced: 1,
                date: rest.date || new Date().toISOString()
            });
            console.log('Treatment synced immediately');
            return result.id;
        } catch (error) {
            // Offline: save locally
            console.warn('Offline: Treatment saved locally, will sync later');
            const localId = await db.treatments.add({
                ...rest,
                id: serverId,
                synced: 0,
                date: rest.date || new Date().toISOString()
            } as LocalTreatment);
            toast.info('Saved offline. Will sync when connection is restored.');
            return localId;
        }
    },

    async deleteTreatment(id: string) {
        try {
            await api.treatments.delete(id);
            // Remove from local db too
            const local = await db.treatments.where('id').equals(id).first();
            if (local?.id) await db.treatments.where('id').equals(id).delete();
            toast.success('Treatment deleted successfully!');
        } catch (error) {
            // Mark deleted locally if offline
            console.warn('Offline delete: marking treatment for deletion', id);
            await db.treatments.where('id').equals(id).modify({ deleted: 1, synced: 0 });
            toast.info('Offline: Deletion will sync when connection is restored.');
        }
    },

    async syncDirtyRecords() {
        const dirty = await db.treatments.where('synced').equals(0).toArray();
        if (dirty.length === 0) return;
        console.log(`Syncing ${dirty.length} records...`);
        for (const record of dirty) {
            try {
                const { id, synced, deleted, ...data } = record;
                if (deleted === 1 && id) {
                    await api.treatments.delete(id);
                    await db.treatments.where('id').equals(id).delete();
                    continue;
                }
                let result;
                if (id && isNaN(Number(id))) {
                    // Real server ID
                    result = await api.treatments.update(id, data);
                } else {
                    result = await api.treatments.create(data);
                }
                await db.treatments.where('id').equals(id!).modify({ synced: 1, id: result.id });
            } catch (error) {
                console.error('Failed to sync record', record.id, error);
            }
        }
    },

    async fetchAndMergeTreatments() {
        try {
            const serverTreatments = await api.treatments.getAll();

            // Clear synced records and re-populate from server to ensure fresh data
            // But KEEP unsynced records (synced === 0)
            await db.treatments.where('synced').equals(1).delete();

            const toAdd = serverTreatments.map((t: any) => ({
                ...t,
                synced: 1,
                date: t.date || t.createdAt
            }));

            await db.treatments.bulkAdd(toAdd);
            return await db.treatments.toArray();
        } catch (error) {
            console.warn('Could not fetch from server, using local data');
            return await db.treatments.toArray();
        }
    }
};

// Auto-sync every minute if online
if (typeof window !== 'undefined') {
    setInterval(() => {
        if (navigator.onLine) {
            syncService.syncDirtyRecords();
        }
    }, 60000);

    window.addEventListener('online', () => {
        syncService.syncDirtyRecords();
    });
}
