import { Request, Response, NextFunction } from 'express';
import * as subService from '../services/subscriptionService.js';

/**
 * Middleware to check subscription status and limits
 */
export function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;

    if (!user?.clinicId) {
        return next(); // Let auth middleware handle this
    }

    subService.getClinicSubscription(user.clinicId)
        .then(subscription => {
            if (!subscription) {
                // Create free subscription if none exists
                subService.createFreeSubscription(user.clinicId)
                    .then(() => next())
                    .catch(() => next());
                return;
            }

            if (subscription.status === 'suspended') {
                res.status(403).json({
                    error: 'Subscription suspended',
                    message: 'Your subscription has been suspended due to payment issues. Please update your payment method.',
                    code: 'SUBSCRIPTION_SUSPENDED',
                });
                return;
            }

            // Attach subscription to request for downstream use
            (req as any).subscription = subscription;
            next();
        })
        .catch(error => {
            console.error('Subscription check error:', error);
            next(); // Continue anyway to avoid blocking
        });
}

/**
 * Middleware to check resource limits before creation
 */
export function checkResourceLimit(resource: 'clients' | 'patients' | 'staff') {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user?.clinicId) {
            return next();
        }

        try {
            const check = await subService.checkSubscriptionLimit(user.clinicId, resource);

            if (!check.allowed) {
                return res.status(403).json({
                    error: 'Limit reached',
                    message: check.reason,
                    limit: check.limit,
                    current: check.current,
                    code: 'LIMIT_REACHED',
                    upgradeUrl: '/settings?tab=subscription',
                });
            }

            next();
        } catch (error) {
            console.error('Resource limit check error:', error);
            next(); // Continue anyway
        }
    };
}

/**
 * Middleware to check feature access
 */
export function requireFeature(feature: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user?.clinicId) {
            return next();
        }

        try {
            const hasAccess = await subService.checkFeatureAccess(user.clinicId, feature);

            if (!hasAccess) {
                return res.status(403).json({
                    error: 'Feature not available',
                    message: `The ${feature} feature is not included in your clinic's current subscription plan.`,
                    code: 'FEATURE_RESTRICTED',
                    feature,
                    upgradeUrl: '/settings?tab=subscription',
                });
            }

            next();
        } catch (error) {
            console.error('Feature access check error:', error);
            next(); // Continue anyway
        }
    };
}

/**
 * Middleware to warn about subscription status (doesn't block)
 */
export function subscriptionWarning(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;

    if (!user?.clinicId) {
        return next();
    }

    subService.getClinicSubscription(user.clinicId)
        .then(subscription => {
            if (subscription?.status === 'past_due') {
                // Add warning header
                res.setHeader('X-Subscription-Warning', 'Payment is past due. Please update your payment method.');
            } else if (subscription?.cancelAtPeriodEnd) {
                res.setHeader(
                    'X-Subscription-Warning',
                    `Your ${subscription.plan?.displayName || subscription.plan?.name || 'current'} subscription will end on ${subscription.currentPeriodEnd.toISOString()}`
                );
            }
            next();
        })
        .catch(() => next());
}
