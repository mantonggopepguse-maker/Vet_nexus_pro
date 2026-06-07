import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function upsertDemoUser() {
    try {
        console.log('🔍 Looking for demo user: admin@vetnexus.com...');

        // Find or create a demo clinic
        let clinic = await prisma.clinic.findFirst({
            where: { slug: 'demo-clinic' }
        });

        if (!clinic) {
            console.log('🏥 Creating demo clinic...');
            clinic = await prisma.clinic.create({
                data: {
                    name: 'Demo Clinic',
                    slug: 'demo-clinic',
                    acronym: 'DC',
                    address: '1 Demo Street, Lagos',
                    phone: '+234 800 000 0000',
                    email: 'admin@vetnexus.com',
                    bankName: 'Demo Bank',
                    accountName: 'Demo Clinic Ltd',
                    accountNumber: '0000000000',
                    country: 'Nigeria',
                    language: 'English',
                    currencySymbol: '₦',
                    status: 'Active'
                }
            });
            console.log('✅ Demo clinic created:', clinic.id);
        } else {
            console.log('✅ Demo clinic already exists:', clinic.id);
        }

        // Ensure Free plan subscription exists for demo clinic
        const freePlan = await prisma.subscriptionPlan.findFirst({
            where: { name: 'Free' }
        });

        if (freePlan) {
            const existingSubscription = await prisma.subscription.findFirst({
                where: { clinicId: clinic.id }
            });

            if (!existingSubscription) {
                const farFuture = new Date();
                farFuture.setFullYear(farFuture.getFullYear() + 100);
                await prisma.subscription.create({
                    data: {
                        clinicId: clinic.id,
                        planId: freePlan.id,
                        status: 'active',
                        billingCycle: 'monthly',
                        currentPeriodEnd: farFuture
                    }
                });
                console.log('✅ Free subscription assigned to demo clinic');
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Upsert the demo admin user
        const user = await prisma.user.upsert({
            where: { email: 'admin@vetnexus.com' },
            update: {
                password: hashedPassword,
                status: 'Active',
                clinicId: clinic.id,
                roles: ['Admin']
            },
            create: {
                email: 'admin@vetnexus.com',
                password: hashedPassword,
                name: 'Demo Admin',
                roles: ['Admin'],
                status: 'Active',
                clinicId: clinic.id
            }
        });

        console.log('✅ Demo user upserted successfully!');
        console.log('   Email:    admin@vetnexus.com');
        console.log('   Password: admin123');
        console.log('   Status:   ', user.status);
        console.log('   Clinic:   ', user.clinicId);

    } catch (error) {
        console.error('❌ Error upserting demo user:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

upsertDemoUser();
