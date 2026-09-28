export interface ScheduledVaccine {
    id: string;
    name: string;
    targetSpecies: 'Dog' | 'Cat' | 'All';
    lastGivenDate: string | null;
    nextDueDate: string;
    daysRemaining: number;
    status: 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' | 'NOT_RECORDED';
    notes: string;
}

export function computePetVaccineSchedules(pet: any): ScheduledVaccine[] {
    const species = (pet?.species || 'Dog').trim();
    const isDog = species.toLowerCase().includes('dog') || species.toLowerCase().includes('canine');
    const isCat = species.toLowerCase().includes('cat') || species.toLowerCase().includes('feline');

    const givenVaccines: any[] = pet?.vaccinations || [];
    const today = new Date();

    // Default required annual vaccines
    const requiredVaccines = isDog
        ? [
            { name: 'Rabies Vaccine', code: 'RABIES' },
            { name: 'DHLPP (5-in-1 Combo)', code: 'DHLPP' }
        ]
        : isCat
        ? [
            { name: 'ARV (Anti-Rabies Vaccine)', code: 'ARV' },
            { name: 'FVRCP Vaccine', code: 'FVRCP' }
        ]
        : [
            { name: 'Rabies Vaccine', code: 'RABIES' }
        ];

    const results: ScheduledVaccine[] = [];

    requiredVaccines.forEach((req) => {
        // Find existing record matching vaccine name or code
        const record = givenVaccines.find((v: any) => 
            v.name?.toLowerCase().includes(req.code.toLowerCase()) ||
            v.name?.toLowerCase().includes(req.name.toLowerCase()) ||
            req.name.toLowerCase().includes(v.name?.toLowerCase())
        );

        if (record && record.dateGiven) {
            const givenDate = new Date(record.dateGiven);
            
            // Respect clinic custom nextDueDate if provided; otherwise default to 1 year (12 months) later
            let nextDueDate: Date;
            if (record.nextDueDate) {
                nextDueDate = new Date(record.nextDueDate);
            } else {
                nextDueDate = new Date(givenDate);
                nextDueDate.setFullYear(nextDueDate.getFullYear() + 1); // Default yearly schedule
            }

            const diffTime = nextDueDate.getTime() - today.getTime();
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let status: ScheduledVaccine['status'] = 'UP_TO_DATE';
            if (daysRemaining < 0) {
                status = 'OVERDUE';
            } else if (daysRemaining <= 30) {
                status = 'DUE_SOON';
            }

            results.push({
                id: record.id || `vac-${req.code}`,
                name: record.name || req.name,
                targetSpecies: isDog ? 'Dog' : isCat ? 'Cat' : 'All',
                lastGivenDate: record.dateGiven,
                nextDueDate: nextDueDate.toISOString().split('T')[0],
                daysRemaining,
                status,
                notes: record.notes || 'Default 1-year annual immunization schedule',
            });
        } else {
            // Not recorded yet
            results.push({
                id: `vac-due-${req.code}`,
                name: req.name,
                targetSpecies: isDog ? 'Dog' : isCat ? 'Cat' : 'All',
                lastGivenDate: null,
                nextDueDate: today.toISOString().split('T')[0],
                daysRemaining: 0,
                status: 'NOT_RECORDED',
                notes: 'Recommended annual vaccine due for registration',
            });
        }
    });

    return results;
}
