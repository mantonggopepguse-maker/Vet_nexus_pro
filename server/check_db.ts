import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        const users = await prisma.user.findMany({
            select: {
                email: true,
                status: true,
                isSuperAdmin: true,
                roles: true
            }
        });
        console.log('Total users:', users.length);
        console.log('Users list:', JSON.stringify(users, null, 2));

        const admin = await prisma.user.findUnique({
            where: { email: 'admin@vetnexus.com' }
        });

        if (admin) {
            console.log('Admin user found:', admin.email);
            console.log('Admin status:', admin.status);
        } else {
            console.log('Admin user NOT found');
        }
    } catch (error) {
        console.error('Error checking users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

check();
