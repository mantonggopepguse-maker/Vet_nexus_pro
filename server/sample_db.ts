import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Data Sample ---');
  try {
    const sampleClient = await prisma.client.findFirst();
    console.log('Sample Client:', sampleClient);

    const samplePatient = await prisma.patient.findFirst({
        include: {
            owner: true
        }
    });
    console.log('Sample Patient:', samplePatient);

    const brokenPatients = await prisma.patient.count({
        where: {
            ownerId: ""
        }
    });
    console.log('Patients with empty ownerId:', brokenPatients);

  } catch (error) {
    console.error('Sample failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
