import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string;
        roles: string[];
        clinicId?: string;
        isSuperAdmin: boolean;
    };
    file?: any;
    files?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET || 'default-secret-change-this';

        const decoded = jwt.verify(token, secret) as any;

        // Security check: Standard users MUST have a clinicId to prevent global data leakage
        if (!decoded.isSuperAdmin && !decoded.clinicId) {
            console.error('Security Breach Attempt: User logged in without clinicId context', decoded);
            return res.status(403).json({ error: 'Tenant context missing. Please login again.' });
        }

        // Client tokens must remain bound to an active portal-enabled client record.
        if (Array.isArray(decoded.roles) && decoded.roles.includes('CLIENT')) {
            const activeClient = await prisma.client.findFirst({
                where: {
                    id: decoded.id,
                    clinicId: decoded.clinicId,
                    isPortalEnabled: true,
                },
                select: { id: true },
            });

            if (!activeClient) {
                return res.status(403).json({ error: 'Portal access has been disabled. Please contact your clinic.' });
            }
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Super Admin can access everything
        if (req.user.isSuperAdmin) {
            return next();
        }

        const hasRole = req.user.roles.some(role => roles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

export const superAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.isSuperAdmin) {
        return res.status(403).json({ error: 'Super Admin access required' });
    }
    next();
};
