import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Audit ---');
  try {
    const clinics = await prisma.clinic.count();
    const users = await prisma.user.count();
    const clients = await prisma.client.count();
    const patients = await prisma.patient.count();
    const inventory = await prisma.inventoryItem.count();
    const treatments = await prisma.treatment.count();
    const sales = await prisma.sale.count();

    console.log('Clinics:', clinics);
    console.log('Users:', users);
    console.log('Clients (Phase 4):', clients);
    console.log('Patients:', patients);
    console.log('Inventory:', inventory);
    console.log('Treatments:', treatments);
    console.log('Sales:', sales);

    if (patients > 0 && clients === 0) {
      console.warn('WARNING: Patients exist but no Clients found. Relations may be broken.');
    }
    
    if (clinics === 0 && users === 0) {
      console.error('CRITICAL: Database appears empty.');
    }

  } catch (error) {
    console.error('Audit failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
