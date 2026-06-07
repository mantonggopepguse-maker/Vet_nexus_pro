import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateWeights() {
    console.log('🚀 Starting weight migration...');
    try {
        const patients = await prisma.patient.findMany({
            where: { weight: { gt: 0 } },
            select: { id: true, weight: true, createdAt: true }
        });

        console.log(`Found ${patients.length} patients with weights to migrate.`);

        let count = 0;
        for (const patient of patients) {
            // Check if vital sign already exists for this patient
            const existing = await prisma.vitalSign.findFirst({
                where: { patientId: patient.id, type: 'Weight' }
            });

            if (!existing) {
                await prisma.vitalSign.create({
                    data: {
                        patientId: patient.id,
                        type: 'Weight',
                        value: patient.weight,
                        unit: 'kg',
                        timestamp: patient.createdAt // Use creation date as the first measurement
                    }
                });
                count++;
            }
        }

        console.log(`✅ Successfully migrated ${count} weight entries.`);
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateWeights();
