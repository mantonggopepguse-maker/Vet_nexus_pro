import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create Super Admin user
    const hashedSuperPassword = await bcrypt.hash('superadmin123', 10);
    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@vetnexus.com' },
        update: {},
        create: {
            email: 'superadmin@vetnexus.com',
            password: hashedSuperPassword,
            name: 'Super Admin',
            roles: ['SUPER_ADMIN'],
            isSuperAdmin: true,
            status: 'Active'
        }
    });

    console.log('✅ Created super admin user:', superAdmin.email);

    // Create a default Clinic
    const clinic = await prisma.clinic.upsert({
        where: { slug: 'default-clinic' },
        update: {},
        create: {
            name: 'Vet Nexus Clinic',
            slug: 'default-clinic',
            acronym: 'PVC',
            address: '123 Pet Street, Lagos, Nigeria',
            phone: '+234 800 123 4567',
            email: 'contact@vetnexus.com',
            taxEnabled: true,
            taxRate: 7.5,
            bankName: 'First Bank',
            accountName: 'Vet Nexus Clinic Ltd',
            accountNumber: '1234567890',
            currencySymbol: '₦',
            country: 'Nigeria',
            language: 'English',
            status: 'Active'
        }
    });

    console.log('✅ Created default clinic:', clinic.name);

    // Create clinic admin user
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@vetnexus.com' },
        update: {},
        create: {
            email: 'admin@vetnexus.com',
            password: hashedAdminPassword,
            name: 'Clinic Admin',
            roles: ['Admin', 'Veterinarian'],
            status: 'Active',
            clinicId: clinic.id
        }
    });

    console.log('✅ Created clinic admin user:', admin.email);

    // Create sample client
    const client = await prisma.client.create({
        data: {
            clinicId: clinic.id,
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+234 801 234 5678',
            address: '12 Admiralty Way, Lekki, Lagos'
        }
    });

    console.log('✅ Created sample client');

    // Create sample patient
    const patient = await prisma.patient.create({
        data: {
            name: 'Buddy',
            species: 'Dog',
            breed: 'Golden Retriever',
            gender: 'Male',
            age: 3,
            weight: 28.5,
            color: 'Golden',
            ownerId: client.id
        }
    });

    console.log('✅ Created sample patient');

    // Create sample inventory items
    await prisma.inventoryItem.createMany({
        data: [
            {
                clinicId: clinic.id,
                name: 'Rabies Vaccine (Defensor 3)',
                description: '3-year rabies vaccine for dogs and cats.',
                sku: 'VAX-RAB-001',
                quantity: 50,
                minThreshold: 10,
                expiryDate: '2025-06-15',
                category: 'Medicine',
                packaging: 'Vial',
                costPrice: 22500.00,
                wholesalePrice: 30000.00,
                retailPrice: 67500.00,
                showInClientPortal: true,
                manufacturer: 'Zoetis',
                sales: 0
            },
            {
                clinicId: clinic.id,
                name: 'Frontline Plus (Dogs 23-44 lbs)',
                description: 'Flea and tick prevention spot-on treatment.',
                sku: 'PAR-FLE-005',
                quantity: 42,
                minThreshold: 15,
                expiryDate: '2026-01-20',
                category: 'Medicine',
                packaging: 'Box',
                costPrice: 37500.00,
                wholesalePrice: 52500.00,
                retailPrice: 97500.00,
                showInClientPortal: true,
                manufacturer: 'Boehringer Ingelheim',
                sales: 0
            }
        ]
    });

    console.log('✅ Created sample inventory items');

    // Create sample procedure
    await prisma.procedure.create({
        data: {
            clinicId: clinic.id,
            name: 'IV Fluid Therapy',
            category: 'Medical',
            species: 'Canine & Feline',
            costClinic: 4500,
            costClient: 12000,
            status: 'Active',
            instructions: 'Monitor fluid rate closely. Ensure patient urinates regularly.',
            medications: {
                create: [
                    {
                        drug: 'Lactated Ringers',
                        dose: '500ml',
                        route: 'IV',
                        freq: 'BID',
                        duration: '2'
                    }
                ]
            }
        }
    });

    console.log('✅ Created sample procedure');

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n📝 Super Admin Credentials:');
    console.log('   Email: superadmin@vetnexus.com');
    console.log('   Password: superadmin123');
    console.log('\n📝 Clinic Admin Credentials:');
    console.log('   Email: admin@vetnexus.com');
    console.log('   Password: admin123');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
