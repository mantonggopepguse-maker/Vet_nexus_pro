import { prisma } from '../db.js';

export const logAudit = async (userId: string, module: string, action: string, details: string, clinicId?: string, userName?: string) => {
    try {
        let finalClinicId = clinicId;
        let finalUserName = userName;

        if (!finalClinicId || !finalUserName) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { clinicId: true, name: true }
            });
            if (user) {
                finalClinicId = finalClinicId || user.clinicId || undefined;
                finalUserName = finalUserName || user.name;
            }
        }

        await prisma.auditLog.create({
            data: {
                userId,
                userName: finalUserName || 'Unknown',
                clinicId: finalClinicId,
                module,
                action,
                details,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('Failed to log audit:', error);
    }
};
