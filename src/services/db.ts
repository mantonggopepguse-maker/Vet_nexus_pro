import Dexie, { Table } from 'dexie';

export interface LocalTreatment {
    id?: string;
    clientId: string;
    patientId: string;
    description: string;
    diagnosis?: string;
    treatmentPlan?: string;
    medications: any[];
    vitals?: any;
    date: string;
    synced: number; // 0 for local-only, 1 for synced
    deleted?: number; // 1 for soft-deleted locally
}

export class VetNexusDB extends Dexie {
    treatments!: Table<LocalTreatment>;

    constructor() {
        super('VetNexusDB');
        this.version(1).stores({
            treatments: '++id, clientId, patientId, date, synced, deleted'
        });
    }
}

export const db = new VetNexusDB();
