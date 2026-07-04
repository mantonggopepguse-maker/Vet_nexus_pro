import { db, LocalTreatment } from './db';
import { api } from './apiService';
import { toast } from 'sonner';

const MAX_RETRIES = 3;

export const syncService = {
    async saveTreatment(treatment: (Omit<LocalTreatment, 'synced' | 'id'> & { id?: string })) {
        const { id: serverId, ...rest } = treatment;

        try {
            let result;
            if (serverId) {
                result = await api.treatments.update(serverId, rest);
            } else {
                result = await api.treatments.create(rest);
            }
            await db.treatments.put({
                ...rest,
                id: result.id,
                synced: 1,
                date: rest.date || new Date().toISOString()
            });
            return result.id;
        } catch (error) {
            const localId = await db.treatments.put({
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
            const local = await db.treatments.where('id').equals(id).first();
            if (local?.id) await db.treatments.where('id').equals(id).delete();
            toast.success('Treatment deleted successfully!');
        } catch (error) {
            await db.treatments.where('id').equals(id).modify({ deleted: 1, synced: 0 });
            toast.info('Offline: Deletion will sync when connection is restored.');
        }
    },

    async syncDirtyRecords() {
        const dirty = await db.treatments.where('synced').equals(0).toArray();
        if (dirty.length === 0) return;

        let synced = 0;
        for (const record of dirty) {
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    const { id, synced: _synced, deleted, ...data } = record;
                    if (deleted === 1 && id) {
                        await api.treatments.delete(id);
                        await db.treatments.where('id').equals(id).delete();
                    } else if (id && isNaN(Number(id))) {
                        const result = await api.treatments.update(id, data);
                        await db.treatments.where('id').equals(id!).modify({ synced: 1, id: result.id });
                    } else {
                        const result = await api.treatments.create(data);
                        await db.treatments.where('id').equals(id!).modify({ synced: 1, id: result.id });
                    }
                    synced++;
                    break;
                } catch (error) {
                    if (attempt === MAX_RETRIES - 1) {
                        console.error('Failed to sync record after retries', record.id, error);
                    } else {
                        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                    }
                }
            }
        }
        if (synced > 0) {
            toast.success(`Synced ${synced} record${synced > 1 ? 's' : ''}`);
        }
    },

    async getPendingCount(): Promise<number> {
        try {
            return await db.treatments.where('synced').equals(0).count();
        } catch {
            return 0;
        }
    },

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
            return await db.treatments.toArray();
        } catch (error) {
            return await db.treatments.toArray();
        }
    }
};

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
